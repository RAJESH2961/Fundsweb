import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const links = [
  { to: '/enquiries', label: 'Enquiries' },
  { to: '/quotations', label: 'Quotations' },
  { to: '/sales-orders', label: 'Sales Orders' },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-blue-700">ERP</span>
            <nav className="flex gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {user?.name} <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{user?.role}</span>
            </span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-1 text-gray-500 hover:text-red-600"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
