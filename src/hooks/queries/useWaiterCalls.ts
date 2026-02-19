import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WaiterCall } from '@/types';

/** Busca chamados de garçom pendentes. Isolamento por tenant via restaurant_id. */
async function fetchWaiterCalls(restaurantId: string | null): Promise<WaiterCall[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('waiter_calls')
    .select('id, restaurant_id, table_id, table_number, status, created_at, attended_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as WaiterCall[];
}

/** Hook para chamados de garçom. Usado em AdminTables. staleTime menor (30s) para atualização rápida. */
export function useWaiterCalls(restaurantId: string | null) {
  return useQuery({
    queryKey: ['waiterCalls', restaurantId],
    queryFn: () => fetchWaiterCalls(restaurantId),
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 segundos (chamados precisam atualizar rápido)
  });
}
