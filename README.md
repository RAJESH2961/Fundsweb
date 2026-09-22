# PERN ERP — Sales & Dispatch Workflow

A production-grade ERP implementing the full workflow:

**Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

Built with PostgreSQL + Express + React + Node (PERN), TypeScript end-to-end, Prisma ORM, JWT auth, RBAC, Zod validation, transactional inventory reservation with row-level locking, Jest + Supertest, and Swagger (OpenAPI) docs.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, React Router, TanStack Query, Axios, React Hook Form, Zod, Lucide icons |
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod, Jest, Supertest, Swagger UI |

## Architecture

Layered server architecture — business logic never lives in route handlers:

```
Routes → Controllers → Services → Repositories → Prisma
```

```
server/
├── prisma/            schema.prisma, migrations, seed.ts
├── src/
│   ├── config/        env
│   ├── middleware/    auth (JWT), RBAC, validation, error handler
│   ├── routes/        route definitions
│   ├── controllers/   request/response only
│   ├── services/      business rules, transactions, calculations
│   ├── repositories/  Prisma access only
│   ├── validators/    Zod schemas
│   ├── prisma/        Prisma client
│   ├── utils/         errors, async wrapper, response wrapper, money math, number generation
│   ├── swagger.ts     OpenAPI spec
│   └── app.ts / server.ts
└── tests/             Jest + Supertest suite

client/
└── src/
    ├── api/           axios instance + interceptors
    ├── components/    Button, Input, Select, DataTable, StatusBadge, Modal, ConfirmDialog, Pagination
    ├── context/       AuthContext (JWT + user)
    ├── layouts/       AppLayout with role-aware nav
    ├── pages/         Login, Enquiries, Quotations, SalesOrders
    ├── routes/        ProtectedRoute
    ├── services/      typed API methods
    └── types/         shared DTO types
```

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Backend

```bash
cd server
cp .env.example .env          # edit DATABASE_URL etc.
npm install
npx prisma migrate dev        # create schema + check constraints
npm run seed                  # users, products, inventory, customers, enquiry, accepted quotation
npm run dev                   # http://localhost:4000
```

### Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)
```

### Tests

Tests run against a separate `erp_test_db` database:

```bash
createdb erp_test_db
DATABASE_URL="postgresql://<user>@localhost:5432/erp_test_db?schema=public" npx prisma migrate deploy
cd server && npm test
```

### Swagger

Interactive API docs: **http://localhost:4000/api-docs**

## Environment Variables (`server/.env.example`)

| Var | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate DB used by Jest |
| `JWT_SECRET` | Signing secret |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `1d`) |
| `PORT` | API port (4000) |
| `CLIENT_URL` | CORS origin |
| `NODE_ENV` | development / test / production |

## Test Credentials

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@erp.com` | `admin123` |
| SALES_USER | `sales@erp.com` | `sales123` |

## Business Workflow & Rules

### The big picture

```
 SALES_USER                          ADMIN
    │                                 │
    ▼                                 ▼
Customer ──► Enquiry ──► Quotation ──► Sales Order ──► Reservation ──► Dispatch
(create)    (NEW)       (DRAFT→      (PENDING)        (CONFIRMED)     (DISPATCHED)
                        ACCEPTED)
```

Every stage is a real relational table — no workflow state is hidden in JSON columns. Each transition is enforced server-side; the UI only offers actions the current role + status allow.

### Step 1 — Customer

A `SALES_USER` (or ADMIN) registers the customer. Email must be unique; mobile format is validated by Zod.

```
POST /api/customers   → 201 { id, companyName, ... }
```

### Step 2 — Enquiry

Sales user creates an enquiry for a customer with **one or more** product lines. The enquiry number is generated (`ENQ-2026-00042`), the creator is stamped from the JWT, and all items are inserted in one transaction.

```
POST /api/enquiries
{ "customerId": "...", "requiredDate": "2026-10-15",
  "items": [ { "productId": "...", "quantity": 10 }, ... ] }
```

Status machine: `NEW → QUOTED → WON | LOST` (`PATCH /api/enquiries/:id/status`). Creating a quotation auto-flips `NEW → QUOTED`.

### Step 3 — Quotation

Created against a `NEW`/`QUOTED` enquiry (`WON`/`LOST` are rejected). **The client never sends totals** — the server computes every line:

```
lineAmount = round2( qty × unitPrice × (1 − discount%) × (1 + gst%) )
grandTotal = Σ lineAmount
```

Discount/GST are constrained to 0–100 by both Zod and DB CHECK constraints.

