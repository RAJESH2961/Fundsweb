import { EnquiryStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { customerRepository } from '../repositories/customer.repository';
import { enquiryRepository } from '../repositories/enquiry.repository';
import { productRepository } from '../repositories/product.repository';
import { EnquirySchema, EnquiryUpdateSchema, paginationQuery } from '../validators/schemas';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { generateNumber } from '../utils/numbers';
import { paginate } from '../utils/response';

export const enquiryService = {
  async create(data: z.infer<typeof EnquirySchema>, userId: string) {
    const customer = await customerRepository.findById(data.customerId);
    if (!customer) throw new NotFoundError('Customer not found');
    for (const item of data.items) {
      if (!(await productRepository.findById(item.productId))) {
        throw new BadRequestError(`Product ${item.productId} does not exist`);
      }
    }
    return prisma.$transaction(async (tx) => {
      const enquiryNumber = await generateNumber('enquiry', tx);
      return enquiryRepository.create(
        {
          enquiryNumber,
          customer: { connect: { id: data.customerId } },
          createdBy: { connect: { id: userId } },
          enquiryDate: data.enquiryDate,
          requiredDate: data.requiredDate ?? undefined,
          notes: data.notes ?? undefined,
          items: { create: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
        },
        tx,
      );
    });
  },

  async getById(id: string) {
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) throw new NotFoundError('Enquiry not found');
    return enquiry;
  },

  async update(id: string, data: z.infer<typeof EnquiryUpdateSchema>) {
    await this.getById(id);
    return prisma.$transaction(async (tx) => {
      if (data.items) {
        for (const item of data.items) {
          if (!(await productRepository.findById(item.productId, tx))) {
            throw new BadRequestError(`Product ${item.productId} does not exist`);
          }
        }
        await enquiryRepository.deleteItems(id, tx);
      }
      return enquiryRepository.update(
        id,
        {
          customer: data.customerId ? { connect: { id: data.customerId } } : undefined,
          enquiryDate: data.enquiryDate,
          requiredDate: data.requiredDate,
          notes: data.notes,
          items: data.items
            ? { create: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }
            : undefined,
        },
        tx,
      );
    });
  },

  async setStatus(id: string, status: EnquiryStatus) {
    await this.getById(id);
    return enquiryRepository.setStatus(id, status);
  },

  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search, status, sortDir } = query;
    const where: Prisma.EnquiryWhereInput = {
      ...(status ? { status: status as EnquiryStatus } : {}),
      ...(search
        ? {
            OR: [
              { enquiryNumber: { contains: search, mode: 'insensitive' } },
              { customer: { companyName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      enquiryRepository.list({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      enquiryRepository.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  },
};
