import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CustomerSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  contactPerson: z.string().trim().min(1),
  email: z.string().email(),
  mobile: z.string().regex(/^[+]?[\d\s-]{7,15}$/, 'Invalid mobile number'),
  city: z.string().trim().min(1),
});
export const CustomerUpdateSchema = CustomerSchema.partial();

export const ProductSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  basePrice: z.coerce.number().positive(),
  physicalQty: z.coerce.number().int().min(0).optional(),
});

export const InventoryUpdateSchema = z
  .object({
    physicalQty: z.coerce.number().int().min(0).optional(),
    reservedQty: z.coerce.number().int().min(0).optional(),
    damagedQty: z.coerce.number().int().min(0).optional(),
  })
  .refine((v) => v.physicalQty !== undefined || v.reservedQty !== undefined || v.damagedQty !== undefined, {
    message: 'At least one quantity field is required',
  });

const positiveInt = z.coerce.number().int().positive();

export const EnquirySchema = z.object({
  customerId: z.string().uuid(),
  enquiryDate: z.coerce.date().optional(),
  requiredDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: positiveInt,
      }),
    )
    .min(1, 'At least one product is required'),
});
export const EnquiryUpdateSchema = EnquirySchema.partial();
export const EnquiryStatusSchema = z.object({
  status: z.enum(['NEW', 'QUOTED', 'WON', 'LOST']),
});

const pct = z.coerce.number().min(0).max(100);

export const QuotationSchema = z.object({
  enquiryId: z.string().uuid(),
  validUntil: z.coerce.date({ required_error: 'Valid until date is required' }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: positiveInt,
        unitPrice: z.coerce.number().positive(),
        discountPercent: pct.default(0),
        gstPercent: pct.default(0),
      }),
    )
    .min(1, 'At least one item is required'),
});
export const QuotationUpdateSchema = z.object({
  validUntil: z.coerce.date().optional(),
  items: QuotationSchema.shape.items.optional(),
});
export const QuotationStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']),
});

export const SalesOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED']),
});

export const DispatchSchema = z.object({
  dispatchDate: z.coerce.date().optional(),
  vehicleNumber: z.string().trim().min(1, 'Vehicle number is required'),
  driverName: z.string().trim().min(1, 'Driver name is required'),
});
