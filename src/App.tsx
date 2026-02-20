import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';
import { getSubdomain } from './lib/subdomain';
import { lazyWithRetry } from './lib/lazyWithRetry';

// ─── Componentes estruturais — carregam imediatamente (sem lazy) ─────────────
// Layouts, guards e providers fazem parte do shell da aplicação e devem estar
// prontos antes de qualquer rota ser resolvida.
import StoreLayout from './layouts/StoreLayout';
import AdminLayoutWrapper from './components/admin/AdminLayoutWrapper';
import SuperAdminLayout from './components/super-admin/SuperAdminLayout';

// Componente de redirecionamento pós-login (resolve slug → /{slug}/painel)
import AdminRedirect from './components/admin/AdminRedirect';

// ─── Páginas — carregadas sob demanda (lazy) ─────────────────────────────────
// Cada página gera um chunk JS separado no build, reduzindo o bundle inicial.

// Landing page premium (rota /landing-page)
const QuieroFoodLanding     = lazyWithRetry(() => import('./pages/landing/QuieroFoodLanding'));

// Auth
const LandingPage           = lazyWithRetry(() => import('./pages/landing/LandingPage'));
const LoginPage             = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const RegisterPage          = lazyWithRetry(() => import('./pages/auth/Register'));
const UnauthorizedPage      = lazyWithRetry(() => import('./pages/auth/UnauthorizedPage'));

// Super Admin
const SaasMetrics           = lazyWithRetry(() => import('./pages/super-admin/SaasMetrics'));
const SuperAdminRestaurants = lazyWithRetry(() => import('./pages/super-admin/Dashboard'));
const Plans                 = lazyWithRetry(() => import('./pages/super-admin/Plans'));
const RestaurantDetails     = lazyWithRetry(() => import('./pages/super-admin/RestaurantDetails'));
const LandingPageEditor     = lazyWithRetry(() => import('./pages/super-admin/LandingPageEditor'));

// Admin (painel do restaurante)
const AdminDashboard        = lazyWithRetry(() => import('./pages/admin/Dashboard'));
const AdminMenu             = lazyWithRetry(() => import('./pages/admin/Menu'));
const AdminOrders           = lazyWithRetry(() => import('./pages/admin/Orders'));
const AdminSettings         = lazyWithRetry(() => import('./pages/admin/Settings'));
const AdminDeliveryZones    = lazyWithRetry(() => import('./pages/admin/DeliveryZones'));
const AdminCouriers         = lazyWithRetry(() => import('./pages/admin/Couriers'));
const AdminBuffet           = lazyWithRetry(() => import('./pages/admin/Buffet'));
const AdminCashier          = lazyWithRetry(() => import('./pages/admin/Cashier'));
const AdminComandaQRCode    = lazyWithRetry(() => import('./pages/admin/ComandaQRCode'));
const AdminProductsInventory = lazyWithRetry(() => import('./pages/admin/ProductsInventory'));
const AdminInventory         = lazyWithRetry(() => import('./pages/admin/Inventory'));
const AdminTables           = lazyWithRetry(() => import('./pages/admin/Tables'));
const UpgradePage           = lazyWithRetry(() => import('./pages/admin/UpgradePage'));

// Cozinha (KDS) e Expedição (Expo Screen)
const KitchenDisplay        = lazyWithRetry(() => import('./pages/kitchen/KitchenDisplay'));
const ExpoScreen            = lazyWithRetry(() => import('./pages/kitchen/ExpoScreen'));

// Cardápio público
const PublicMenu            = lazyWithRetry(() => import('./pages/public/Menu'));
const PublicCheckout        = lazyWithRetry(() => import('./pages/public/Checkout'));
const MenuViewOnly          = lazyWithRetry(() => import('./pages/public/MenuViewOnly'));
const MenuTable             = lazyWithRetry(() => import('./pages/public/MenuTable'));
const VirtualComanda        = lazyWithRetry(() => import('./pages/public/VirtualComanda'));

// ─── Fallback de carregamento ─────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="relative">
        {/* Anel externo */}
        <div className="h-14 w-14 rounded-full border-4 border-orange-100" />
        {/* Arco animado */}
        <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-transparent border-t-[#F87116] animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-400 tracking-wide">Carregando...</p>
    </div>
  );
}

