/**
 * useWaiterHallZone — Zona do salão atribuída ao garçom logado.
 * Usado no Terminal do Garçom para filtrar mesas, chamados e expedição.
 * Se null, o garçom vê todas as zonas.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

async function fetchWaiterHallZone(restaurantId: string | null): Promise<string | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase.rpc('get_my_waiter_hall_zone', {
    p_restaurant_id: restaurantId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export function useWaiterHallZone(restaurantId: string | null) {
  return useQuery({
    queryKey: ['waiterHallZone', restaurantId],
    queryFn: () => fetchWaiterHallZone(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 min — zona raramente muda durante a sessão
  });
}
