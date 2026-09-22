import { Prisma } from '@prisma/client';
import { prisma, Tx } from '../prisma/client';

const db = (tx?: Tx) => tx ?? prisma;

export const productRepository = {
  create: (data: Prisma.ProductCreateInput, tx?: Tx) => db(tx).product.create({ data }),
  findById: (id: string, tx?: Tx) => db(tx).product.findUnique({ where: { id } }),
  findByCode: (code: string) => prisma.product.findUnique({ where: { code } }),
  list: (args: Prisma.ProductFindManyArgs) =>
    prisma.product.findMany({ ...args, include: { inventory: true } }) as Promise<
      Prisma.ProductGetPayload<{ include: { inventory: true } }>[]
    >,
  count: (args: Prisma.ProductCountArgs) => prisma.product.count(args),
};

export const inventoryRepository = {
  create: (data: Prisma.InventoryCreateInput, tx?: Tx) => db(tx).inventory.create({ data }),
  findById: (id: string) =>
    prisma.inventory.findUnique({ where: { id }, include: { product: true } }),
  findByProductId: (productId: string, tx?: Tx) =>
    db(tx).inventory.findUnique({ where: { productId } }),
  list: (args: Prisma.InventoryFindManyArgs) => prisma.inventory.findMany(args),
  count: (args: Prisma.InventoryCountArgs) => prisma.inventory.count(args),
  update: (id: string, data: Prisma.InventoryUpdateInput, tx?: Tx) =>
    db(tx).inventory.update({ where: { id }, data }),
  updateByProductId: (productId: string, data: Prisma.InventoryUpdateInput, tx?: Tx) =>
    db(tx).inventory.update({ where: { productId }, data }),
  lockByProductIds: async (productIds: string[], tx: Tx) => {
    const rows = await tx.$queryRaw<
      { id: string; productId: string; physicalQty: number; reservedQty: number; damagedQty: number }[]
    >`SELECT id, "productId", "physicalQty", "reservedQty", "damagedQty"
      FROM inventory WHERE "productId"::text IN (${Prisma.join(productIds)})
      ORDER BY "productId" FOR UPDATE`;
    return rows;
  },
};
