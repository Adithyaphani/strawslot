import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './lib/i18n';
import { AdminI18nProvider } from './lib/adminI18n';
import { ToastProvider, Spinner } from './components/ui';
import { session } from './lib/api';

import Landing from './pages/Landing';
import FarmerLayout from './pages/farmer/FarmerLayout';
import FarmerHome from './pages/farmer/FarmerHome';
import Register from './pages/farmer/Register';
import MySlot from './pages/farmer/MySlot';
import StrawCalc from './pages/farmer/StrawCalc';
import Login from './pages/admin/Login';

// Officer pages pull in the map and charts, so they load on demand.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Dispatch = lazy(() => import('./pages/admin/Dispatch'));
const Alerts = lazy(() => import('./pages/admin/Alerts'));
const Fields = lazy(() => import('./pages/admin/Fields'));
const WhatIf = lazy(() => import('./pages/admin/WhatIf'));
const Registry = lazy(() => import('./pages/admin/Registry'));
const Activity = lazy(() => import('./pages/admin/Activity'));
const Methodology = lazy(() => import('./pages/Methodology'));

function RequireOfficer({ children }) {
  return session.token() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <I18nProvider>
      <AdminI18nProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/farmer" element={<FarmerLayout />}>
              <Route index element={<FarmerHome />} />
              <Route path="register" element={<Register />} />
              <Route path="slot" element={<MySlot />} />
              <Route path="calculator" element={<StrawCalc />} />
            </Route>
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<RequireOfficer><AdminLayout /></RequireOfficer>}>
              <Route index element={<Dashboard />} />
              <Route path="dispatch" element={<Dispatch />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="fields" element={<Fields />} />
              <Route path="what-if" element={<WhatIf />} />
              <Route path="registry" element={<Registry />} />
              <Route path="activity" element={<Activity />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AdminI18nProvider>
      </I18nProvider>
    </ToastProvider>
  );
}
