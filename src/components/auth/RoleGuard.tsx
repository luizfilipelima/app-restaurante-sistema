import { ReactNode } from 'react';
import { useCanAccess } from '@/hooks/useUserRole';

interface RoleGuardProps {
  /**
   * Lista de roles que têm acesso. A hierarquia é respeitada:
   * roles de nível superior aos listados também têm acesso automaticamente.
   *
   * Exemplo: allowedRoles={['manager']} → manager, restaurant_admin e super_admin passam.
   */
  allowedRoles: string[];
  /** Conteúdo renderizado quando o usuário TEM o cargo necessário. */
  children: ReactNode;
  /**
   * Conteúdo renderizado quando o usuário NÃO tem o cargo.
   * Se omitido, renderiza null (oculta completamente — sem cadeado).
   */
  fallback?: ReactNode;
}

/**
 * Componente de proteção de UI baseado em cargo operacional (RBAC).
 *
 * Diferente do FeatureGuard (que mostra um cadeado para incentivar upgrade),
 * o RoleGuard simplesmente oculta o conteúdo de usuários sem permissão.
 * Um garçom não deve "ver" o botão de cancelar — ele não existe para ele.
 *
 * Deve ser usado dentro da árvore do AdminLayout (AdminRestaurantContext).
 *
 * Exemplo:
 * ```tsx
 * <RoleGuard allowedRoles={['manager', 'restaurant_admin']}>
 *   <Button onClick={cancelOrder}>Cancelar Pedido</Button>
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const hasAccess = useCanAccess(allowedRoles);
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
