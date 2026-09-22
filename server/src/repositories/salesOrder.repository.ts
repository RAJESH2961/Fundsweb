import { OrderStatus, Prisma } from '@prisma/client';
import { prisma, Tx } from '../prisma/client';

const db = (tx?: Tx) => tx ?? prisma;
const include = {
  customer: true,
  quotation: { select: { id: true, quotationNumber: true } },
  items: { include: { product: true } },
  dispatches: { include: { items: true } },
};

export const salesOrderRepository = {
  create: (data: Prisma.SalesOrderCreateInput, tx?: Tx) =>
    db(tx).salesOrder.create({ data, include }),
  findById: (id: string, tx?: Tx) =>
    db(tx).salesOrder.findUnique({ where: { id }, include }),
  findByQuotationId: (quotationId: string, tx?: Tx) =>
    db(tx).salesOrder.findUnique({ where: { quotationId } }),
  update: (id: string, data: Prisma.SalesOrderUpdateInput, tx?: Tx) =>
    db(tx).salesOrder.update({ where: { id }, data, include }),
  setStatus: (id: string, status: OrderStatus, tx?: Tx) =>
    db(tx).salesOrder.update({ where: { id }, data: { status }, include }),
  list: (args: Prisma.SalesOrderFindManyArgs) =>
    prisma.salesOrder.findMany({ ...args, include }),
  count: (args: Prisma.SalesOrderCountArgs) => prisma.salesOrder.count(args),
};

export const dispatchRepository = {
  create: (data: Prisma.DispatchCreateInput, tx?: Tx) =>
    db(tx).dispatch.create({ data, include: { items: true, salesOrder: true } }),
  findByOrderId: (salesOrderId: string, tx?: Tx) =>
    db(tx).dispatch.findMany({ where: { salesOrderId }, include: { items: true } }),
};
