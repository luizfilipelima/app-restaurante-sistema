import { Outlet, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useResolveRestaurantId } from '@/hooks/useResolveRestaurantId';

/**
 * Envolve o AdminLayout para três cenários de rota:
 *
 *  1. /:slug/painel/*  (restaurant_admin — URL canônica com slug)
 *     basePath = /{slug}/painel
 *
 *  2. /admin/*  (restaurant_admin — URL legada, mantida para backward compat)
 *     basePath = /admin
 *
 *  3. /super-admin/restaurants/:identifier/*  (super_admin gerenciando um restaurante)
 *     basePath = /super-admin/restaurants/{identifier}
 *
 * O parâmetro :identifier aceita slug amigável ou UUID bruto (super-admin).
 * O parâmetro :slug é sempre um slug amigável (restaurant_admin, URL canônica).
 */
export default function AdminLayoutWrapper() {
  // :identifier → rotas super-admin (/super-admin/restaurants/:identifier)
  // :slug        → rotas canônicas  (/:slug/painel/*)
  const { identifier, slug } = useParams<{ identifier?: string; slug?: string }>();

  const isSuperAdminView = !!identifier;

  /**
   * Resolve o identifier / slug para o UUID real do restaurante.
   * - Se :identifier  → pode ser slug ou UUID (super-admin)
   * - Se :slug        → é sempre slug amigável (restaurant_admin)
   * - Se nenhum       → rota legada /admin (sem parâmetro); restaurantId = null
   */
  const resolveTarget = identifier ?? slug ?? null;
  const { restaurantId: resolvedId, isLoading } = useResolveRestaurantId(resolveTarget);

  /**
   * basePath:
   *  - Super-admin → mantém o identifier original na URL (amigável vs UUID)
   *  - Slug canônico → /{slug}/painel
   *  - Legado /admin → /admin
   */
  const basePath = isSuperAdminView
    ? `/super-admin/restaurants/${identifier}`
    : slug
      ? `/${slug}/painel`
      : '/admin';

  /**
   * Aguarda a resolução do identifier / slug → UUID antes de montar o AdminLayout.
   * Só acontece na primeira visita com um valor novo; depois é servido do cache.
   */
  if ((isSuperAdminView || !!slug) && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Carregando restaurante...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      managedRestaurantId={resolvedId || null}
      basePath={basePath}
    >
      <Outlet />
    </AdminLayout>
  );
}
