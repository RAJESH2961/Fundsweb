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

1. **Enquiry** — sales user picks a customer and adds ≥1 product rows; number auto-generated (`ENQ-YYYY-#####`). Statuses: `NEW → QUOTED → WON | LOST`.
2. **Quotation** — created against an enquiry; the server computes base, discount, GST, line amount, and grand total (client totals are never trusted). Statuses: `DRAFT → SENT → ACCEPTED | REJECTED`.
3. **Conversion** — only `ACCEPTED` quotations convert; `quotationId` is unique on `sales_orders` so duplicates return **409**.
4. **Confirm (reservation)** — ADMIN only. Inside a PostgreSQL transaction, inventory rows are locked with `SELECT ... FOR UPDATE`, `available = physical - reserved - damaged` is checked, then `reservedQty` is incremented atomically. Insufficient stock → **422** + rollback. Concurrent confirms are serialized by row locks — only one succeeds.
5. **Dispatch** — ADMIN only, requires `CONFIRMED`. Validates reserved stock, decrements `physicalQty` and `reservedQty`, creates dispatch + items, marks order `DISPATCHED` — all in one transaction.
6. **Cancel** — confirmed orders release their reservation.

Inventory availability is always **calculated**, never stored.

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
