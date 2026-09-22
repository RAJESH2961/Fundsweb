import { Prisma, QuotationStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { enquiryRepository } from '../repositories/enquiry.repository';
import { quotationRepository } from '../repositories/quotation.repository';
import { productRepository } from '../repositories/product.repository';
import { paginationQuery, QuotationSchema, QuotationUpdateSchema } from '../validators/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { calcGrandTotal, calcLineAmount } from '../utils/money';
import { generateNumber } from '../utils/numbers';
import { paginate } from '../utils/response';

type ItemInput = z.infer<typeof QuotationSchema>['items'][number];

const buildItems = async (items: ItemInput[], tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
  const lines = [];
  for (const item of items) {
    if (!(await productRepository.findById(item.productId, tx))) {
      throw new BadRequestError(`Product ${item.productId} does not exist`);
    }
    const calc = calcLineAmount(item);
    lines.push({ ...item, ...calc });
  }
  return lines;
};

export const quotationService = {
  async create(data: z.infer<typeof QuotationSchema>, userId: string) {
    const enquiry = await enquiryRepository.findById(data.enquiryId);
    if (!enquiry) throw new NotFoundError('Enquiry not found');
    if (enquiry.status === 'LOST' || enquiry.status === 'WON') {
      throw new BadRequestError(`Cannot create a quotation for a ${enquiry.status} enquiry`);
    }
    return prisma.$transaction(async (tx) => {
      const lines = await buildItems(data.items, tx);
      const quotationNumber = await generateNumber('quotation', tx);
      const quotation = await quotationRepository.create(
        {
          quotationNumber,
          enquiry: { connect: { id: data.enquiryId } },
          customer: { connect: { id: enquiry.customerId } },
          validUntil: data.validUntil,
          grandTotal: calcGrandTotal(lines),
          createdById: userId,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPercent: l.discountPercent,
              gstPercent: l.gstPercent,
              lineAmount: l.lineAmount,
            })),
          },
        },
        tx,
      );
      if (enquiry.status === 'NEW') {
        await enquiryRepository.setStatus(enquiry.id, 'QUOTED', tx);
      }
      return quotation;
    });
  },

  async getById(id: string) {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) throw new NotFoundError('Quotation not found');
    return quotation;
  },

  async update(id: string, data: z.infer<typeof QuotationUpdateSchema>) {
    const quotation = await this.getById(id);
    if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
      throw new ConflictError(`Cannot edit a ${quotation.status.toLowerCase()} quotation`);
    }
    return prisma.$transaction(async (tx) => {
      let lines;
      if (data.items) {
        lines = await buildItems(data.items, tx);
        await quotationRepository.deleteItems(id, tx);
      }
      return quotationRepository.update(
        id,
        {
          validUntil: data.validUntil,
          grandTotal: lines ? calcGrandTotal(lines) : undefined,
          items: lines
            ? {
                create: lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discountPercent: l.discountPercent,
                  gstPercent: l.gstPercent,
                  lineAmount: l.lineAmount,
                })),
              }
            : undefined,
        },
        tx,
      );
    });
  },

  async setStatus(id: string, status: QuotationStatus) {
    await this.getById(id);
    return quotationRepository.setStatus(id, status);
  },

  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search, status, sortDir } = query;
    const where: Prisma.QuotationWhereInput = {
      ...(status ? { status: status as QuotationStatus } : {}),
      ...(search
        ? {
            OR: [
              { quotationNumber: { contains: search, mode: 'insensitive' } },
              { customer: { companyName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      quotationRepository.list({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      quotationRepository.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  },
};
