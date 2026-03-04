import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/_routing/ProtectedRoute';
import { PublicRoute } from './components/_routing/PublicRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import { ErrorBoundary } from './components/_routing/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { UserRole } from './types';
import { getTenantFromHostname } from './lib/core/subdomain';
import { lazyWithRetry } from './lib/core/lazyWithRetry';

// ─── Componentes estruturais — carregam imediatamente (sem lazy) ─────────────
// Layouts, guards e providers fazem parte do shell da aplicação e devem estar
// prontos antes de qualquer rota ser resolvida.
import StoreLayout from './layouts/StoreLayout';
import AdminLayoutWrapper from './components/admin/_layout/AdminLayoutWrapper';
import SuperAdminLayout from './components/super-admin/SuperAdminLayout';

// Componente de redirecionamento pós-login (resolve slug → /{slug}/painel)
import AdminRedirect from './components/admin/_layout/AdminRedirect';
import MenuThemeWrapper from './components/public/menu/MenuThemeWrapper';

// ─── Páginas — carregadas sob demanda (lazy) ─────────────────────────────────
// Cada página gera um chunk JS separado no build, reduzindo o bundle inicial.

// Página de vendas principal (rota /pagina-ptbr)
const PaginaPtBr            = lazyWithRetry(() => import('./pages/landing/PaginaPtBr'));

// Auth
const LandingPage           = lazyWithRetry(() => import('./pages/landing/LandingPage'));
const LoginPage             = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const RegisterPage          = lazyWithRetry(() => import('./pages/auth/Register'));
const UnauthorizedPage      = lazyWithRetry(() => import('./pages/auth/UnauthorizedPage'));

// Super Admin
const SaasMetrics           = lazyWithRetry(() => import('./pages/super-admin/overview/SaasMetrics'));
const SuperAdminRestaurants = lazyWithRetry(() => import('./pages/super-admin/restaurants/Dashboard'));
const Plans                 = lazyWithRetry(() => import('./pages/super-admin/plans/Plans'));
const RestaurantDetails     = lazyWithRetry(() => import('./pages/super-admin/restaurants/RestaurantDetails'));
const LandingPageEditor     = lazyWithRetry(() => import('./pages/super-admin/landing/LandingPageEditor'));

// Admin (painel do restaurante) — estrutura alinhada ao sidebar
const AdminDashboard        = lazyWithRetry(() => import('./pages/admin/overview/Dashboard'));
const AdminMenu             = lazyWithRetry(() => import('./pages/admin/menu-stock/Menu'));
const AdminOffers           = lazyWithRetry(() => import('./pages/admin/marketing-sales/Offers'));
const AdminCoupons          = lazyWithRetry(() => import('./pages/admin/marketing-sales/Coupons'));
const AdminLoyalty          = lazyWithRetry(() => import('./pages/admin/marketing-sales/Loyalty'));
const AdminOrders           = lazyWithRetry(() => import('./pages/admin/delivery-logistics/Orders'));
const AdminSettings         = lazyWithRetry(() => import('./pages/admin/_shared/Settings'));
const AdminDeliveryZones    = lazyWithRetry(() => import('./pages/admin/delivery-logistics/DeliveryZones'));
const AdminHorarios         = lazyWithRetry(() => import('./pages/admin/delivery-logistics/Horarios'));
const AdminCouriers         = lazyWithRetry(() => import('./pages/admin/delivery-logistics/Couriers'));
const AdminBuffet           = lazyWithRetry(() => import('./pages/admin/hall-pdv/Buffet'));
const AdminCashier          = lazyWithRetry(() => import('./pages/admin/hall-pdv/Cashier'));
const AdminComandaQRCode    = lazyWithRetry(() => import('./pages/admin/_shared/ComandaQRCode'));
const AdminProductsInventory = lazyWithRetry(() => import('./pages/admin/menu-stock/ProductsInventory'));
const AdminInventory         = lazyWithRetry(() => import('./pages/admin/menu-stock/Inventory'));
const AdminTables           = lazyWithRetry(() => import('./pages/admin/hall-pdv/Tables'));
const AdminReservations     = lazyWithRetry(() => import('./pages/admin/hall-pdv/Reservations'));
const WaiterTerminal        = lazyWithRetry(() => import('./pages/admin/_shared/WaiterTerminal'));
const UpgradePage           = lazyWithRetry(() => import('./pages/admin/_shared/UpgradePage'));

// Cozinha (KDS) e Expedição (Expo Screen)
const KitchenDisplay        = lazyWithRetry(() => import('./pages/kitchen/KitchenDisplay'));
const ExpoScreen            = lazyWithRetry(() => import('./pages/kitchen/ExpoScreen'));

