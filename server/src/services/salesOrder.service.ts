import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, Tx } from '../prisma/client';
import { inventoryRepository } from '../repositories/product.repository';
import { quotationRepository } from '../repositories/quotation.repository';
import { dispatchRepository, salesOrderRepository } from '../repositories/salesOrder.repository';
import { DispatchSchema, paginationQuery } from '../validators/schemas';
import { BadRequestError, ConflictError, NotFoundError, UnprocessableError } from '../utils/errors';
import { generateNumber } from '../utils/numbers';
import { paginate } from '../utils/response';

export const salesOrderService = {
  async convertFromQuotation(quotationId: string) {
    return prisma.$transaction(async (tx) => {
      const quotation = await quotationRepository.findById(quotationId, tx);
      if (!quotation) throw new NotFoundError('Quotation not found');
      if (quotation.status === 'DRAFT') {
        throw new UnprocessableError('Draft quotation cannot be converted to a sales order');
      }
      if (quotation.status === 'REJECTED') {
        throw new UnprocessableError('Rejected quotation cannot be converted to a sales order');
      }
      if (quotation.status !== 'ACCEPTED') {
        throw new UnprocessableError('Only ACCEPTED quotations can be converted');
      }
      const existing = await salesOrderRepository.findByQuotationId(quotationId, tx);
      if (existing) {
        throw new ConflictError('This quotation has already been converted to a sales order');
      }
      const orderNumber = await generateNumber('order', tx);
      try {
        return await salesOrderRepository.create(
          {
            orderNumber,
            quotation: { connect: { id: quotation.id } },
            customer: { connect: { id: quotation.customerId } },
            totalAmount: quotation.grandTotal,
            items: {
              create: quotation.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                lineAmount: i.lineAmount,
              })),
            },
          },
          tx,
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictError('This quotation has already been converted to a sales order');
        }
        throw e;
      }
    });
  },

  async getById(id: string) {
    const order = await salesOrderRepository.findById(id);
    if (!order) throw new NotFoundError('Sales order not found');
    return order;
  },

  async confirm(id: string) {
    return prisma.$transaction(async (tx) => {
      const order = await salesOrderRepository.findById(id, tx);
      if (!order) throw new NotFoundError('Sales order not found');
      if (order.status !== 'PENDING') {
        throw new ConflictError(`Order is ${order.status}; only PENDING orders can be confirmed`);
      }
      const productIds = order.items.map((i) => i.productId);
      const locked = await inventoryRepository.lockByProductIds(productIds, tx);
      const byProduct = new Map(locked.map((r) => [r.productId, r]));
      for (const item of order.items) {
        const inv = byProduct.get(item.productId);
        if (!inv) throw new BadRequestError(`No inventory record for product ${item.productId}`);
        const available = inv.physicalQty - inv.reservedQty - inv.damagedQty;
        if (available < item.quantity) {
          throw new UnprocessableError(
            `Insufficient stock for product ${item.productId}: requested ${item.quantity}, available ${available}`,
          );
        }
      }
      for (const item of order.items) {
        await inventoryRepository.updateByProductId(
          item.productId,
          { reservedQty: { increment: item.quantity } },
          tx,
        );
      }
      return salesOrderRepository.setStatus(id, 'CONFIRMED', tx);
    });
  },

  async cancel(id: string) {
    return prisma.$transaction(async (tx) => {
      const order = await salesOrderRepository.findById(id, tx);
      if (!order) throw new NotFoundError('Sales order not found');
      if (order.status === 'DISPATCHED') {
        throw new ConflictError('Dispatched orders cannot be cancelled');
      }
      if (order.status === 'CANCELLED') {
        throw new ConflictError('Order is already cancelled');
      }
      if (order.status === 'CONFIRMED') {
        const productIds = order.items.map((i) => i.productId);
        await inventoryRepository.lockByProductIds(productIds, tx);
        for (const item of order.items) {
          await inventoryRepository.updateByProductId(
            item.productId,
            { reservedQty: { decrement: item.quantity } },
            tx,
          );
        }
      }
      return salesOrderRepository.setStatus(id, 'CANCELLED', tx);
    });
  },

  async dispatch(id: string, data: z.infer<typeof DispatchSchema>) {
    return prisma.$transaction(async (tx) => {
      const order = await salesOrderRepository.findById(id, tx);
      if (!order) throw new NotFoundError('Sales order not found');
      if (order.status === 'CANCELLED') {
        throw new ConflictError('Cannot dispatch a cancelled order');
      }
      if (order.status === 'DISPATCHED') {
        throw new ConflictError('Order has already been dispatched');
      }
      if (order.status !== 'CONFIRMED') {
        throw new ConflictError('Only CONFIRMED orders can be dispatched');
      }
      const productIds = order.items.map((i) => i.productId);
      const locked = await inventoryRepository.lockByProductIds(productIds, tx);
      const byProduct = new Map(locked.map((r) => [r.productId, r]));
      for (const item of order.items) {
        const inv = byProduct.get(item.productId);
        if (!inv) throw new BadRequestError(`No inventory record for product ${item.productId}`);
        if (inv.reservedQty < item.quantity || inv.physicalQty < item.quantity) {
          throw new UnprocessableError(
            `Cannot dispatch ${item.quantity} of product ${item.productId}: reserved ${inv.reservedQty}, physical ${inv.physicalQty}`,
          );
        }
      }
      for (const item of order.items) {
        await inventoryRepository.updateByProductId(
          item.productId,
          {
            physicalQty: { decrement: item.quantity },
            reservedQty: { decrement: item.quantity },
          },
          tx,
        );
      }
      const dispatchNumber = await generateNumber('dispatch', tx);
      const dispatch = await dispatchRepository.create(
        {
          dispatchNumber,
          salesOrder: { connect: { id } },
          dispatchDate: data.dispatchDate,
          vehicleNumber: data.vehicleNumber,
          driverName: data.driverName,
          items: {
            create: order.items.map((i) => ({
              salesOrderItemId: i.id,
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        tx,
      );
      await salesOrderRepository.setStatus(id, 'DISPATCHED', tx);
      return dispatch;
    });
  },

  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search, status, sortDir } = query;
    const where: Prisma.SalesOrderWhereInput = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { customer: { companyName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      salesOrderRepository.list({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      salesOrderRepository.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  },
};
