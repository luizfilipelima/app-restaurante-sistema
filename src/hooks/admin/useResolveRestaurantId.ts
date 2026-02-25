/**
 * Hook que resolve um "identifier" de URL para o UUID real do restaurante.
 *
 * As rotas do Super Admin aceitam tanto o slug amigável quanto o UUID bruto:
 *   /super-admin/restaurants/pizzaria-do-joao   ← slug
 *   /super-admin/restaurants/xxxxxxxx-xxxx-...  ← UUID (fallback)
 *
 * Lógica de resolução:
 *   1. Se o identifier já é um UUID válido → retorna diretamente (sem network).
 *   2. Se é um slug → busca o id correspondente na tabela restaurants.
 *   3. Se não encontrar por slug → tenta buscar por id como último recurso.
 *
 * O resultado é memorizado via TanStack Query (staleTime 10 min), então o
 * lookup no banco só acontece uma vez por sessão para o mesmo identifier.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Regex para detectar UUID v4 (e compatível com v1/v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retorna `true` se a string é um UUID válido. */
export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface ResolveResult {
  /** UUID real do restaurante, ou null se não encontrado / ainda carregando. */
  restaurantId: string | null;
  /** true enquanto o lookup assíncrono (por slug) ainda está em andamento. */
  isLoading: boolean;
  /** true se o identifier parece ser UUID válido (sem necessidade de lookup). */
  isDirectUUID: boolean;
}

/**
 * Resolve um identifier de URL para o UUID real do restaurante.
 *
 * @param identifier - Slug (ex: "pizzaria-do-joao") ou UUID vindo da URL.
 *                     Pode ser undefined quando usado em rotas sem este parâmetro.
 */
export function useResolveRestaurantId(
  identifier: string | null | undefined,
): ResolveResult {
  // Se o identifier já é um UUID, não precisamos de nenhuma query de lookup.
  const isDirectUUID = !!identifier && isUUID(identifier);

  const { data: resolvedId, isLoading } = useQuery<string | null>({
    queryKey: ['resolve-restaurant-id', identifier],
    queryFn: async () => {
      if (!identifier) return null;

      // Caso 1: é UUID → retorna imediatamente sem consultar o banco.
      if (isUUID(identifier)) return identifier;

      // Caso 2: é slug → busca o UUID correspondente.
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', identifier)
        .maybeSingle();

      if (error) throw error;

      // Caso 3: slug não encontrado → tenta como último recurso buscar por id
      // (cobre edge-cases como slugs em formato de UUID parcial).
      if (!data) return null;

      return data.id;
    },
    // Não executa se o identifier for undefined ou se já for UUID (não precisa de lookup).
    enabled: !!identifier && !isDirectUUID,
    staleTime: 1000 * 60 * 10, // 10 min — IDs não mudam
    gcTime:    1000 * 60 * 60, // 1 hora em memória
  });

  return {
    // Se UUID direto → usa o próprio identifier. Se slug → usa o id resolvido.
    restaurantId: isDirectUUID ? (identifier as string) : (resolvedId ?? null),
    // Só está "carregando" se precisou de um lookup assíncrono por slug.
    isLoading:    !isDirectUUID && isLoading,
    isDirectUUID,
  };
}
