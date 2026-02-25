import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import type { DeliveryDistanceTier } from '@/types';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';

/** Busca faixas de preço por distância do restaurante (modo quilometragem). */
async function fetchDeliveryDistanceTiers(
  restaurantId: string | null
): Promise<DeliveryDistanceTier[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('delivery_distance_tiers')
    .select('id, restaurant_id, km_min, km_max, fee, created_at')
    .eq('restaurant_id', restaurantId)
    .order('km_min', { ascending: true });
  if (error) throw error;
  return (data || []) as DeliveryDistanceTier[];
}

/** Hook para faixas de preço por distância (modo quilometragem). */
export function useDeliveryDistanceTiers(restaurantId: string | null) {
  return useQuery({
    queryKey: ['deliveryDistanceTiers', restaurantId],
    queryFn: () => fetchDeliveryDistanceTiers(restaurantId),
    enabled: !!restaurantId,
  });
}

interface SaveTierParams {
  km_min: number;
  km_max: number | null;
  fee: number;
}
interface UpdateTierParams extends SaveTierParams {
  id: string;
}

/** Mutation para criar faixa de distância */
export function useCreateDeliveryDistanceTier(
  restaurantId: string | null,
  restaurantSlug?: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: SaveTierParams) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      const { error } = await supabase.from('delivery_distance_tiers').insert({
        restaurant_id: restaurantId,
        km_min: params.km_min,
        km_max: params.km_max ?? null,
        fee: params.fee,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ['deliveryDistanceTiers', restaurantId] });
        if (restaurantSlug) invalidatePublicMenuCache(queryClient, restaurantSlug);
      }
    },
  });
}

/** Mutation para atualizar faixa de distância */
export function useUpdateDeliveryDistanceTier(
  restaurantId: string | null,
  restaurantSlug?: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, km_min, km_max, fee }: UpdateTierParams) => {
      const { error } = await supabase
        .from('delivery_distance_tiers')
        .update({ km_min, km_max: km_max ?? null, fee })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ['deliveryDistanceTiers', restaurantId] });
        if (restaurantSlug) invalidatePublicMenuCache(queryClient, restaurantSlug);
      }
    },
  });
}

/** Mutation para excluir faixa de distância */
export function useDeleteDeliveryDistanceTier(
  restaurantId: string | null,
  restaurantSlug?: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_distance_tiers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ['deliveryDistanceTiers', restaurantId] });
        if (restaurantSlug) invalidatePublicMenuCache(queryClient, restaurantSlug);
      }
    },
  });
}
