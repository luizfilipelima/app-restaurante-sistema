import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Table } from '@/types';

/** Busca mesas do restaurante. Isolamento por tenant via restaurant_id. */
async function fetchTables(restaurantId: string | null): Promise<Table[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('tables')
    .select('id, restaurant_id, number, name, is_active, order_index, created_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('order_index', { ascending: true })
    .order('number', { ascending: true });
  if (error) throw error;
  return (data || []) as Table[];
}

/** Hook para mesas do restaurante. Usado em AdminTables e seleção de mesa no checkout. */
export function useTables(restaurantId: string | null) {
  return useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: () => fetchTables(restaurantId),
    enabled: !!restaurantId,
  });
}
