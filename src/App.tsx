import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { UserRole } from './types';

// Pages - serão criadas em seguida
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';

// Super Admin
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import SuperAdminRestaurants from './pages/super-admin/Restaurants';

// Restaurant Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminMenu from './pages/admin/Menu';
import AdminOrders from './pages/admin/Orders';
import AdminSettings from './pages/admin/Settings';
import AdminDeliveryZones from './pages/admin/DeliveryZones';

// Kitchen
import KitchenDisplay from './pages/kitchen/KitchenDisplay';

// Public - Menu Digital
import PublicMenu from './pages/public/Menu';
import PublicCheckout from './pages/public/Checkout';

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas Públicas */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Cardápio Digital (Público) */}
        <Route path="/:restaurantSlug" element={<PublicMenu />} />
        <Route path="/:restaurantSlug/checkout" element={<PublicCheckout />} />

        {/* Super Admin Routes */}
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

        {/* Restaurant Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/delivery-zones"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminDeliveryZones />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        {/* Kitchen Routes */}
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={[UserRole.KITCHEN]}>
              <KitchenDisplay />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
