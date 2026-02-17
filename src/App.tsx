import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';
import { getSubdomain } from './lib/subdomain';
import StoreLayout from './layouts/StoreLayout';
import LandingPage from './pages/landing/LandingPage';

import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import SuperAdminRestaurants from './pages/super-admin/Restaurants';
import AdminLayoutWrapper from './components/admin/AdminLayoutWrapper';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMenu from './pages/admin/Menu';
import AdminOrders from './pages/admin/Orders';
import AdminSettings from './pages/admin/Settings';
import AdminDeliveryZones from './pages/admin/DeliveryZones';
import AdminCouriers from './pages/admin/Couriers';
import KitchenDisplay from './pages/kitchen/KitchenDisplay';
import PublicMenu from './pages/public/Menu';
import PublicCheckout from './pages/public/Checkout';

const adminRoutes = (
  <>
    <Route index element={<AdminDashboard />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="menu" element={<AdminMenu />} />
    <Route path="delivery-zones" element={<AdminDeliveryZones />} />
    <Route path="couriers" element={<AdminCouriers />} />
    <Route path="settings" element={<AdminSettings />} />
  </>
);

/** Subdomínios que devem mostrar o painel admin (login, dashboard, cozinha). */
const ADMIN_SUBDOMAINS = ['app', 'admin'];

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const [subdomain, setSubdomain] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    initialize();
    setSubdomain(getSubdomain());
  }, [initialize]);

  // Aguarda definir o hostname (evita flash no primeiro paint)
  if (subdomain === undefined) {
    return null; // ou um <Skeleton /> global se preferir
  }

  const isAdminSubdomain = subdomain !== null && ADMIN_SUBDOMAINS.includes(subdomain);

  // 1) Subdomínio de loja (ex.: pizzaria.quiero.food) -> StoreLayout (cardápio)
  if (subdomain !== null && !isAdminSubdomain) {
    return <StoreLayout tenantSlug={subdomain} />;
  }

  // 2) Subdomínio app/admin -> painel (login, dashboard, cozinha)
  if (isAdminSubdomain) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/restaurants"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <SuperAdminRestaurants />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/restaurants/:restaurantId"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <AdminLayoutWrapper />
              </ProtectedRoute>
            }
          >
            {adminRoutes}
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
                <AdminLayoutWrapper />
              </ProtectedRoute>
            }
          >
            {adminRoutes}
          </Route>
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute allowedRoles={[UserRole.KITCHEN, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN]}>
                <KitchenDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  // 3) Domínio principal (quiero.food, localhost) -> Landing + rotas legado (path-based)
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/:restaurantSlug" element={<PublicMenu />} />
        <Route path="/:restaurantSlug/checkout" element={<PublicCheckout />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminLayoutWrapper />
            </ProtectedRoute>
          }
        >
          {adminRoutes}
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