// Cardápio público
const PublicMenu            = lazyWithRetry(() => import('./pages/public/menu/Menu'));
const PublicCheckout        = lazyWithRetry(() => import('./pages/public/checkout/Checkout'));
const MenuViewOnly          = lazyWithRetry(() => import('./pages/public/menu/MenuViewOnly'));
const MenuTable             = lazyWithRetry(() => import('./pages/public/menu/MenuTable'));
const VirtualComanda        = lazyWithRetry(() => import('./pages/public/comanda/VirtualComanda'));
const OrderTracking         = lazyWithRetry(() => import('./pages/public/orders/OrderTracking'));
const PublicReservation     = lazyWithRetry(() => import('./pages/public/reservation/PublicReservation'));
const PublicWaitingQueue    = lazyWithRetry(() => import('./pages/public/reservation/PublicWaitingQueue'));
const OrderConfirmation     = lazyWithRetry(() => import('./pages/public/checkout/OrderConfirmation'));
const LinkBio               = lazyWithRetry(() => import('./pages/public/link-bio/LinkBio'));
const LinkBioAbout          = lazyWithRetry(() => import('./pages/public/link-bio/LinkBioAbout'));

// ─── Fallback de carregamento ─────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
      <div className="h-10 w-10 rounded-full border-2 border-orange-100 border-t-[#F87116] animate-spin" />
      <p className="text-xs font-medium text-slate-400">Carregando...</p>
    </div>
  );
}

