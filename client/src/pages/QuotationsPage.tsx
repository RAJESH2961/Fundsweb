import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { enquiryApi, productApi, quotationApi } from '../services/api';
import { apiError } from '../api/client';
import { Button, DataTable, Input, Modal, Pagination, Select, StatusBadge } from '../components/ui';
import type { Quotation } from '../types';

const STATUSES = ['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];

interface FormValues {
  enquiryId: string;
  validUntil: string;
  items: { productId: string; quantity: number; unitPrice: number; discountPercent: number; gstPercent: number }[];
}

const money = (v: string | number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const QuotationForm = ({ onClose }: { onClose: () => void }) => {
  const qc = useQueryClient();
  const { data: enquiries } = useQuery({
    queryKey: ['enquiries', 'quotable'],
    queryFn: () => enquiryApi.list({ pageSize: 100, status: 'NEW' }),
  });
  const { data: quotedEnquiries } = useQuery({
    queryKey: ['enquiries', 'quoted'],
    queryFn: () => enquiryApi.list({ pageSize: 100, status: 'QUOTED' }),
  });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.list({ pageSize: 100 }),
  });
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { items: [{ productId: '', quantity: 1, unitPrice: 0, discountPercent: 0, gstPercent: 18 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const total = items.reduce(
    (acc, i) => acc + (i.quantity * i.unitPrice - (i.quantity * i.unitPrice * (i.discountPercent || 0)) / 100) * (1 + (i.gstPercent || 0) / 100),
    0,
  );

  const mutation = useMutation({
    mutationFn: quotationApi.create,
    onSuccess: () => {
      toast.success('Quotation created');
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['enquiries'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const enquiryOptions = [...(enquiries?.items ?? []), ...(quotedEnquiries?.items ?? [])];

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
      <Select label="Enquiry" error={errors.enquiryId?.message}
        {...register('enquiryId', { required: 'Enquiry is required' })}>
        <option value="">
          {enquiryOptions.length ? 'Select enquiry…' : 'No NEW/QUOTED enquiries — create an enquiry first'}
        </option>
        {enquiryOptions.map((e) => (
          <option key={e.id} value={e.id}>{e.enquiryNumber} — {e.customer.companyName}</option>
        ))}
      </Select>
      <Input label="Valid until" type="date" error={errors.validUntil?.message}
        {...register('validUntil', { required: 'Valid-until date is required' })} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Items</span>
          <Button type="button" variant="secondary"
            onClick={() => append({ productId: '', quantity: 1, unitPrice: 0, discountPercent: 0, gstPercent: 18 })}>
            <Plus size={14} /> Add row
          </Button>
        </div>
        <div className="mb-1 grid grid-cols-[1fr_64px_96px_64px_64px_32px] gap-2 text-[10px] font-medium uppercase text-gray-400">
          <span>Product</span><span>Qty</span><span>Unit price</span><span>Disc %</span><span>GST %</span><span />
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="mb-2 grid grid-cols-[1fr_64px_96px_64px_64px_32px] items-start gap-2">
            <Select error={errors.items?.[i]?.productId?.message}
              {...register(`items.${i}.productId`, { required: 'Required' })}>
              <option value="">Select…</option>
              {products?.items.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </Select>
            <Input type="number" min={1} {...register(`items.${i}.quantity`, { valueAsNumber: true, min: 1 })} />
            <Input type="number" min={0} step="0.01" {...register(`items.${i}.unitPrice`, { valueAsNumber: true, min: 0 })} />
            <Input type="number" min={0} max={100} {...register(`items.${i}.discountPercent`, { valueAsNumber: true, min: 0, max: 100 })} />
            <Input type="number" min={0} max={100} {...register(`items.${i}.gstPercent`, { valueAsNumber: true, min: 0, max: 100 })} />
            <Button type="button" variant="ghost" onClick={() => remove(i)} disabled={fields.length === 1}>
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <p className="mt-2 text-right text-sm font-semibold">Estimated total: {money(total)}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Create quotation</Button>
      </div>
    </form>
  );
};

export const QuotationsPage = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page, search, status],
    queryFn: () => quotationApi.list({ page, search: search || undefined, status: status || undefined }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quotations'] });
    qc.invalidateQueries({ queryKey: ['sales-orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => quotationApi.setStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); invalidate(); },
    onError: (e) => toast.error(apiError(e)),
  });

  const convertMutation = useMutation({
    mutationFn: quotationApi.convert,
    onSuccess: () => { toast.success('Sales order created'); invalidate(); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Quotations</h1>
        <Button onClick={() => setOpen(true)}><Plus size={15} /> New quotation</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-64">
          <Input placeholder="Search number or customer…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </Select>
      </div>

      <DataTable
        headers={['Quotation #', 'Enquiry', 'Customer', 'Valid until', 'Total', 'Status', 'Actions']}
        loading={isLoading}
        empty={!data?.items.length}
      >
        {data?.items.map((q: Quotation) => (
          <tr key={q.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{q.quotationNumber}</td>
            <td className="px-4 py-3">{q.enquiry.enquiryNumber}</td>
            <td className="px-4 py-3">{q.customer.companyName}</td>
            <td className="px-4 py-3">{new Date(q.validUntil).toLocaleDateString()}</td>
            <td className="px-4 py-3 font-medium">{money(q.grandTotal)}</td>
            <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  value=""
                  onChange={(ev) => ev.target.value && statusMutation.mutate({ id: q.id, status: ev.target.value })}
                >
                  <option value="">Set status…</option>
                  {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].filter((s) => s !== q.status).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {q.status === 'ACCEPTED' && !q.salesOrder && (
                  <Button variant="secondary" onClick={() => convertMutation.mutate(q.id)}
                    loading={convertMutation.isPending}>
                    Convert
                  </Button>
                )}
                {q.salesOrder && <span className="text-xs text-gray-400">{q.salesOrder.orderNumber}</span>}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />}

      <Modal open={open} onClose={() => setOpen(false)} title="New Quotation" wide>
        <QuotationForm onClose={() => setOpen(false)} />
      </Modal>
    </div>
  );
};
