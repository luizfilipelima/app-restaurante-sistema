/**
 * Pedidos com tempo de preparo (accepted_at → ready_at) para o dashboard.
 * Retorna os mais rápidos e os mais demorados no período e filtro de área.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { isUUID } from '@/hooks/admin/useResolveRestaurantId';

export interface OrderPrepTimeItem {
  id: string;
  code: string;
  orderSource: 'delivery' | 'pickup' | 'table' | 'buffet' | 'comanda';
  createdAt: string;
  prepTimeMinutes: number;
}

export interface OrdersPrepTimeExtremesResult {
  fastest: OrderPrepTimeItem[];
  slowest: OrderPrepTimeItem[];
}

function orderMatchesArea(
  order: { order_source?: string | null; delivery_type?: string },
  areaFilter: string
): boolean {
  if (!areaFilter || areaFilter === 'all') return true;
  if (areaFilter === 'table') return order.order_source === 'table';
  if (areaFilter === 'buffet') return order.order_source === 'buffet';
  if (areaFilter === 'delivery') {
    return order.order_source === 'delivery' || order.delivery_type === 'delivery';
  }
  if (areaFilter === 'pickup') {
    return order.order_source === 'pickup' || order.delivery_type === 'pickup';
  }
  return true;
}

async function fetchOrdersPrepTimeExtremes({
  restaurantId,
  startDate,
  endDate,
  areaFilter,
  limit = 5,
}: {
  restaurantId: string;
  startDate: Date;
  endDate: Date;
  areaFilter: string;
  limit?: number;
}): Promise<OrdersPrepTimeExtremesResult> {
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const { data: ordersData, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_source,
      delivery_type,
      created_at,
      accepted_at,
      ready_at,
      virtual_comanda_id,
      virtual_comandas(short_code)
    `)
    .eq('restaurant_id', restaurantId)
    .not('accepted_at', 'is', null)
    .not('ready_at', 'is', null)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const orders = (ordersData ?? []) as Array<{
    id: string;
    order_source?: string | null;
    delivery_type?: string;
    created_at: string;
    accepted_at: string;
    ready_at: string;
    virtual_comanda_id?: string | null;
    virtual_comandas?: { short_code?: string | null } | null;
  }>;

  const withPrepTime: OrderPrepTimeItem[] = orders
    .filter((o) => orderMatchesArea(o, areaFilter))
    .map((o) => {
      const ms =
        new Date(o.ready_at).getTime() - new Date(o.accepted_at).getTime();
      const prepTimeMinutes = Math.round(ms / 60000);
      const code =
        o.order_source === 'comanda' && o.virtual_comandas?.short_code
          ? String(o.virtual_comandas.short_code)
          : o.id.slice(0, 8).toUpperCase();
      return {
        id: o.id,
        code,
        orderSource: (o.order_source || o.delivery_type || 'delivery') as OrderPrepTimeItem['orderSource'],
        createdAt: o.created_at,
        prepTimeMinutes,
      };
    });

  const sorted = [...withPrepTime].sort(
    (a, b) => a.prepTimeMinutes - b.prepTimeMinutes
  );
  const fastest = sorted.slice(0, limit);
  const slowest = [...sorted].reverse().slice(0, limit);

  return { fastest, slowest };
}

export interface UseOrdersPrepTimeExtremesParams {
  restaurantId: string | null;
  startDate: Date;
  endDate: Date;
  areaFilter?: string;
  limit?: number;
  enabled?: boolean;
}

export function useOrdersPrepTimeExtremes({
  restaurantId,
  startDate,
  endDate,
  areaFilter = 'all',
  limit = 5,
  enabled = true,
}: UseOrdersPrepTimeExtremesParams) {
  return useQuery({
    queryKey: [
      'orders-prep-time-extremes',
      restaurantId,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10),
      areaFilter,
      limit,
    ],
    queryFn: () =>
      fetchOrdersPrepTimeExtremes({
        restaurantId: restaurantId!,
        startDate,
        endDate,
        areaFilter,
        limit,
      }),
    enabled:
      !!restaurantId &&
      isUUID(restaurantId) &&
      enabled &&
      endDate >= startDate,
    staleTime: 60 * 1000,
  });
}
