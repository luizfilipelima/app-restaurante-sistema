import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';
import { getSubdomain } from './lib/subdomain';

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
import LandingPage from './pages/landing/LandingPage';

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
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    initialize();
    setSubdomain(getSubdomain());
  }, [initialize]);

  // Tenant Router (pizzaria.quiero.food)
  if (subdomain && !['app', 'www', 'localhost'].includes(subdomain)) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicMenu />} />
          <Route path="/checkout" element={<PublicCheckout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  // App Router (app.quiero.food)
  if (subdomain === 'app') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

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

          {/* Kitchen */}
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

  // Landing Page Router (quiero.food / www.quiero.food)
  // Also keeps support for old path-based routing for dev/testing
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Support for path-based access (e.g. localhost:3000/pizzaria) */}
        <Route path="/:restaurantSlug" element={<PublicMenu />} />
        <Route path="/:restaurantSlug/checkout" element={<PublicCheckout />} />
        
        {/* Redirect /login to app subdomain in production? Or keep it accessible? */}
        {/* For now, let's allow access to login via path if user types it manually, 
            but in production we should redirect to app.quiero.food */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        
        {/* Admin routes accessible via path for dev/testing or if subdomain fails */}
        <Route path="/admin/*" element={
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
