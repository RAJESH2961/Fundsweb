const idParam = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
});

const listParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'status', in: 'query', schema: { type: 'string' } },
];

const ok = { description: 'Success' };
const created = { description: 'Created' };

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ERP API',
    version: '1.0.0',
    description:
      'PERN-stack ERP: Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch. All responses use `{ success, message, data }`.',
  },
  servers: [{ url: 'http://localhost:4000/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Login: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', example: 'admin@erp.com' }, password: { type: 'string', example: 'admin123' } },
      },
      Customer: {
        type: 'object',
        required: ['companyName', 'contactPerson', 'email', 'mobile', 'city'],
        properties: {
          companyName: { type: 'string', example: 'Acme Industries' },
          contactPerson: { type: 'string', example: 'John Doe' },
          email: { type: 'string', example: 'john@acme.com' },
          mobile: { type: 'string', example: '9876543210' },
          city: { type: 'string', example: 'Pune' },
        },
      },
      Product: {
        type: 'object',
        required: ['code', 'name', 'category', 'unit', 'basePrice'],
        properties: {
          code: { type: 'string', example: 'GEAR-001' },
          name: { type: 'string', example: 'Industrial Gearbox' },
          category: { type: 'string', example: 'Transmission' },
          unit: { type: 'string', example: 'PCS' },
          basePrice: { type: 'number', example: 25000 },
          physicalQty: { type: 'integer', example: 100 },
        },
      },
      InventoryUpdate: {
        type: 'object',
        properties: {
          physicalQty: { type: 'integer', example: 120 },
          reservedQty: { type: 'integer', example: 10 },
          damagedQty: { type: 'integer', example: 0 },
        },
      },
      Enquiry: {
        type: 'object',
        required: ['customerId', 'items'],
        properties: {
          customerId: { type: 'string', format: 'uuid' },
          requiredDate: { type: 'string', format: 'date' },
          notes: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: { productId: { type: 'string', format: 'uuid' }, quantity: { type: 'integer', example: 5 } },
            },
          },
        },
      },
      Quotation: {
        type: 'object',
        required: ['enquiryId', 'validUntil', 'items'],
        properties: {
          enquiryId: { type: 'string', format: 'uuid' },
          validUntil: { type: 'string', format: 'date', example: '2026-12-31' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity', 'unitPrice'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', example: 5 },
                unitPrice: { type: 'number', example: 25000 },
                discountPercent: { type: 'number', example: 5 },
                gstPercent: { type: 'number', example: 18 },
              },
            },
          },
        },
      },
      Dispatch: {
        type: 'object',
        required: ['vehicleNumber', 'driverName'],
        properties: {
          vehicleNumber: { type: 'string', example: 'MH12AB1234' },
          driverName: { type: 'string', example: 'Ravi Kumar' },
          dispatchDate: { type: 'string', format: 'date' },
        },
      },
      StatusBody: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', example: 'ACCEPTED' } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login and receive JWT',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Login' } } } },
        responses: { '200': ok, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/me': { get: { tags: ['Authentication'], summary: 'Current user', responses: { '200': ok } } },
    '/auth/logout': { post: { tags: ['Authentication'], summary: 'Logout', responses: { '200': ok } } },
    '/customers': {
      get: { tags: ['Customers'], summary: 'List customers (search, pagination)', parameters: listParams, responses: { '200': ok } },
      post: { tags: ['Customers'], summary: 'Create customer', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Customer' } } } }, responses: { '201': created, '409': { description: 'Duplicate email' } } },
    },
    '/customers/{id}': {
      get: { tags: ['Customers'], parameters: [idParam()], responses: { '200': ok, '404': { description: 'Not found' } } },
      patch: { tags: ['Customers'], parameters: [idParam()], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Customer' } } } }, responses: { '200': ok } },
      delete: { tags: ['Customers'], parameters: [idParam()], responses: { '200': ok } },
    },
    '/products': {
      get: { tags: ['Products'], parameters: listParams, responses: { '200': ok } },
      post: { tags: ['Products'], summary: 'Create product (ADMIN)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } }, responses: { '201': created } },
    },
    '/products/{id}': { get: { tags: ['Products'], parameters: [idParam()], responses: { '200': ok } } },
    '/inventory': { get: { tags: ['Inventory'], summary: 'List inventory with computed availableQty', parameters: listParams, responses: { '200': ok } } },
    '/inventory/{id}': {
      patch: { tags: ['Inventory'], summary: 'Update inventory (ADMIN)', parameters: [idParam()], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryUpdate' } } } }, responses: { '200': ok, '400': { description: 'Invalid quantities' } } },
    },
    '/enquiries': {
      get: { tags: ['Enquiries'], parameters: listParams, responses: { '200': ok } },
      post: { tags: ['Enquiries'], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Enquiry' } } } }, responses: { '201': created } },
    },
    '/enquiries/{id}': {
      get: { tags: ['Enquiries'], parameters: [idParam()], responses: { '200': ok } },
      patch: { tags: ['Enquiries'], parameters: [idParam()], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Enquiry' } } } }, responses: { '200': ok } },
    },
    '/enquiries/{id}/status': {
      patch: { tags: ['Enquiries'], parameters: [idParam()], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusBody' } } } }, responses: { '200': ok } },
    },
    '/quotations': {
      get: { tags: ['Quotations'], parameters: listParams, responses: { '200': ok } },
      post: { tags: ['Quotations'], summary: 'Create quotation (totals calculated server-side)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Quotation' } } } }, responses: { '201': created } },
    },
    '/quotations/{id}': {
      get: { tags: ['Quotations'], parameters: [idParam()], responses: { '200': ok } },
      patch: { tags: ['Quotations'], parameters: [idParam()], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Quotation' } } } }, responses: { '200': ok } },
    },
    '/quotations/{id}/status': {
      patch: { tags: ['Quotations'], parameters: [idParam()], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusBody' } } } }, responses: { '200': ok } },
    },
    '/quotations/{id}/convert': {
      post: { tags: ['Quotations'], summary: 'Convert ACCEPTED quotation to sales order', parameters: [idParam()], responses: { '201': created, '409': { description: 'Already converted' }, '422': { description: 'Not ACCEPTED' } } },
    },
    '/sales-orders': { get: { tags: ['Sales Orders'], parameters: listParams, responses: { '200': ok } } },
    '/sales-orders/{id}': { get: { tags: ['Sales Orders'], parameters: [idParam()], responses: { '200': ok } } },
    '/sales-orders/{id}/confirm': {
      post: { tags: ['Sales Orders'], summary: 'Confirm order & reserve inventory atomically (ADMIN, SELECT FOR UPDATE)', parameters: [idParam()], responses: { '200': ok, '422': { description: 'Insufficient stock' }, '409': { description: 'Invalid status' } } },
    },
    '/sales-orders/{id}/cancel': {
      post: { tags: ['Sales Orders'], summary: 'Cancel order & release reservation (ADMIN)', parameters: [idParam()], responses: { '200': ok } },
    },
    '/sales-orders/{id}/dispatch': {
      post: { tags: ['Dispatch'], summary: 'Dispatch confirmed order; decrements physical & reserved (ADMIN)', parameters: [idParam()], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Dispatch' } } } }, responses: { '201': created, '409': { description: 'Invalid status' } } },
    },
  },
};
