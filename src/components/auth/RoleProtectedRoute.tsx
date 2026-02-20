import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCanAccess, useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface RoleProtectedRouteProps {
  /**
   * Roles com acesso à rota. Hierarquia é respeitada:
   * usuários com nível superior ao mínimo permitido também passam.
   */
  allowedRoles: string[];
  /** Rota para redirecionar caso o cargo não seja suficiente. */
  redirectTo?: string;
  children: ReactNode;
}

/**
 * Proteção de rota baseada em cargo operacional (RBAC).
 *
 * Deve ser usado como wrapper de páginas dentro do AdminLayout,
 * pois depende do AdminRestaurantContext para identificar o restaurante.
 *
 * Fluxo:
 * 1. Se ainda está carregando o cargo → exibe spinner (evita redirect prematuro).
 * 2. Se o cargo for suficiente → renderiza a página.
 * 3. Se não for suficiente → redireciona para `redirectTo` (padrão: /admin/orders).
 *
 * Exemplo em App.tsx:
 * ```tsx
 * <Route
 *   path="settings"
 *   element={
 *     <RoleProtectedRoute allowedRoles={['restaurant_admin']} redirectTo="/admin/orders">
 *       <AdminSettings />
 *     </RoleProtectedRoute>
 *   }
 * />
 * ```
 */
export function RoleProtectedRoute({
  allowedRoles,
  redirectTo,
  children,
}: RoleProtectedRouteProps) {
  const location = useLocation();
  const { isLoading } = useUserRole();
  const hasAccess = useCanAccess(allowedRoles);

  // Infere o destino de redirect a partir da URL atual:
  //   /{slug}/painel/... → /{slug}/painel/orders
  //   /admin/...         → /admin/orders  (legado)
  const inferredRedirect = (() => {
    if (redirectTo) return redirectTo;
    const m = location.pathname.match(/^\/([^/]+)\/painel/);
    return m ? `/${m[1]}/painel/orders` : '/admin/orders';
  })();

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to={inferredRedirect} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
