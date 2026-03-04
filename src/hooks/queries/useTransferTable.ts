/**
 * useTransferTable — Transfere todos os pedidos e dados de uma mesa para outra
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';

export interface TransferTableResult {
  success: boolean;
  source_table_id: string;
  target_table_id: string;
  source_number: number;
  target_number: number;
  orders_moved: number;
  reservations_moved: number;
  comanda_links_moved: number;
  waiter_calls_moved: number;
}

export async function transferTableToTable(
  restaurantId: string,
  sourceTableId: string,
  targetTableId: string
): Promise<TransferTableResult> {
  const { data, error } = await supabase.rpc('transfer_table_to_table', {
    p_restaurant_id: restaurantId,
    p_source_table_id: sourceTableId,
    p_target_table_id: targetTableId,
  });
  if (error) throw error;
  return data as TransferTableResult;
}

export function useTransferTable(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceTableId,
      targetTableId,
    }: {
      sourceTableId: string;
      targetTableId: string;
    }) => {
      if (!restaurantId) throw new Error('Restaurant ID required');
      return transferTableToTable(restaurantId, sourceTableId, targetTableId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      qc.invalidateQueries({ queryKey: ['tableOrders'] });
      qc.invalidateQueries({ queryKey: ['tableComandaLinks'] });
      qc.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      qc.invalidateQueries({ queryKey: ['waiterCalls', restaurantId] });
    },
  });
}
