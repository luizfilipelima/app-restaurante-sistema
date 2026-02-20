/**
 * Prefetch de chunks de rota ao passar o mouse sobre links.
 * Reduz a latência percebida ao navegar entre telas.
 */

const prefetchCache = new Set<string>();

/** Mapa: segmento da rota → factory de import (mesmo usado pelo lazy) */
const routeLoaders: Record<string, () => Promise<unknown>> = {
  index: () => import('@/pages/admin/Dashboard'),
  orders: () => import('@/pages/admin/Orders'),
  menu: () => import('@/pages/admin/Menu'),
  inventory: () => import('@/pages/admin/Inventory'),
  buffet: () => import('@/pages/admin/Buffet'),
  products: () => import('@/pages/admin/ProductsInventory'),
  tables: () => import('@/pages/admin/Tables'),
  'delivery-zones': () => import('@/pages/admin/DeliveryZones'),
  couriers: () => import('@/pages/admin/Couriers'),
  settings: () => import('@/pages/admin/Settings'),
  cashier: () => import('@/pages/admin/Cashier'),
  'comanda-qr': () => import('@/pages/admin/ComandaQRCode'),
  upgrade: () => import('@/pages/admin/UpgradePage'),
  // Super-admin
  'super-admin': () => import('@/pages/super-admin/SaasMetrics'),
  restaurants: () => import('@/pages/super-admin/Dashboard'),
  plans: () => import('@/pages/super-admin/Plans'),
  'landing-page': () => import('@/pages/super-admin/LandingPageEditor'),
  subscription: () => import('@/pages/super-admin/RestaurantDetails'),
};

const KNOWN_SEGMENTS = new Set(Object.keys(routeLoaders));

function getRouteSegment(href: string): string | null {
  const normalized = href.replace(/\/$/, '') || '/';
  const parts = normalized.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return 'index';
  return KNOWN_SEGMENTS.has(last) ? last : 'index';
}

/**
 * Prefetch do chunk da rota ao passar o mouse sobre o link.
 * Chamar em onMouseEnter do Link. Idempotente (não refaz se já prefetchou).
 */
export function prefetchRoute(href: string): void {
  const segment = getRouteSegment(href);
  if (!segment || prefetchCache.has(segment)) return;

  const loader = routeLoaders[segment];
  if (!loader) return;

  prefetchCache.add(segment);
  loader().catch(() => {
    prefetchCache.delete(segment); // Em caso de erro, permite tentar de novo
  });
}
