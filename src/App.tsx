import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';

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

import KitchenDisplay from './pages/kitchen/KitchenDisplay';

import PublicMenu from './pages/public/Menu';
import PublicCheckout from './pages/public/Checkout';

const adminRoutes = (
  <>
    <Route index element={<AdminDashboard />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="menu" element={<AdminMenu />} />
    <Route path="delivery-zones" element={<AdminDeliveryZones />} />
    <Route path="settings" element={<AdminSettings />} />
  </>
);

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/:restaurantSlug" element={<PublicMenu />} />
        <Route path="/:restaurantSlug/checkout" element={<PublicCheckout />} />

        {/* Super Admin */}
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

        {/* Super Admin: gerenciar um restaurante (mesmas funções do admin) */}
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

        {/* Restaurant Admin */}
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

        {/* Cozinha: acessível pelo admin do restaurante (modo cozinha) ou por usuário cozinha legado */}
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={[UserRole.KITCHEN, UserRole.RESTAURANT_ADMIN]}>
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

export default App;
