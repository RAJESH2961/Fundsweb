import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  variant = 'primary',
  loading,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}) => {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100',
  }[variant];
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
};

export const Input = ({
  label,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
    <input
      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      {...rest}
    />
    {error && <span className="text-xs text-red-600">{error}</span>}
  </div>
);

export const Select = ({
  label,
  error,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
    <select
      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
      {...rest}
    >
      {children}
    </select>
    {error && <span className="text-xs text-red-600">{error}</span>}
  </div>
);

const badgeColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  QUOTED: 'bg-indigo-100 text-indigo-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-gray-200 text-gray-600',
  DRAFT: 'bg-gray-200 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  DISPATCHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

export const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColors[status] ?? 'bg-gray-100 text-gray-600'}`}
  >
    {status}
  </span>
);

export const Modal = ({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}) => (
  <Modal open={open} onClose={onClose} title={title}>
    <p className="mb-5 text-sm text-gray-600">{message}</p>
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onConfirm} loading={loading}>Confirm</Button>
    </div>
  </Modal>
);

export const Pagination = ({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) => (
  <div className="mt-4 flex items-center justify-between text-sm">
    <span className="text-gray-500">Page {page} of {totalPages}</span>
    <div className="flex gap-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  </div>
);

export const Spinner = () => (
  <div className="flex justify-center py-10">
    <Loader2 className="animate-spin text-blue-600" size={28} />
  </div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-400">{message}</div>
);

export const SkeletonRows = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c} className="px-4 py-3">
            <div className="h-4 animate-pulse rounded bg-gray-200" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const DataTable = ({
  headers,
  children,
  loading,
  empty,
  cols,
}: {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  cols?: number;
}) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loading ? <SkeletonRows cols={cols ?? headers.length} /> : children}
      </tbody>
    </table>
    {!loading && empty && <EmptyState message="No records found" />}
  </div>
);
