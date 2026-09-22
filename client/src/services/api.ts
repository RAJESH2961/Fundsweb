import { api } from '../api/client';
import type {
  ApiResponse,
  Customer,
  Enquiry,
  Inventory,
  Paginated,
  Product,
  Quotation,
  SalesOrder,
  User,
} from '../types';

const unwrap = <T>(p: Promise<{ data: ApiResponse<T> }>) => p.then((r) => r.data.data);

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    unwrap<{ token: string; user: User }>(api.post('/auth/login', { email, password })),
  me: () => unwrap<User>(api.get('/auth/me')),
  logout: () => unwrap<null>(api.post('/auth/logout')),
};

export const customerApi = {
  list: (params: ListParams) => unwrap<Paginated<Customer>>(api.get('/customers', { params })),
  create: (data: Omit<Customer, 'id'>) => unwrap<Customer>(api.post('/customers', data)),
};

export const productApi = {
  list: (params: ListParams) => unwrap<Paginated<Product>>(api.get('/products', { params })),
};

export const inventoryApi = {
  list: (params: ListParams) => unwrap<Paginated<Inventory>>(api.get('/inventory', { params })),
  update: (id: string, data: { physicalQty?: number; reservedQty?: number; damagedQty?: number }) =>
    unwrap<Inventory>(api.patch(`/inventory/${id}`, data)),
};

export const enquiryApi = {
  list: (params: ListParams) => unwrap<Paginated<Enquiry>>(api.get('/enquiries', { params })),
  get: (id: string) => unwrap<Enquiry>(api.get(`/enquiries/${id}`)),
  create: (data: {
    customerId: string;
    requiredDate?: string;
    notes?: string;
    items: { productId: string; quantity: number }[];
  }) => unwrap<Enquiry>(api.post('/enquiries', data)),
  setStatus: (id: string, status: string) =>
    unwrap<Enquiry>(api.patch(`/enquiries/${id}/status`, { status })),
};

export const quotationApi = {
  list: (params: ListParams) => unwrap<Paginated<Quotation>>(api.get('/quotations', { params })),
  get: (id: string) => unwrap<Quotation>(api.get(`/quotations/${id}`)),
  create: (data: {
    enquiryId: string;
    validUntil: string;
    items: { productId: string; quantity: number; unitPrice: number; discountPercent: number; gstPercent: number }[];
  }) => unwrap<Quotation>(api.post('/quotations', data)),
  setStatus: (id: string, status: string) =>
    unwrap<Quotation>(api.patch(`/quotations/${id}/status`, { status })),
  convert: (id: string) => unwrap<SalesOrder>(api.post(`/quotations/${id}/convert`)),
};

export const orderApi = {
  list: (params: ListParams) => unwrap<Paginated<SalesOrder>>(api.get('/sales-orders', { params })),
  get: (id: string) => unwrap<SalesOrder>(api.get(`/sales-orders/${id}`)),
  confirm: (id: string) => unwrap<SalesOrder>(api.post(`/sales-orders/${id}/confirm`)),
  cancel: (id: string) => unwrap<SalesOrder>(api.post(`/sales-orders/${id}/cancel`)),
  dispatch: (id: string, data: { vehicleNumber: string; driverName: string }) =>
    unwrap(api.post(`/sales-orders/${id}/dispatch`, data)),
};
