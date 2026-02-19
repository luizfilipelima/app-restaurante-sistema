import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Verifica se um restaurante tem acesso a uma feature específica.
 *
 * Chama a RPC `restaurant_has_feature` (definida em 20260219_init_access_control.sql),
 * que leva em conta o plano contratado + overrides manuais do Super Admin.
 *
 * staleTime: Infinity — o plano de um restaurante muda raramente; o cache só é
 * invalidado manualmente (ex: após o Super Admin alterar o plano).
 *
 * gcTime: 1h — mantém o resultado em memória para não re-buscar ao navegar.
 */
export function useFeatureAccess(
  featureFlag: string,
  restaurantId: string | null | undefined,
) {
  return useQuery<boolean>({
    queryKey: ['feature-access', restaurantId, featureFlag],
    queryFn: async () => {
      if (!restaurantId) return false;

      const { data, error } = await supabase.rpc('restaurant_has_feature', {
        p_restaurant_id: restaurantId,
        p_flag: featureFlag,
      });

      // Se a tabela ainda não existe (ex: migração não rodada), falha silenciosamente.
      if (error) {
        console.warn(`[useFeatureAccess] RPC error for "${featureFlag}":`, error.message);
        return false;
      }

      return Boolean(data);
    },
    enabled: !!restaurantId && !!featureFlag,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Versão simplificada para uso em contextos sem restaurantId.
 * Retorna sempre `false` quando restaurantId é nulo.
 */
export type UseFeatureAccessResult = ReturnType<typeof useFeatureAccess>;