const adminRoutes = (
  <>
    <Route index element={<AdminDashboard />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="menu" element={<AdminMenu />} />
    <Route path="inventory" element={<AdminInventory />} />
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
    {/* Caixa — leitura de Comandas Digitais e encerramento (Enterprise) */}
    <Route path="cashier" element={<AdminCashier />} />
    {/* QR Code para impressão — link de entrada das Comandas Digitais (Enterprise) */}
    <Route path="comanda-qr" element={<AdminComandaQRCode />} />
    {/* Página de upgrade — exibida quando o usuário tenta acessar uma feature bloqueada */}
    <Route path="upgrade" element={<UpgradePage />} />
  </>
);

/** Subdomínios que devem mostrar o painel admin (login, dashboard, cozinha). */
const ADMIN_SUBDOMAINS = ['app', 'admin'];

/** Roles com acesso ao Display de Cozinha */
const KDS_ROLES = [UserRole.KITCHEN, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN];

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const [subdomain, setSubdomain] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    initialize();
    setSubdomain(getSubdomain());
  }, [initialize]);

  // Aguarda definir o hostname (evita flash no primeiro paint)
  if (subdomain === undefined) {
    return null;
  }

  const isAdminSubdomain = subdomain !== null && ADMIN_SUBDOMAINS.includes(subdomain);

  // 1) Subdomínio kds (kds.quiero.food) → Display de Cozinha por slug
  //    kds.quiero.food/pizzaria-da-vitoria  →  KitchenDisplay com slug = "pizzaria-da-vitoria"
  if (subdomain === 'kds') {
    return (
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Login no próprio subdomínio kds para redirecionar de volta após autenticação */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            {/*
             * Rota principal do KDS: /:slug
             * O componente KitchenDisplay lê o slug via useParams(),
             * resolve o restaurant_id e se inscreve no canal Realtime correto.
             */}
            <Route
              path="/:slug"
              element={
                <ProtectedRoute allowedRoles={KDS_ROLES}>
                  <KitchenDisplay />
                </ProtectedRoute>
              }
            />

            {/* Raiz sem slug → redireciona para login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <Toaster />
      </BrowserRouter>
    );
  }

  // 2) Subdomínio de loja (ex.: pizzaria.quiero.food) -> StoreLayout (cardápio)
  if (subdomain !== null && !isAdminSubdomain) {
    return <StoreLayout tenantSlug={subdomain} />;
  }

  // 3) Subdomínio app/admin -> painel (login, dashboard, cozinha)
  if (isAdminSubdomain) {
    return (
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login"    element={<PublicRoute><LoginPage />    </PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          {/* Comanda Digital — rota pública para clientes que escaneiam QR (app. ou quiero.) */}
          <Route path="/:restaurantSlug/comanda" element={<VirtualComanda />} />
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
            {/* Editor de conteúdo da landing page */}
            <Route path="landing-page" element={<LandingPageEditor />} />
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
          {/*
           * ── Painel do restaurante (URL canônica com slug) ─────────────────
           * /:slug/painel/* — AdminLayoutWrapper lê :slug e define basePath
           */}
          <Route
            path="/:slug/painel"
            element={
              <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
                <AdminLayoutWrapper />
              </ProtectedRoute>
            }
          >
            {adminRoutes}
          </Route>

          {/* /:slug/kds — Display de Cozinha para o restaurante */}
          <Route
            path="/:slug/kds"
            element={
              <ProtectedRoute allowedRoles={KDS_ROLES}>
                <KitchenDisplay />
              </ProtectedRoute>
            }
          />

          {/* /:slug/garcom — Expo Screen (Tela do Garçom / Expedição) */}
          <Route
            path="/:slug/garcom"
            element={
              <ProtectedRoute allowedRoles={KDS_ROLES}>
                <ExpoScreen />
              </ProtectedRoute>
            }
          />

          {/*
           * Rotas legadas /admin, /kitchen, /expo — redirecionam para as URLs
           * canônicas com slug. Mantidas para backward compat (bookmarks, links antigos).
           */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
                <AdminRedirect />
              </ProtectedRoute>
            }
          />
          {/* /admin/* — sub-rotas legadas (upgrade, register redirect, etc.) */}
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
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute allowedRoles={KDS_ROLES}>
                <KitchenDisplay />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expo"
            element={
              <ProtectedRoute allowedRoles={KDS_ROLES}>
                <ExpoScreen />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        <Toaster />
      </BrowserRouter>
    );
  }

  // 4) Domínio principal (quiero.food, localhost) -> Landing + rotas legado (path-based)
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* Landing page premium — deve vir ANTES de /:restaurantSlug para não ser capturada como slug */}
        <Route path="/landing-page" element={<QuieroFoodLanding />} />
        <Route path="/:restaurantSlug" element={<PublicMenu />} />
        <Route path="/:restaurantSlug/menu" element={<MenuViewOnly />} />
        <Route path="/:restaurantSlug/cardapio/:tableNumber" element={<MenuTable />} />
        <Route path="/:restaurantSlug/checkout" element={<PublicCheckout />} />
        {/* Comanda Digital (Enterprise): cliente abre e acompanha a sua comanda */}
        <Route path="/:restaurantSlug/comanda" element={<VirtualComanda />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

        {/* Painel do restaurante — URL canônica com slug (domínio principal) */}
        <Route
          path="/:slug/painel"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}>
              <AdminLayoutWrapper />
            </ProtectedRoute>
          }
        >
          {adminRoutes}
        </Route>
        <Route
          path="/:slug/kds"
          element={
            <ProtectedRoute allowedRoles={KDS_ROLES}>
              <KitchenDisplay />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:slug/garcom"
          element={
            <ProtectedRoute allowedRoles={KDS_ROLES}>
              <ExpoScreen />
            </ProtectedRoute>
          }
        />

        {/* Rotas legadas */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={[UserRole.RESTAURANT_ADMIN]}><AdminRedirect /></ProtectedRoute>} />
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
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={KDS_ROLES}>
              <KitchenDisplay />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expo"
          element={
            <ProtectedRoute allowedRoles={KDS_ROLES}>
              <ExpoScreen />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
