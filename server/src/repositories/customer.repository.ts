import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';

export const customerRepository = {
  create: (data: Prisma.CustomerCreateInput) => prisma.customer.create({ data }),
  findById: (id: string) => prisma.customer.findUnique({ where: { id } }),
  findByEmail: (email: string) => prisma.customer.findUnique({ where: { email } }),
  update: (id: string, data: Prisma.CustomerUpdateInput) =>
    prisma.customer.update({ where: { id }, data }),
  delete: (id: string) => prisma.customer.delete({ where: { id } }),
  list: (args: Prisma.CustomerFindManyArgs) => prisma.customer.findMany(args),
  count: (args: Prisma.CustomerCountArgs) => prisma.customer.count(args),
};
