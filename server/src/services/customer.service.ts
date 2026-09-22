import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { customerRepository } from '../repositories/customer.repository';
import { CustomerSchema, CustomerUpdateSchema, paginationQuery } from '../validators/schemas';
import { ConflictError, NotFoundError } from '../utils/errors';
import { paginate } from '../utils/response';

type CreateInput = z.infer<typeof CustomerSchema>;
type UpdateInput = z.infer<typeof CustomerUpdateSchema>;

export const customerService = {
  async create(data: CreateInput) {
    const existing = await customerRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('A customer with this email already exists');
    return customerRepository.create(data);
  },

  async getById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  },

  async update(id: string, data: UpdateInput) {
    await this.getById(id);
    if (data.email) {
      const existing = await customerRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('A customer with this email already exists');
      }
    }
    return customerRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return customerRepository.delete(id);
  },

  async list(query: z.infer<typeof paginationQuery>) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { companyName: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const orderable = ['companyName', 'email', 'city', 'createdAt'];
    const orderBy = orderable.includes(sortBy ?? '') ? { [sortBy!]: sortDir } : { createdAt: sortDir };
    const [items, total] = await Promise.all([
      customerRepository.list({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      customerRepository.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  },
};
