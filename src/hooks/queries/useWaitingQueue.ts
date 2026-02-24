/**
 * useWaitingQueue — Fila de espera (clientes sem reserva)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface WaitingQueueItem {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string | null;
  position: number;
  status: string;
  virtual_comanda_id: string | null;
  table_id: string | null;
  notified_at: string | null;
  created_at: string;
}

async function fetchWaitingQueue(restaurantId: string | null): Promise<WaitingQueueItem[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('waiting_queue')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'waiting')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WaitingQueueItem[];
}

export function useWaitingQueue(restaurantId: string | null) {
  return useQuery({
    queryKey: ['waitingQueue', restaurantId],
    queryFn: () => fetchWaitingQueue(restaurantId),
    enabled: !!restaurantId,
    staleTime: 10 * 1000,
  });
}

export function useAddToWaitingQueue(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { customer_name: string; customer_phone?: string }) => {
      const { data, error } = await supabase.rpc('add_to_waiting_queue', {
        p_restaurant_id: restaurantId,
        p_customer_name: params.customer_name,
        p_customer_phone: params.customer_phone ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitingQueue', restaurantId] }),
  });
}

export function useNotifyQueueItem(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { queue_id: string; table_id: string }) => {
      const { data, error } = await supabase.rpc('notify_queue_item', {
        p_queue_id: params.queue_id,
        p_table_id: params.table_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitingQueue', restaurantId] });
      qc.invalidateQueries({ queryKey: ['virtual_comandas'] });
    },
  });
}
