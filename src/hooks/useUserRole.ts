/**
 * Controle de Acesso Baseado em Cargos (RBAC) — nível operacional.
 *
 * Hierarquia de roles (nível crescente de permissão):
 *   kitchen (10) < waiter (20) < cashier (30) < manager (50) < owner/restaurant_admin (80) < super_admin (100)
 *
 * Fonte do cargo efetivo (prioridade):
 *   1. `restaurant_user_roles` (cargo granular atribuído no restaurante)
 *   2. `users.role` (role global do usuário no sistema)
 *
 * Se o usuário tiver `users.role = 'restaurant_admin'` e não houver entrada
 * em `restaurant_user_roles`, ele é tratado como nível máximo (owner).
 * Isso garante compatibilidade retroativa para usuários já existentes.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { supabase } from '@/lib/supabase';

// ─── Hierarquia numérica de roles ────────────────────────────────────────────

export const ROLE_LEVEL: Record<string, number> = {
  kitchen:          10,
  waiter:           20,
  cashier:          30,
  manager:          50,
  owner:            80,
  restaurant_admin: 80,  // equivalente a owner
  super_admin:      100,
};

/**
 * Verifica se um cargo satisfaz os roles permitidos, levando a hierarquia em conta.
 * Ex: canAccess('manager', ['manager']) === true
 *     canAccess('restaurant_admin', ['manager']) === true   (admin >= manager)
 *     canAccess('waiter', ['manager']) === false
 */
export function canAccess(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_LEVEL[userRole] ?? 0;
  // Nível mínimo exigido pelos roles permitidos
  const minRequired = Math.min(...allowedRoles.map((r) => ROLE_LEVEL[r] ?? Infinity));

  return userLevel >= minRequired;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

/**
 * Retorna o cargo efetivo do usuário atual dentro do restaurante ativo.
 *
 * - Para `super_admin`: retorna 'super_admin' imediatamente (sem query).
 * - Para outros: tenta ler `restaurant_user_roles`. Se não houver entrada,
 *   usa o `users.role` como fallback (garantia de retrocompatibilidade).
 */
export function useUserRole() {
  const { user } = useAuthStore();
  const restaurantId = useAdminRestaurantId();

  const isSuperAdmin = user?.role === 'super_admin';

  const { data: granularRole, isLoading } = useQuery<string | null>({
    queryKey: ['user-role', restaurantId, user?.id],
    queryFn: async () => {
      if (!restaurantId || !user?.id) return null;

      const { data } = await supabase
        .from('restaurant_user_roles')
        .select('role')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      return data?.role ?? null;
    },
    enabled: !!user?.id && !!restaurantId && !isSuperAdmin,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  });

  // Cargo efetivo: cargo granular > cargo global do usuário
  const effectiveRole: string | null = isSuperAdmin
    ? 'super_admin'
    : (granularRole ?? user?.role ?? null);

  return {
    role: effectiveRole,
    isLoading: !isSuperAdmin && isLoading,
  };
}

// ─── Hook auxiliar de verificação ────────────────────────────────────────────

/**
 * Retorna `true` se o usuário atual tem acesso a pelo menos um dos roles listados,
 * respeitando a hierarquia (admin sempre passa se manager for permitido).
 *
 * Durante o carregamento retorna `true` (otimista) para evitar flash de UI.
 */
export function useCanAccess(allowedRoles: string[]): boolean {
  const { role, isLoading } = useUserRole();
  if (isLoading) return true;  // otimista durante o carregamento
  return canAccess(role, allowedRoles);
}

// ─── Roles de uso frequente (constantes exportadas) ──────────────────────────

/** Roles que podem ver e gerenciar configurações sensíveis do restaurante */
export const ROLES_ADMIN_ONLY = ['restaurant_admin', 'super_admin'] as const;

/** Roles que podem gerenciar cardápio, produtos e operações */
export const ROLES_MANAGER_UP = ['manager', 'restaurant_admin', 'super_admin'] as const;

/** Roles que podem ver e atualizar pedidos */
export const ROLES_ORDERS_READ = ['waiter', 'cashier', 'manager', 'restaurant_admin', 'super_admin'] as const;

/** Roles que podem cancelar pedidos */
export const ROLES_CANCEL_ORDER = ['manager', 'restaurant_admin', 'super_admin'] as const;

/** Roles que podem acessar o KDS */
export const ROLES_KITCHEN_ACCESS = ['kitchen', 'manager', 'restaurant_admin', 'super_admin'] as const;
