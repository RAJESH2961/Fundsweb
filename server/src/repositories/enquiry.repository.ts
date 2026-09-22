import { EnquiryStatus, Prisma } from '@prisma/client';
import { prisma, Tx } from '../prisma/client';

const db = (tx?: Tx) => tx ?? prisma;
const include = { customer: true, createdBy: { select: { id: true, name: true, email: true } }, items: { include: { product: true } } };

export const enquiryRepository = {
  create: (data: Prisma.EnquiryCreateInput, tx?: Tx) =>
    db(tx).enquiry.create({ data, include }),
  findById: (id: string, tx?: Tx) => db(tx).enquiry.findUnique({ where: { id }, include }),
  findByNumber: (enquiryNumber: string) =>
    prisma.enquiry.findUnique({ where: { enquiryNumber }, include }),
  update: (id: string, data: Prisma.EnquiryUpdateInput, tx?: Tx) =>
    db(tx).enquiry.update({ where: { id }, data, include }),
  setStatus: (id: string, status: EnquiryStatus, tx?: Tx) =>
    db(tx).enquiry.update({ where: { id }, data: { status }, include }),
  list: (args: Prisma.EnquiryFindManyArgs) =>
    prisma.enquiry.findMany({ ...args, include }),
  count: (args: Prisma.EnquiryCountArgs) => prisma.enquiry.count(args),
  deleteItems: (enquiryId: string, tx?: Tx) =>
    db(tx).enquiryItem.deleteMany({ where: { enquiryId } }),
};
