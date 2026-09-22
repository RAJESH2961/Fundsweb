import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  authController,
  customerController,
  enquiryController,
  inventoryController,
  productController,
  quotationController,
  salesOrderController,
} from '../controllers/controllers';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  CustomerSchema,
  CustomerUpdateSchema,
  DispatchSchema,
  EnquirySchema,
  EnquiryStatusSchema,
  EnquiryUpdateSchema,
  InventoryUpdateSchema,
  LoginSchema,
  paginationQuery,
  ProductSchema,
  QuotationSchema,
  QuotationStatusSchema,
  QuotationUpdateSchema,
} from '../validators/schemas';

const router = Router();
const auth = authenticateToken;
const admin = authorizeRoles('ADMIN');
const sales = authorizeRoles('ADMIN', 'SALES_USER');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later' },
});

// Auth
router.post('/auth/login', loginLimiter, validateRequest(LoginSchema), asyncHandler(authController.login));
router.get('/auth/me', auth, asyncHandler(authController.me));
router.post('/auth/logout', auth, asyncHandler(authController.logout));

// Customers
router.post('/customers', auth, sales, validateRequest(CustomerSchema), asyncHandler(customerController.create));
router.get('/customers', auth, validateRequest(paginationQuery, 'query'), asyncHandler(customerController.list));
router.get('/customers/:id', auth, asyncHandler(customerController.get));
router.patch('/customers/:id', auth, sales, validateRequest(CustomerUpdateSchema), asyncHandler(customerController.update));
router.delete('/customers/:id', auth, sales, asyncHandler(customerController.delete));

// Products & Inventory
router.get('/products', auth, validateRequest(paginationQuery, 'query'), asyncHandler(productController.list));
router.get('/products/:id', auth, asyncHandler(productController.get));
router.post('/products', auth, admin, validateRequest(ProductSchema), asyncHandler(productController.create));
router.get('/inventory', auth, validateRequest(paginationQuery, 'query'), asyncHandler(inventoryController.list));
router.patch('/inventory/:id', auth, admin, validateRequest(InventoryUpdateSchema), asyncHandler(inventoryController.update));

// Enquiries
router.post('/enquiries', auth, sales, validateRequest(EnquirySchema), asyncHandler(enquiryController.create));
router.get('/enquiries', auth, validateRequest(paginationQuery, 'query'), asyncHandler(enquiryController.list));
router.get('/enquiries/:id', auth, asyncHandler(enquiryController.get));
router.patch('/enquiries/:id', auth, sales, validateRequest(EnquiryUpdateSchema), asyncHandler(enquiryController.update));
router.patch('/enquiries/:id/status', auth, sales, validateRequest(EnquiryStatusSchema), asyncHandler(enquiryController.setStatus));

// Quotations
router.post('/quotations', auth, sales, validateRequest(QuotationSchema), asyncHandler(quotationController.create));
router.get('/quotations', auth, validateRequest(paginationQuery, 'query'), asyncHandler(quotationController.list));
router.get('/quotations/:id', auth, asyncHandler(quotationController.get));
router.patch('/quotations/:id', auth, sales, validateRequest(QuotationUpdateSchema), asyncHandler(quotationController.update));
router.patch('/quotations/:id/status', auth, sales, validateRequest(QuotationStatusSchema), asyncHandler(quotationController.setStatus));
router.post('/quotations/:id/convert', auth, sales, asyncHandler(quotationController.convert));

// Sales orders & dispatch
router.get('/sales-orders', auth, validateRequest(paginationQuery, 'query'), asyncHandler(salesOrderController.list));
router.get('/sales-orders/:id', auth, asyncHandler(salesOrderController.get));
router.post('/sales-orders/:id/confirm', auth, admin, asyncHandler(salesOrderController.confirm));
router.post('/sales-orders/:id/cancel', auth, admin, asyncHandler(salesOrderController.cancel));
router.post('/sales-orders/:id/dispatch', auth, admin, validateRequest(DispatchSchema), asyncHandler(salesOrderController.dispatch));

export default router;
