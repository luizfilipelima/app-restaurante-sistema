import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';
import { getSubdomain } from './lib/subdomain';
import StoreLayout from './layouts/StoreLayout';
import LandingPage from './pages/landing/LandingPage';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/Register';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import SuperAdminLayout from './components/super-admin/SuperAdminLayout';
import SaasMetrics from './pages/super-admin/SaasMetrics';
import SuperAdminRestaurants from './pages/super-admin/Dashboard';
import Plans from './pages/super-admin/Plans';
import AdminLayoutWrapper from './components/admin/AdminLayoutWrapper';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMenu from './pages/admin/Menu';
import AdminOrders from './pages/admin/Orders';
import AdminSettings from './pages/admin/Settings';
import AdminDeliveryZones from './pages/admin/DeliveryZones';
import AdminCouriers from './pages/admin/Couriers';
import AdminBuffet from './pages/admin/Buffet';
import AdminProductsInventory from './pages/admin/ProductsInventory';
import AdminTables from './pages/admin/Tables';
import UpgradePage from './pages/admin/UpgradePage';
import RestaurantDetails from './pages/super-admin/RestaurantDetails';
import KitchenDisplay from './pages/kitchen/KitchenDisplay';
import PublicMenu from './pages/public/Menu';
import PublicCheckout from './pages/public/Checkout';
import MenuViewOnly from './pages/public/MenuViewOnly';
import MenuTable from './pages/public/MenuTable';

const adminRoutes = (
  <>
    <Route index element={<AdminDashboard />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="menu" element={<AdminMenu />} />
    <Route
      path="buffet"
      element={
        <ProtectedRoute requiredFeature="feature_buffet_module">
          <AdminBuffet />
        </ProtectedRoute>
      }
    />
    <Route
      path="products"
      element={
        <RoleProtectedRoute
          allowedRoles={['manager', 'restaurant_admin', 'super_admin']}
          redirectTo="/admin/orders"
        >
          <AdminProductsInventory />
        </RoleProtectedRoute>
      }
    />
    <Route
      path="tables"
      element={
        <ProtectedRoute requiredFeature="feature_tables">
          <AdminTables />
        </ProtectedRoute>
      }
    />
    <Route
      path="delivery-zones"
      element={
        <ProtectedRoute requiredFeature="feature_delivery_zones">
          <AdminDeliveryZones />
        </ProtectedRoute>
      }
    />
    <Route
      path="couriers"
      element={
        <ProtectedRoute requiredFeature="feature_couriers">
          <AdminCouriers />
        </ProtectedRoute>
      }
    />
    <Route
      path="settings"
      element={
        <RoleProtectedRoute
          allowedRoles={['restaurant_admin', 'super_admin']}
          redirectTo="/admin/orders"
        >
          <AdminSettings />
        </RoleProtectedRoute>
      }
    />
    {/* Página de upgrade — exibida quando o usuário tenta acessar uma feature bloqueada */}
    <Route path="upgrade" element={<UpgradePage />} />
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
          <Route path="/login"    element={<PublicRoute><LoginPage />    </PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          {/*
           * ── Super Admin Shell ───────────────────────────────────────────
           * SuperAdminLayout (dark sidebar) envolve as páginas de gestão do SaaS.
           * Rotas filhas são renderizadas via <Outlet /> dentro do layout.
           *
           * Importante: as rotas de detalhe de restaurante (/:identifier) ficam
           * FORA deste grupo pois possuem layouts próprios (AdminLayoutWrapper /
           * RestaurantDetails).  React Router v6 dá preferência às rotas mais
           * específicas, portanto não há conflito.
           */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            {/* index → Dashboard BI (KPIs + gráficos) */}
            <Route index element={<SaasMetrics />} />
            {/* Lista de restaurantes + soft delete */}
            <Route path="restaurants" element={<SuperAdminRestaurants />} />
            {/* Edição de planos e preços */}
            <Route path="plans" element={<Plans />} />
          </Route>

          {/*
           * Gestão de assinatura e features — rota standalone (sem AdminLayout).
           * O parâmetro :identifier aceita tanto o slug amigável do restaurante
           * (ex: "pizzaria-do-joao") quanto o UUID bruto como fallback.
           * A resolução slug → UUID acontece dentro de RestaurantDetails.
           */}
          <Route
            path="/super-admin/restaurants/:identifier/subscription"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <RestaurantDetails />
              </ProtectedRoute>
            }
          />
          {/*
           * Painel do restaurante dentro do AdminLayout (todas as sub-rotas).
           * Mesmo padrão: :identifier pode ser slug ou UUID.
           * A resolução acontece dentro de AdminLayoutWrapper.
           */}
          <Route
            path="/super-admin/restaurants/:identifier"
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
        <Route path="/:restaurantSlug/menu" element={<MenuViewOnly />} />
        <Route path="/:restaurantSlug/cardapio/:tableNumber" element={<MenuTable />} />
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
