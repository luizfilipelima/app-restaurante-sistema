import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DatabaseOrder } from '@/types';

const COMPLETED_ORDERS_SELECT = `
  id, restaurant_id, customer_name, customer_phone, delivery_type, delivery_zone_id,
  delivery_address, delivery_fee, subtotal, total, payment_method, payment_change_for,
  status, notes, is_paid, courier_id, order_source, table_id,
  created_at, updated_at,
  delivery_zone:delivery_zones(id, location_name, fee),
  order_items(id, order_id, product_name, quantity, unit_price, total_price, observations),
  courier:couriers(id, name, phone)
`;

export type CompletedOrdersDateRange = 'today' | '7d' | '30d';

export interface UseCompletedOrdersParams {
  restaurantId: string | null;
  dateRange: CompletedOrdersDateRange;
}

export function getDateRangeBounds(range: CompletedOrdersDateRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === '7d') {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

async function fetchCompletedOrders({
  restaurantId,
  dateRange,
}: UseCompletedOrdersParams): Promise<DatabaseOrder[]> {
  if (!restaurantId) return [];
  const { start, end } = getDateRangeBounds(dateRange);

  const { data, error } = await supabase
    .from('orders')
    .select(COMPLETED_ORDERS_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'completed')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as DatabaseOrder[];
}

export function useCompletedOrders({ restaurantId, dateRange }: UseCompletedOrdersParams) {
  return useQuery({
    queryKey: ['completed-orders', restaurantId, dateRange],
    queryFn: () => fetchCompletedOrders({ restaurantId, dateRange }),
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}
