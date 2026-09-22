import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { customerApi, enquiryApi, productApi } from '../services/api';
import { apiError } from '../api/client';
import { Button, DataTable, Input, Modal, Pagination, Select, StatusBadge } from '../components/ui';
import type { Enquiry } from '../types';

const STATUSES = ['', 'NEW', 'QUOTED', 'WON', 'LOST'];

interface FormValues {
  customerId: string;
  requiredDate: string;
  notes: string;
  items: { productId: string; quantity: number }[];
}

const EnquiryForm = ({ onClose }: { onClose: () => void }) => {
  const qc = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.list({ pageSize: 100 }),
  });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.list({ pageSize: 100 }),
  });
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { items: [{ productId: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const mutation = useMutation({
    mutationFn: enquiryApi.create,
    onSuccess: () => {
      toast.success('Enquiry created');
      qc.invalidateQueries({ queryKey: ['enquiries'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
      <Select label="Customer" error={errors.customerId?.message}
        {...register('customerId', { required: 'Customer is required' })}>
        <option value="">Select customer…</option>
        {customers?.items.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
      </Select>
      <Input label="Required date" type="date" {...register('requiredDate')} />
      <Input label="Notes" {...register('notes')} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Products</span>
          <Button type="button" variant="secondary" onClick={() => append({ productId: '', quantity: 1 })}>
            <Plus size={14} /> Add row
          </Button>
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="mb-2 flex items-start gap-2">
            <div className="flex-1">
              <Select error={errors.items?.[i]?.productId?.message}
                {...register(`items.${i}.productId`, { required: 'Required' })}>
                <option value="">Select product…</option>
                {products?.items.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <Input type="number" min={1} placeholder="Qty" error={errors.items?.[i]?.quantity?.message}
                {...register(`items.${i}.quantity`, { valueAsNumber: true, min: { value: 1, message: 'Min 1' }, required: 'Required' })} />
            </div>
            <Button type="button" variant="ghost" onClick={() => remove(i)} disabled={fields.length === 1}>
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Create enquiry</Button>
      </div>
    </form>
  );
};

export const EnquiriesPage = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', page, search, status],
    queryFn: () => enquiryApi.list({ page, search: search || undefined, status: status || undefined }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => enquiryApi.setStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['enquiries'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Enquiries</h1>
        <Button onClick={() => setOpen(true)}><Plus size={15} /> New enquiry</Button>
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
        headers={['Enquiry #', 'Customer', 'Date', 'Required', 'Items', 'Status', 'Actions']}
        loading={isLoading}
        empty={!data?.items.length}
      >
        {data?.items.map((e: Enquiry) => (
          <tr key={e.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{e.enquiryNumber}</td>
            <td className="px-4 py-3">{e.customer.companyName}</td>
            <td className="px-4 py-3">{new Date(e.enquiryDate).toLocaleDateString()}</td>
            <td className="px-4 py-3">{e.requiredDate ? new Date(e.requiredDate).toLocaleDateString() : '—'}</td>
            <td className="px-4 py-3">{e.items.length}</td>
            <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
            <td className="px-4 py-3">
              <select
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                value=""
                onChange={(ev) => ev.target.value && statusMutation.mutate({ id: e.id, status: ev.target.value })}
              >
                <option value="">Set status…</option>
                {['NEW', 'QUOTED', 'WON', 'LOST'].filter((s) => s !== e.status).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </DataTable>
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />}

      <Modal open={open} onClose={() => setOpen(false)} title="New Enquiry" wide>
        <EnquiryForm onClose={() => setOpen(false)} />
      </Modal>
    </div>
  );
};
