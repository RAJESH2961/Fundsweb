import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { SalesOrdersPage } from './pages/SalesOrdersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/enquiries" element={<EnquiriesPage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/sales-orders" element={<SalesOrdersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/enquiries" replace />} />
    </Routes>
  );
}