```
POST /api/quotations                    → 201 (DRAFT)
PATCH /api/quotations/:id/status        → DRAFT → SENT → ACCEPTED | REJECTED
```

### Step 4 — Convert to Sales Order

```
POST /api/quotations/:id/convert
```

- `DRAFT`, `SENT`, `REJECTED` → **422** (only ACCEPTED converts)
- Second conversion attempt → **409** (`sales_orders.quotationId` is UNIQUE — guaranteed at the DB level, race-safe)
- On success: order number generated (`SO-2026-00007`), items + `grandTotal` copied for full traceability, status `PENDING`

### Step 5 — Inventory reservation (confirm)

```
POST /api/sales-orders/:id/confirm        (ADMIN only → 403 for SALES_USER)
```

This is the critical transaction. Inside `prisma.$transaction`:

1. Order is re-read; must be `PENDING` else **409**.
2. Inventory rows for all ordered products are locked: `SELECT ... FOR UPDATE`.
3. For each item, `available = physical − reserved − damaged` is checked.
4. **Any** insufficient line → whole transaction rolls back → **422**; nothing is reserved.
5. Otherwise `reservedQty += qty` per item (physical stock is untouched) and the order becomes `CONFIRMED`.

Because the check happens while holding row locks, concurrent confirms are serialized — with 100 available, an 80-unit and a 50-unit confirm cannot both succeed. A DB CHECK constraint (`reservedQty + damagedQty ≤ physicalQty`) is the final backstop.

### Step 6 — Dispatch

```
POST /api/sales-orders/:id/dispatch      (ADMIN only)
{ "vehicleNumber": "MH12AB1234", "driverName": "Ravi" }
```

In one transaction: order must be `CONFIRMED` (not `PENDING`/`CANCELLED`/already `DISPATCHED` → **409**); locked inventory is re-validated; `physicalQty −= qty` and `reservedQty −= qty`; a `dispatch` + `dispatch_items` record is created (`DSP-2026-00003`); order → `DISPATCHED`.

### Cancellation

```
POST /api/sales-orders/:id/cancel        (ADMIN)
```

`CONFIRMED` orders release their reservation (`reservedQty −= qty`) inside the same transaction that flips status to `CANCELLED`. `DISPATCHED` orders cannot be cancelled.

### Inventory invariant

```
availableQty = physicalQty − reservedQty − damagedQty   (always computed, never stored)
```

| Event | physical | reserved | available |
|---|---|---|---|
| Seed stock | 100 | 0 | 100 |
| Confirm order (80) | 100 | 80 | 20 |
| Dispatch (80) | 20 | 0 | 20 |
| Cancel confirmed (80) | 100 | 0 | 100 |

## API Overview

```
POST   /api/auth/login           GET /api/auth/me            POST /api/auth/logout
GET/POST /api/customers          GET/PATCH/DELETE /api/customers/:id
GET/POST /api/products           GET /api/products/:id
GET    /api/inventory            PATCH /api/inventory/:id    (ADMIN)
GET/POST /api/enquiries          GET/PATCH /api/enquiries/:id
PATCH  /api/enquiries/:id/status
GET/POST /api/quotations         GET/PATCH /api/quotations/:id
PATCH  /api/quotations/:id/status
POST   /api/quotations/:id/convert
GET    /api/sales-orders         GET /api/sales-orders/:id
POST   /api/sales-orders/:id/confirm   (ADMIN)
POST   /api/sales-orders/:id/cancel    (ADMIN)
POST   /api/sales-orders/:id/dispatch  (ADMIN)
```

All responses: `{ success, message, data }` or `{ success, message, errors }` with proper codes (400/401/403/404/409/422/500).

## Tests

`server/tests/erp.test.ts` covers:

1. Server-side quotation total calculation
2. Draft quotation cannot convert (422)
3. Rejected quotation cannot convert (422)
4. Duplicate conversion blocked (409)
5. Cannot reserve beyond available stock (422 + rollback)
6. SALES_USER forbidden from dispatch (403)
7. **Bonus:** simultaneous reservation race — only one confirm wins under `FOR UPDATE` locks
8. Full workflow smoke test

## Security

JWT expiry, bcrypt (10 rounds), Helmet, CORS allowlist, global + login rate limiting, Zod validation on every input, no password hashes in responses.

## Extensibility

The schema already includes `damagedQty` (`available = physical - reserved - damaged`), order cancellation with reservation release, and `dispatch_items` ready for partial-dispatch support.

## Screenshots

_Add screenshots of Login / Enquiries / Quotations / Sales Orders here._
