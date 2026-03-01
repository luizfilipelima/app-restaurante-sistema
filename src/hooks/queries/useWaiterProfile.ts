/**
 * useWaiterProfile — Perfil do garçom (login, email, nome, cargo, zona).
 * Permite ao garçom ver seus dados e atualizar a zona que atende.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

export interface WaiterProfile {
  login: string;
  email: string;
  usuario: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: string;
  hall_zone_id: string | null;
}

async function fetchWaiterProfile(restaurantId: string | null): Promise<WaiterProfile | null> {
  if (!restaurantId) return null;
  const { data, error } = await supabase.rpc('get_my_waiter_profile', {
    p_restaurant_id: restaurantId,
  });
  if (error) throw error;
  return (data as WaiterProfile | null) ?? null;
}

export function useWaiterProfile(restaurantId: string | null) {
  return useQuery({
    queryKey: ['waiterProfile', restaurantId],
    queryFn: () => fetchWaiterProfile(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMyWaiterHallZone(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hallZoneId: string | null) => {
      if (!restaurantId) throw new Error('Restaurante não definido');
      const { data, error } = await supabase.rpc('update_my_waiter_hall_zone', {
        p_restaurant_id: restaurantId,
        p_hall_zone_id: hallZoneId,
      });
      if (error) throw error;
      return data as { hall_zone_id: string | null };
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ['waiterProfile', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['waiterHallZone', restaurantId] });
      }
    },
  });
}