const adminRoutes = (
  <>
    {/* Dashboard financeiro — somente proprietário e acima */}
    <Route
      index
      element={
        <RoleProtectedRoute allowedRoles={['owner', 'restaurant_admin', 'super_admin']}>
          <AdminDashboard />
        </RoleProtectedRoute>
      }
    />
    {/* Pedidos — garçom e acima (cozinha fica no KDS) */}
    <Route
      path="orders"
      element={
        <RoleProtectedRoute allowedRoles={['waiter']}>
          <AdminOrders />
        </RoleProtectedRoute>
      }
    />
    {/* Cardápio — gerente e acima */}
    <Route
      path="menu"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminMenu />
        </RoleProtectedRoute>
      }
    />
    {/* Gestão de Ofertas */}
    <Route
      path="offers"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminOffers />
        </RoleProtectedRoute>
      }
    />
    {/* Cupons de Desconto */}
    <Route
      path="coupons"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminCoupons />
        </RoleProtectedRoute>
      }
    />
    {/* Programa de Fidelidade */}
    <Route
      path="loyalty"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminLoyalty />
        </RoleProtectedRoute>
      }
    />
    {/* Estoque — gerente e acima */}
    <Route
      path="inventory"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminInventory />
        </RoleProtectedRoute>
      }
    />
    {/* Buffet — caixa e acima + feature flag */}
    <Route
      path="buffet"
      element={
        <ProtectedRoute requiredFeature="feature_buffet_module">
          <RoleProtectedRoute allowedRoles={['cashier']}>
            <AdminBuffet />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    <Route
      path="products"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminProductsInventory />
        </RoleProtectedRoute>
      }
    />
    <Route
      path="tables"
      element={
        <ProtectedRoute requiredFeature="feature_tables">
          <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
            <AdminTables />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    {/* Reservas — gerente e acima + feature flag */}
    <Route
      path="reservations"
      element={
        <ProtectedRoute requiredFeature="feature_reservations">
          <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin', 'cashier']}>
            <AdminReservations />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    <Route
      path="delivery-zones"
      element={
        <ProtectedRoute requiredFeature="feature_delivery_zones">
          <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
            <AdminDeliveryZones />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    <Route
      path="horarios"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
          <AdminHorarios />
        </RoleProtectedRoute>
      }
    />
    <Route
      path="couriers"
      element={
        <ProtectedRoute requiredFeature="feature_couriers">
          <RoleProtectedRoute allowedRoles={['manager', 'restaurant_admin', 'super_admin']}>
            <AdminCouriers />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    {/* Configurações — gerente, proprietário e acima */}
    <Route
      path="settings"
      element={
        <RoleProtectedRoute allowedRoles={['manager', 'owner', 'restaurant_admin', 'super_admin']}>
          <AdminSettings />
        </RoleProtectedRoute>
      }
    />
    {/* Caixa — caixa e acima + feature flag (proteção na rota alinhada a Buffet/Mesas/etc.) */}
    <Route
      path="cashier"
      element={
        <ProtectedRoute requiredFeature="feature_virtual_comanda">
          <RoleProtectedRoute allowedRoles={['cashier']}>
            <AdminCashier />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    {/* QR Code para impressão — caixa e acima + feature flag */}
    <Route
      path="comanda-qr"
      element={
        <ProtectedRoute requiredFeature="feature_virtual_comanda">
          <RoleProtectedRoute allowedRoles={['cashier']}>
            <AdminComandaQRCode />
          </RoleProtectedRoute>
        </ProtectedRoute>
      }
    />
    {/* Página de upgrade — somente proprietário/admin */}
    <Route
      path="upgrade"
      element={
        <RoleProtectedRoute allowedRoles={['owner', 'restaurant_admin', 'super_admin']}>
          <UpgradePage />
        </RoleProtectedRoute>
      }
    />
  </>
);

/** Subdomínios que devem mostrar o painel admin (login, dashboard, cozinha). */
const ADMIN_SUBDOMAINS = ['app', 'admin'];

/** Roles com acesso ao Display de Cozinha */
const KDS_ROLES = [UserRole.KITCHEN, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN];

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const [tenantSlug, setTenantSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    initialize();
    getTenantFromHostname().then(setTenantSlug);
  }, [initialize]);

  // Aguarda definir o tenant (evita flash no primeiro paint)
  if (tenantSlug === undefined) {
    return <LoadingScreen />;
  }

  const isAdminSubdomain = tenantSlug !== null && ADMIN_SUBDOMAINS.includes(tenantSlug);

  // 1) Subdomínio kds (kds.quiero.food) → Display de Cozinha por slug
  //    kds.quiero.food/pizzaria-da-vitoria  →  KitchenDisplay com slug = "pizzaria-da-vitoria"
  if (tenantSlug === 'kds') {
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

  // 2) Subdomínio de loja ou domínio personalizado (ex.: pizzaria.quiero.food, cardapio.cliente.com) -> StoreLayout (cardápio)
  if (tenantSlug !== null && !isAdminSubdomain) {
    return (
      <ErrorBoundary>
        <StoreLayout tenantSlug={tenantSlug} />
        <Toaster />
      </ErrorBoundary>
    );
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
          {/* Cardápio público — ao clicar "Cardápio" no painel, abre em nova aba */}
          <Route path="/:restaurantSlug" element={<MenuThemeWrapper />}>
            <Route index element={<PublicMenu />} />
            <Route path="menu" element={<MenuViewOnly />} />
            <Route path="cardapio/:tableNumber" element={<MenuTable />} />
            <Route path="checkout" element={<PublicCheckout />} />
            <Route path="order-confirmed" element={<OrderConfirmation />} />
            <Route path="comanda" element={<VirtualComanda />} />
            {/* Rastreamento de Pedido — rota pública para acompanhamento em tempo real */}
            <Route path="track/:orderId" element={<OrderTracking />} />
            {/* Link da Bio */}
            <Route path="bio" element={<LinkBio />} />
            <Route path="bio/sobre" element={<LinkBioAbout />} />
          </Route>
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
          {/* /:slug/terminal-garcom — Terminal do Garçom (Operação de Mesas) */}
          <Route
            path="/:slug/terminal-garcom"
            element={
              <ProtectedRoute allowedRoles={[UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN]}>
                <WaiterTerminal />
              </ProtectedRoute>
            }
          />
          {/* /terminal-garcom — fallback com restaurant_id na query */}
          <Route
            path="/terminal-garcom"
            element={
              <ProtectedRoute allowedRoles={[UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN]}>
                <WaiterTerminal />
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
        {/* Página de vendas principal PT-BR (Hyper Professional Enterprise) */}
        <Route path="/pagina-ptbr" element={<PaginaPtBr />} />
        <Route path="/:restaurantSlug" element={<MenuThemeWrapper />}>
          <Route index element={<PublicMenu />} />
          <Route path="menu" element={<MenuViewOnly />} />
          <Route path="cardapio/:tableNumber" element={<MenuTable />} />
          <Route path="checkout" element={<PublicCheckout />} />
          <Route path="order-confirmed" element={<OrderConfirmation />} />
          {/* Comanda Digital (Enterprise): cliente abre e acompanha a sua comanda */}
          <Route path="comanda" element={<VirtualComanda />} />
          {/* Reserva e Fila de Espera — Fase 2 e 3 */}
          <Route path="reservar" element={<PublicReservation />} />
          <Route path="fila" element={<PublicWaitingQueue />} />
          {/* Rastreamento de Pedido — rota pública para acompanhamento em tempo real */}
          <Route path="track/:orderId" element={<OrderTracking />} />
          {/* Link da Bio para Instagram */}
          <Route path="bio" element={<LinkBio />} />
          <Route path="bio/sobre" element={<LinkBioAbout />} />
        </Route>
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
        {/* Terminal do Garçom — garçom acessa só esta tela (sem painel) */}
        <Route
          path="/:slug/terminal-garcom"
          element={
            <ProtectedRoute allowedRoles={[UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN]}>
              <WaiterTerminal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terminal-garcom"
          element={
            <ProtectedRoute allowedRoles={[UserRole.WAITER, UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN]}>
              <WaiterTerminal />
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
