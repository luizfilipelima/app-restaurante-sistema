import { Outlet, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useResolveRestaurantId } from '@/hooks/useResolveRestaurantId';

/**
 * Envolve o AdminLayout para rotas /admin (restaurant_admin) e
 * /super-admin/restaurants/:identifier (super_admin gerenciando um restaurante).
 *
 * O parâmetro :identifier aceita slug amigável ("pizzaria-do-joao") ou UUID bruto.
 * O hook useResolveRestaurantId resolve o identifier para o UUID real do restaurante,
 * que é necessário para todas as queries do AdminLayout e sub-páginas.
 *
 * Nota sobre o basePath:
 *   O basePath mantém o identifier original (slug ou UUID) da URL, não o UUID resolvido.
 *   Isso garante que todos os links gerados dentro do admin (ex: /admin/orders) continuem
 *   apontando para a URL amigável do restaurante.
 */
export default function AdminLayoutWrapper() {
  // :identifier só existe nas rotas super-admin; nas rotas /admin é undefined.
  const { identifier } = useParams<{ identifier?: string }>();
  const isSuperAdminView = !!identifier;

  /**
   * Resolve o identifier para o UUID real do restaurante.
   *   - Se identifier é UUID → retorna imediatamente (sem network).
   *   - Se identifier é slug → faz lookup no banco (1 query, cacheada 10 min).
   *   - Se identifier é undefined (rota /admin) → restaurantId = null (usa user.restaurant_id).
   */
  const { restaurantId: resolvedId, isLoading } = useResolveRestaurantId(identifier);

  // Mantém o identifier original na URL (slug legível vs UUID bruto).
  const basePath = isSuperAdminView
    ? `/super-admin/restaurants/${identifier}`
    : '/admin';

  /**
   * Aguarda a resolução do slug → UUID antes de montar o AdminLayout.
   * Só acontece na primeira visita com um slug novo; depois é servido do cache.
   */
  if (isSuperAdminView && isLoading) {
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
