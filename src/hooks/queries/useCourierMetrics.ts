import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CourierMetrics {
  courier_id: string;
  total_deliveries: number;
  avg_delivery_time_minutes: number;
  total_fees: number;
}

/** Busca métricas de BI por entregador (entregas realizadas, tempo médio, taxas) */
async function fetchCourierMetrics(restaurantId: string | null): Promise<CourierMetrics[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('courier_id, delivery_fee, ready_at, delivered_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'completed')
    .not('courier_id', 'is', null);

  if (error) throw error;
  const orders = data || [];

  const byCourier = new Map<string, { count: number; fees: number; deliveryTimes: number[] }>();
  orders.forEach((o: { courier_id: string; delivery_fee: number; ready_at: string | null; delivered_at: string | null }) => {
    if (!o.courier_id) return;
    const entry = byCourier.get(o.courier_id) ?? { count: 0, fees: 0, deliveryTimes: [] };
    entry.count += 1;
    entry.fees += o.delivery_fee ?? 0;
    if (o.ready_at && o.delivered_at) {
      const mins = (new Date(o.delivered_at).getTime() - new Date(o.ready_at).getTime()) / 60000;
      entry.deliveryTimes.push(mins);
    }
    byCourier.set(o.courier_id, entry);
  });

  return Array.from(byCourier.entries()).map(([courier_id, v]) => ({
    courier_id,
    total_deliveries: v.count,
    avg_delivery_time_minutes:
      v.deliveryTimes.length > 0
        ? v.deliveryTimes.reduce((a, b) => a + b, 0) / v.deliveryTimes.length
        : 0,
    total_fees: v.fees,
  }));
}

export function useCourierMetrics(restaurantId: string | null) {
  return useQuery({
    queryKey: ['courier-metrics', restaurantId],
    queryFn: () => fetchCourierMetrics(restaurantId),
    enabled: !!restaurantId,
  });
}
