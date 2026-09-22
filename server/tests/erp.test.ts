import bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app';

const prisma = new PrismaClient();
const app = createApp();
const agent = request(app);

let adminToken = '';
let salesToken = '';
let customerId = '';
let productId = '';
let enquiryId = '';
let quotationId = '';

const login = async (email: string, password: string) => {
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
};

beforeAll(async () => {
  await prisma.dispatchItem.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.enquiryItem.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { name: 'Admin', email: 'admin@test.com', passwordHash: await bcrypt.hash('admin123', 10), role: 'ADMIN' },
      { name: 'Sales', email: 'sales@test.com', passwordHash: await bcrypt.hash('sales123', 10), role: 'SALES_USER' },
    ],
  });

  adminToken = await login('admin@test.com', 'admin123');
  salesToken = await login('sales@test.com', 'sales123');

  const customer = await prisma.customer.create({
    data: { companyName: 'Test Co', contactPerson: 'T', email: 't@test.com', mobile: '9999999999', city: 'Pune' },
  });
  customerId = customer.id;

  const product = await prisma.product.create({
    data: {
      code: 'P-1',
      name: 'Test Product',
      category: 'Test',
      unit: 'PCS',
      basePrice: 100,
      inventory: { create: { physicalQty: 100 } },
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createEnquiry = async () => {
  const res = await agent
    .post('/api/enquiries')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ customerId, items: [{ productId, quantity: 10 }] });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
};

const createQuotation = async (status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED') => {
  const enqId = await createEnquiry();
  const res = await agent
    .post('/api/quotations')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({
      enquiryId: enqId,
      validUntil: '2026-12-31',
      items: [{ productId, quantity: 10, unitPrice: 100, discountPercent: 10, gstPercent: 18 }],
    });
  expect(res.status).toBe(201);
  const id = res.body.data.id as string;
  if (status) {
    await prisma.quotation.update({ where: { id }, data: { status } });
  }
  return { id, enqId };
};

describe('Test 1: quotation total calculation', () => {
  it('computes base, discount, GST and grand total server-side', async () => {
    const enqId = await createEnquiry();
    const res = await agent
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqId,
        validUntil: '2026-12-31',
        items: [
          { productId, quantity: 10, unitPrice: 100, discountPercent: 10, gstPercent: 18 },
          { productId, quantity: 5, unitPrice: 200, discountPercent: 0, gstPercent: 0 },
        ],
      });
    expect(res.status).toBe(201);
    const q = res.body.data;
    // line1: base 1000, disc 100, gst 162 -> 1062 ; line2: 1000
    expect(Number(q.items[0].lineAmount)).toBe(1062);
    expect(Number(q.items[1].lineAmount)).toBe(1000);
    expect(Number(q.grandTotal)).toBe(2062);
  });
});

describe('Tests 2-4: conversion rules', () => {
  it('rejects converting a DRAFT quotation', async () => {
    const { id } = await createQuotation('DRAFT');
    const res = await agent
      .post(`/api/quotations/${id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(422);
  });

  it('rejects converting a REJECTED quotation', async () => {
    const { id } = await createQuotation('REJECTED');
    const res = await agent
      .post(`/api/quotations/${id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(422);
  });

  it('blocks duplicate conversion of the same ACCEPTED quotation', async () => {
    const { id } = await createQuotation('ACCEPTED');
    const first = await agent
      .post(`/api/quotations/${id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(first.status).toBe(201);
    const second = await agent
      .post(`/api/quotations/${id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(second.status).toBe(409);
  });
});

describe('Test 5: inventory reservation limits', () => {
  it('cannot reserve beyond available stock', async () => {
    const enqId = await createEnquiry();
    const q = await agent
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        enquiryId: enqId,
        validUntil: '2026-12-31',
        items: [{ productId, quantity: 150, unitPrice: 100 }],
      });
    await prisma.quotation.update({ where: { id: q.body.data.id }, data: { status: 'ACCEPTED' } });
    const order = await agent
      .post(`/api/quotations/${q.body.data.id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    const res = await agent
      .post(`/api/sales-orders/${order.body.data.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
    const inv = await prisma.inventory.findUnique({ where: { productId } });
    expect(inv!.reservedQty).toBe(0);
    const ord = await prisma.salesOrder.findUnique({ where: { id: order.body.data.id } });
    expect(ord!.status).toBe('PENDING');
  });
});

describe('Test 6: RBAC on dispatch', () => {
  it('SALES_USER cannot dispatch', async () => {
    const { id } = await createQuotation('ACCEPTED');
    const order = await agent
      .post(`/api/quotations/${id}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    const res = await agent
      .post(`/api/sales-orders/${order.body.data.id}/dispatch`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ vehicleNumber: 'MH01', driverName: 'D' });
    expect(res.status).toBe(403);
  });
});

describe('Bonus: concurrent reservations', () => {
  it('only one of two simultaneous confirms succeeds when stock is insufficient', async () => {
    await prisma.inventory.update({ where: { productId }, data: { physicalQty: 100, reservedQty: 0 } });

    const makeOrder = async (qty: number) => {
      const enqId = await createEnquiry();
      const q = await agent
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ enquiryId: enqId, validUntil: '2026-12-31', items: [{ productId, quantity: qty, unitPrice: 100 }] });
      await prisma.quotation.update({ where: { id: q.body.data.id }, data: { status: 'ACCEPTED' } });
      const order = await agent
        .post(`/api/quotations/${q.body.data.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);
      return order.body.data.id as string;
    };

    const [o1, o2] = await Promise.all([makeOrder(80), makeOrder(50)]);
    const [r1, r2] = await Promise.all([
      agent.post(`/api/sales-orders/${o1}/confirm`).set('Authorization', `Bearer ${adminToken}`),
      agent.post(`/api/sales-orders/${o2}/confirm`).set('Authorization', `Bearer ${adminToken}`),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 422]);
    const inv = await prisma.inventory.findUnique({ where: { productId } });
    expect([80, 50]).toContain(inv!.reservedQty);
  });
});

describe('Full workflow smoke test', () => {
  it('enquiry -> quotation -> accept -> convert -> confirm -> dispatch', async () => {
    const enqRes = await agent
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerId, items: [{ productId, quantity: 5 }] });
    expect(enqRes.status).toBe(201);
    enquiryId = enqRes.body.data.id;

    const qRes = await agent
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ enquiryId, validUntil: '2026-12-31', items: [{ productId, quantity: 5, unitPrice: 100, gstPercent: 18 }] });
    quotationId = qRes.body.data.id;
    await agent.patch(`/api/quotations/${quotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'SENT' });
    await agent.patch(`/api/quotations/${quotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });

    const orderRes = await agent
      .post(`/api/quotations/${quotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    const before = await prisma.inventory.findUnique({ where: { productId } });
    const confirmRes = await agent
      .post(`/api/sales-orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(confirmRes.status).toBe(200);
    const mid = await prisma.inventory.findUnique({ where: { productId } });
    expect(mid!.reservedQty).toBe(before!.reservedQty + 5);
    expect(mid!.physicalQty).toBe(before!.physicalQty);

    const dispatchRes = await agent
      .post(`/api/sales-orders/${orderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicleNumber: 'MH12AB1234', driverName: 'Ravi' });
    expect(dispatchRes.status).toBe(201);
    const after = await prisma.inventory.findUnique({ where: { productId } });
    expect(after!.physicalQty).toBe(before!.physicalQty - 5);
    expect(after!.reservedQty).toBe(before!.reservedQty);
  });
});
