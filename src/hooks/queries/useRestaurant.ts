import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/types';

/** Busca um restaurante pelo ID. Isolamento por tenant via restaurant_id. */
async function fetchRestaurant(restaurantId: string | null): Promise<Restaurant | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single();
  if (error) throw error;
  return data as Restaurant;
}

/** Hook para carregar dados do restaurante. Usado em AdminLayout e páginas que precisam de config do restaurante. */
export function useRestaurant(restaurantId: string | null) {
  return useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
    enabled: !!restaurantId,
  });
}
