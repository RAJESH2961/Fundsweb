import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { inventoryRepository, productRepository } from '../repositories/product.repository';
import { InventoryUpdateSchema, paginationQuery, ProductSchema } from '../validators/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { paginate } from '../utils/response';

export const withAvailable = <T extends { physicalQty: number; reservedQty: number; damagedQty: number }>(
  inv: T,
) => ({ ...inv, availableQty: inv.physicalQty - inv.reservedQty - inv.damagedQty });

export const productService = {
  async create(data: z.infer<typeof ProductSchema>) {
    const existing = await productRepository.findByCode(data.code);
    if (existing) throw new ConflictError('Product code already exists');
    const { physicalQty, ...productData } = data;
    return prisma.$transaction(async (tx) => {
      const product = await productRepository.create(productData, tx);
      await inventoryRepository.create(
        { product: { connect: { id: product.id } }, physicalQty: physicalQty ?? 0 },
        tx,
      );
      return productRepository.findById(product.id, tx);
    });
  },

  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search } = query;
    const where: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      productRepository.list({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      productRepository.count({ where }),
    ]);
    return paginate(
      items.map((p) => ({ ...p, inventory: p.inventory ? withAvailable(p.inventory) : null })),
      total,
      page,
      pageSize,
    );
  },

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  },
};

export const inventoryService = {
  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search } = query;
    const where: Prisma.InventoryWhereInput = search
      ? {
          OR: [
            { product: { name: { contains: search, mode: 'insensitive' } } },
            { product: { code: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      inventoryRepository.list({
        where,
        include: { product: true },
        orderBy: { product: { name: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      inventoryRepository.count({ where }),
    ]);
    return paginate(items.map(withAvailable), total, page, pageSize);
  },

  async update(id: string, data: z.infer<typeof InventoryUpdateSchema>) {
    const inv = await inventoryRepository.findById(id);
    if (!inv) throw new NotFoundError('Inventory record not found');
    const physical = data.physicalQty ?? inv.physicalQty;
    const reserved = data.reservedQty ?? inv.reservedQty;
    const damaged = data.damagedQty ?? inv.damagedQty;
    if (physical < 0 || reserved < 0 || damaged < 0) {
      throw new BadRequestError('Quantities cannot be negative');
    }
    if (reserved + damaged > physical) {
      throw new BadRequestError('Reserved + damaged cannot exceed physical quantity');
    }
    const updated = await inventoryRepository.update(id, data);
    return withAvailable(updated);
  },
};
