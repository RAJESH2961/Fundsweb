export type Role = 'ADMIN' | 'SALES_USER';
export type EnquiryStatus = 'NEW' | 'QUOTED' | 'WON' | 'LOST';
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  city: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  basePrice: string;
  inventory?: Inventory | null;
}

export interface Inventory {
  id: string;
  productId: string;
  physicalQty: number;
  reservedQty: number;
  damagedQty: number;
  availableQty: number;
  product?: Product;
}

export interface EnquiryItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Enquiry {
  id: string;
  enquiryNumber: string;
  customerId: string;
  customer: Customer;
  enquiryDate: string;
  requiredDate?: string;
  notes?: string;
  status: EnquiryStatus;
  items: EnquiryItem[];
}

export interface QuotationItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
  lineAmount: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  enquiryId: string;
  enquiry: { id: string; enquiryNumber: string };
  customerId: string;
  customer: Customer;
  validUntil: string;
  grandTotal: string;
  status: QuotationStatus;
  items: QuotationItem[];
  salesOrder?: { id: string; orderNumber: string; status: OrderStatus } | null;
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: string;
  lineAmount: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  quotationId: string;
  quotation: { id: string; quotationNumber: string };
  customerId: string;
  customer: Customer;
  orderDate: string;
  totalAmount: string;
  status: OrderStatus;
  items: SalesOrderItem[];
  dispatches: Dispatch[];
}

export interface Dispatch {
  id: string;
  dispatchNumber: string;
  dispatchDate: string;
  vehicleNumber: string;
  driverName: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: { path: string; message: string }[];
}
