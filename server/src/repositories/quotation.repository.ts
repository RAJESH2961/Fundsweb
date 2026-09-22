import { Prisma, QuotationStatus } from '@prisma/client';
import { prisma, Tx } from '../prisma/client';

const db = (tx?: Tx) => tx ?? prisma;
const include = {
  customer: true,
  enquiry: { select: { id: true, enquiryNumber: true } },
  items: { include: { product: true } },
  salesOrder: { select: { id: true, orderNumber: true, status: true } },
};

export const quotationRepository = {
  create: (data: Prisma.QuotationCreateInput, tx?: Tx) =>
    db(tx).quotation.create({ data, include }),
  findById: (id: string, tx?: Tx) =>
    db(tx).quotation.findUnique({ where: { id }, include }),
  update: (id: string, data: Prisma.QuotationUpdateInput, tx?: Tx) =>
    db(tx).quotation.update({ where: { id }, data, include }),
  setStatus: (id: string, status: QuotationStatus, tx?: Tx) =>
    db(tx).quotation.update({ where: { id }, data: { status }, include }),
  list: (args: Prisma.QuotationFindManyArgs) =>
    prisma.quotation.findMany({ ...args, include }),
  count: (args: Prisma.QuotationCountArgs) => prisma.quotation.count(args),
  deleteItems: (quotationId: string, tx?: Tx) =>
    db(tx).quotationItem.deleteMany({ where: { quotationId } }),
};
