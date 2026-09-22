import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const salesPassword = await bcrypt.hash('sales123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@erp.com', passwordHash: password, role: 'ADMIN' },
  });
  const sales = await prisma.user.upsert({
    where: { email: 'sales@erp.com' },
    update: {},
    create: { name: 'Sales User', email: 'sales@erp.com', passwordHash: salesPassword, role: 'SALES_USER' },
  });

  const products = [
    { code: 'GBX-100', name: 'Industrial Gearbox 100Nm', category: 'Transmission', unit: 'PCS', basePrice: 25000, qty: 100 },
    { code: 'MTR-5HP', name: 'Electric Motor 5HP', category: 'Motors', unit: 'PCS', basePrice: 18000, qty: 80 },
    { code: 'VLV-SS2', name: 'Stainless Steel Valve 2in', category: 'Valves', unit: 'PCS', basePrice: 4200, qty: 200 },
    { code: 'BRG-6205', name: 'Ball Bearing 6205ZZ', category: 'Bearings', unit: 'PCS', basePrice: 350, qty: 500 },
    { code: 'CMP-3KW', name: 'Air Compressor 3KW', category: 'Pneumatics', unit: 'PCS', basePrice: 32000, qty: 40 },
    { code: 'CNC-BIT', name: 'CNC Cutting Bit Set', category: 'Tooling', unit: 'SET', basePrice: 7500, qty: 60 },
  ];

  const productMap = new Map<string, string>();
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        basePrice: p.basePrice,
        inventory: { create: { physicalQty: p.qty } },
      },
    });
    productMap.set(p.code, product.id);
  }

  const customers = [
    { companyName: 'Acme Industries', contactPerson: 'John Doe', email: 'john@acme.com', mobile: '9876543210', city: 'Pune' },
    { companyName: 'Bharat Engineering', contactPerson: 'Priya Sharma', email: 'priya@bharateng.com', mobile: '9876501234', city: 'Mumbai' },
    { companyName: 'Continental Machines', contactPerson: 'Rahul Verma', email: 'rahul@contmach.com', mobile: '9812345670', city: 'Chennai' },
  ];
  const customerIds: string[] = [];
  for (const c of customers) {
    const customer = await prisma.customer.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });
    customerIds.push(customer.id);
  }

  if ((await prisma.enquiry.count()) === 0) {
    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: 'ENQ-2026-00001',
        customerId: customerIds[0],
        requiredDate: new Date(Date.now() + 30 * 86400_000),
        notes: 'Urgent requirement for plant expansion',
        createdById: sales.id,
        items: {
          create: [
            { productId: productMap.get('GBX-100')!, quantity: 4 },
            { productId: productMap.get('MTR-5HP')!, quantity: 6 },
          ],
        },
      },
    });

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: 'QTN-2026-00001',
        enquiryId: enquiry.id,
        customerId: customerIds[0],
        validUntil: new Date(Date.now() + 15 * 86400_000),
        status: 'ACCEPTED',
        createdById: sales.id,
        grandTotal: 0,
        items: {
          create: [
            { productId: productMap.get('GBX-100')!, quantity: 4, unitPrice: 25000, discountPercent: 5, gstPercent: 18, lineAmount: 0 },
            { productId: productMap.get('MTR-5HP')!, quantity: 6, unitPrice: 18000, discountPercent: 0, gstPercent: 18, lineAmount: 0 },
          ],
        },
      },
      include: { items: true },
    });

    let grand = 0;
    for (const item of quotation.items) {
      const base = Number(item.unitPrice) * item.quantity;
      const taxable = base - (base * Number(item.discountPercent)) / 100;
      const line = Math.round((taxable + (taxable * Number(item.gstPercent)) / 100) * 100) / 100;
      grand += line;
      await prisma.quotationItem.update({ where: { id: item.id }, data: { lineAmount: line } });
    }
    await prisma.quotation.update({ where: { id: quotation.id }, data: { grandTotal: grand } });
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { status: 'QUOTED' } });
    console.log(`Seeded quotation QTN-2026-00001 (ACCEPTED, total ${grand}) — ready to convert.`);
  }

  console.log(`Seed complete. Admin: ${admin.email}, Sales: ${sales.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
