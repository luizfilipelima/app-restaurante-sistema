import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DatabaseOrder } from '@/types';

/** Colunas e relações necessárias para o Kanban de pedidos (evita select *) */
const ORDERS_SELECT = `
  id, restaurant_id, customer_name, customer_phone, delivery_type, delivery_zone_id,
  delivery_address, delivery_fee, subtotal, total, payment_method, payment_change_for,
  status, notes, is_paid, courier_id, order_source, table_id, created_at, updated_at,
  delivery_zone:delivery_zones(id, location_name, fee),
  order_items(id, order_id, product_name, quantity, unit_price, total_price, observations, pizza_size, pizza_flavors, pizza_dough, pizza_edge),
  courier:couriers(id, name, phone)
`;

const ORDER_TAB_STATUSES = ['pending', 'preparing', 'ready', 'delivering', 'completed'];

export interface UseOrdersParams {
  restaurantId: string | null;
  /** Página para paginação (0-based). Default 0. */
  page?: number;
  /** Itens por página. Default 50. */
  limit?: number;
}

/** Busca pedidos ativos (exclui cancelados) com paginação. Isolamento por tenant via restaurant_id. */
async function fetchOrders({
  restaurantId,
  page = 0,
  limit = 50,
}: UseOrdersParams): Promise<{ orders: DatabaseOrder[]; hasMore: boolean }> {
  if (!restaurantId) return { orders: [], hasMore: false };
  const from = page * limit;
  const to = from + limit - 1;
  const { data, error } = await supabase
    .from('orders')
    .select(ORDERS_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', ORDER_TAB_STATUSES)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  const orders = (data || []) as unknown as DatabaseOrder[];
  return { orders, hasMore: orders.length === limit };
}

/** Hook para pedidos do Kanban. Usa paginação. staleTime 30s para refletir mudanças rápido. */
export function useOrders({ restaurantId, page = 0, limit = 50 }: UseOrdersParams) {
  return useQuery({
    queryKey: ['orders', restaurantId, page, limit],
    queryFn: () => fetchOrders({ restaurantId, page, limit }),
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 segundos (pedidos mudam com frequência)
  });
}
