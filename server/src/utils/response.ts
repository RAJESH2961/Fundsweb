import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'OK',
  status = 200,
) => res.status(status).json({ success: true, message, data });

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const paginate = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> => ({
  items,
  total,
  page,
  pageSize,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
