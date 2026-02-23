/**
 * useHallZones — Zonas do Salão (Varanda, Salão Principal, etc.)
 * Diferente de delivery_zones (entrega).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HallZone } from '@/types';

async function fetchHallZones(restaurantId: string | null): Promise<HallZone[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('hall_zones')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('order_index', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HallZone[];
}

export function useHallZones(restaurantId: string | null) {
  return useQuery({
    queryKey: ['hallZones', restaurantId],
    queryFn: () => fetchHallZones(restaurantId),
    enabled: !!restaurantId,
  });
}

export function useCreateHallZone(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!restaurantId) throw new Error('Restaurant required');
      const { data: list } = await supabase
        .from('hall_zones')
        .select('order_index')
        .eq('restaurant_id', restaurantId)
        .order('order_index', { ascending: false })
        .limit(1);
      const nextOrder = (list?.[0]?.order_index ?? -1) + 1;
      const { data, error } = await supabase
        .from('hall_zones')
        .insert({ restaurant_id: restaurantId, name: name.trim(), order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as HallZone;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}

export function useUpdateHallZone(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('hall_zones')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as HallZone;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}

export function useDeleteHallZone(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hall_zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
    },
  });
}
