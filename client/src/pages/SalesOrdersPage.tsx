import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { inventoryApi, orderApi } from '../services/api';
import { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, ConfirmDialog, DataTable, Input, Modal, Pagination, Select, StatusBadge } from '../components/ui';
import type { SalesOrder } from '../types';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED'];
const money = (v: string | number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const DispatchForm = ({ orderId, onClose }: { orderId: string; onClose: () => void }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<{ vehicleNumber: string; driverName: string }>();
  const mutation = useMutation({
    mutationFn: (v: { vehicleNumber: string; driverName: string }) => orderApi.dispatch(orderId, v),
    onSuccess: () => {
      toast.success('Order dispatched');
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
      <Input label="Vehicle number" error={errors.vehicleNumber?.message}
        {...register('vehicleNumber', { required: 'Vehicle number is required' })} />
      <Input label="Driver name" error={errors.driverName?.message}
        {...register('driverName', { required: 'Driver name is required' })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Dispatch</Button>
      </div>
    </form>
  );
};

const OrderDetail = ({ order, onClose }: { order: SalesOrder; onClose: () => void }) => {
  const { data: inventory } = useQuery({
    queryKey: ['inventory', 'order', order.id],
    queryFn: () => inventoryApi.list({ pageSize: 100 }),
  });
  const invByProduct = new Map(inventory?.items.map((i) => [i.productId, i]) ?? []);
  return (
    <Modal open onClose={onClose} title={`Order ${order.orderNumber}`} wide>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Customer:</span> {order.customer.companyName}</div>
        <div><span className="text-gray-500">Quotation:</span> {order.quotation.quotationNumber}</div>
        <div><span className="text-gray-500">Order date:</span> {new Date(order.orderDate).toLocaleDateString()}</div>
        <div><span className="text-gray-500">Status:</span> <StatusBadge status={order.status} /></div>
      </div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Product', 'Qty', 'Unit price', 'Line total', 'Available stock'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {order.items.map((i) => {
            const inv = invByProduct.get(i.productId);
            return (
              <tr key={i.id}>
                <td className="px-3 py-2">{i.product.code} — {i.product.name}</td>
                <td className="px-3 py-2">{i.quantity}</td>
                <td className="px-3 py-2">{money(i.unitPrice)}</td>
                <td className="px-3 py-2">{money(i.lineAmount)}</td>
                <td className="px-3 py-2">
                  {inv ? (
                    <span className={inv.availableQty < i.quantity ? 'font-semibold text-red-600' : 'text-green-700'}>
                      {inv.availableQty} {inv.availableQty < i.quantity && '(insufficient)'}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-right font-semibold">Total: {money(order.totalAmount)}</p>
      {order.dispatches.length > 0 && (
        <div className="mt-3 rounded bg-green-50 p-3 text-sm">
          Dispatched via {order.dispatches[0].vehicleNumber} ({order.dispatches[0].driverName}) — {order.dispatches[0].dispatchNumber}
        </div>
      )}
    </Modal>
  );
};

export const SalesOrdersPage = () => {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<SalesOrder | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<SalesOrder | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<SalesOrder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, search, status],
    queryFn: () => orderApi.list({ page, search: search || undefined, status: status || undefined }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sales-orders'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  };

  const confirmMutation = useMutation({
    mutationFn: orderApi.confirm,
    onSuccess: () => { toast.success('Order confirmed; inventory reserved'); setConfirmOrder(null); invalidate(); },
    onError: (e) => { toast.error(apiError(e)); setConfirmOrder(null); },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sales Orders</h1>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-64">
          <Input placeholder="Search order # or customer…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </Select>
      </div>

      <DataTable
        headers={['Order #', 'Quotation', 'Customer', 'Date', 'Total', 'Status', 'Actions']}
        loading={isLoading}
        empty={!data?.items.length}
      >
        {data?.items.map((o: SalesOrder) => (
          <tr key={o.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">
              <button className="text-blue-600 hover:underline" onClick={() => setDetail(o)}>{o.orderNumber}</button>
            </td>
            <td className="px-4 py-3">{o.quotation.quotationNumber}</td>
            <td className="px-4 py-3">{o.customer.companyName}</td>
            <td className="px-4 py-3">{new Date(o.orderDate).toLocaleDateString()}</td>
            <td className="px-4 py-3 font-medium">{money(o.totalAmount)}</td>
            <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDetail(o)}>View</Button>
                {isAdmin && o.status === 'PENDING' && (
                  <Button variant="secondary" onClick={() => setConfirmOrder(o)}>Confirm</Button>
                )}
                {isAdmin && o.status === 'CONFIRMED' && (
                  <Button variant="secondary" onClick={() => setDispatchOrder(o)}>Dispatch</Button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />}

      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} />}
      <ConfirmDialog
        open={!!confirmOrder}
        onClose={() => setConfirmOrder(null)}
        onConfirm={() => confirmOrder && confirmMutation.mutate(confirmOrder.id)}
        title="Confirm order"
        message={`Reserve inventory and confirm ${confirmOrder?.orderNumber}? This locks stock atomically and fails if quantities are insufficient.`}
        loading={confirmMutation.isPending}
      />
      <Modal open={!!dispatchOrder} onClose={() => setDispatchOrder(null)} title={`Dispatch ${dispatchOrder?.orderNumber ?? ''}`}>
        {dispatchOrder && <DispatchForm orderId={dispatchOrder.id} onClose={() => setDispatchOrder(null)} />}
      </Modal>
    </div>
  );
};
