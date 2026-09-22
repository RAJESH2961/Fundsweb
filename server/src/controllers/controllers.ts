import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { customerService } from '../services/customer.service';
import { enquiryService } from '../services/enquiry.service';
import { inventoryService, productService } from '../services/product.service';
import { quotationService } from '../services/quotation.service';
import { salesOrderService } from '../services/salesOrder.service';
import { sendSuccess } from '../utils/response';

export const authController = {
  login: async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    sendSuccess(res, result, 'Login successful');
  },
  me: async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);
    sendSuccess(res, user);
  },
  logout: async (_req: Request, res: Response) => {
    sendSuccess(res, null, 'Logged out');
  },
};

export const customerController = {
  create: async (req: Request, res: Response) =>
    sendSuccess(res, await customerService.create(req.body), 'Customer created', 201),
  get: async (req: Request, res: Response) =>
    sendSuccess(res, await customerService.getById(req.params.id)),
  update: async (req: Request, res: Response) =>
    sendSuccess(res, await customerService.update(req.params.id, req.body), 'Customer updated'),
  delete: async (req: Request, res: Response) => {
    await customerService.delete(req.params.id);
    sendSuccess(res, null, 'Customer deleted');
  },
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await customerService.list(req.query as never)),
};

export const productController = {
  create: async (req: Request, res: Response) =>
    sendSuccess(res, await productService.create(req.body), 'Product created', 201),
  get: async (req: Request, res: Response) =>
    sendSuccess(res, await productService.getById(req.params.id)),
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await productService.list(req.query as never)),
};

export const inventoryController = {
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await inventoryService.list(req.query as never)),
  update: async (req: Request, res: Response) =>
    sendSuccess(res, await inventoryService.update(req.params.id, req.body), 'Inventory updated'),
};

export const enquiryController = {
  create: async (req: Request, res: Response) =>
    sendSuccess(res, await enquiryService.create(req.body, req.user!.id), 'Enquiry created', 201),
  get: async (req: Request, res: Response) =>
    sendSuccess(res, await enquiryService.getById(req.params.id)),
  update: async (req: Request, res: Response) =>
    sendSuccess(res, await enquiryService.update(req.params.id, req.body), 'Enquiry updated'),
  setStatus: async (req: Request, res: Response) =>
    sendSuccess(res, await enquiryService.setStatus(req.params.id, req.body.status), 'Status updated'),
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await enquiryService.list(req.query as never)),
};

export const quotationController = {
  create: async (req: Request, res: Response) =>
    sendSuccess(res, await quotationService.create(req.body, req.user!.id), 'Quotation created', 201),
  get: async (req: Request, res: Response) =>
    sendSuccess(res, await quotationService.getById(req.params.id)),
  update: async (req: Request, res: Response) =>
    sendSuccess(res, await quotationService.update(req.params.id, req.body), 'Quotation updated'),
  setStatus: async (req: Request, res: Response) =>
    sendSuccess(res, await quotationService.setStatus(req.params.id, req.body.status), 'Status updated'),
  convert: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.convertFromQuotation(req.params.id), 'Sales order created', 201),
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await quotationService.list(req.query as never)),
};

export const salesOrderController = {
  get: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.getById(req.params.id)),
  confirm: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.confirm(req.params.id), 'Order confirmed'),
  cancel: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.cancel(req.params.id), 'Order cancelled'),
  dispatch: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.dispatch(req.params.id, req.body), 'Order dispatched', 201),
  list: async (req: Request, res: Response) =>
    sendSuccess(res, await salesOrderService.list(req.query as never)),
};
