/**
 * useResetTable — Reseta mesa: cancela pedidos, remove reservas, reseta comandas
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

export async function resetTable(restaurantId: string, tableId: string): Promise<{ success: boolean; table_id: string }> {
  const { data, error } = await supabase.rpc('reset_table', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
  });
  if (error) throw error;
  return data as { success: boolean; table_id: string };
}

export function useResetTable(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tableId: string) => {
      if (!restaurantId) throw new Error('Restaurant ID required');
      return resetTable(restaurantId, tableId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableOrders'] });
      qc.invalidateQueries({ queryKey: ['tableComandaLinks'] });
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
    },
  });
}
