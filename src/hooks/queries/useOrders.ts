import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DatabaseOrder } from '@/types';

/**
 * Colunas estritamente necessárias para a listagem do Kanban.
 * Evita select('*') para reduzir payload e melhorar performance.
 * Inclui: dados do pedido, zona, itens (para cards) e entregador.
 */
const ORDERS_SELECT = `
  id, restaurant_id, customer_name, customer_phone, delivery_type, delivery_zone_id,
  delivery_address, latitude, longitude, address_details, delivery_fee, subtotal, total, payment_method, payment_change_for,
  status, notes, is_paid, courier_id, order_source, table_id, virtual_comanda_id, created_at, updated_at, accepted_at, ready_at, delivered_at,
  delivery_zone:delivery_zones(id, location_name, fee),
  virtual_comandas(short_code),
  order_items(id, order_id, product_name, quantity, unit_price, total_price, observations, pizza_size, pizza_flavors, pizza_dough, pizza_edge, addons),
  courier:couriers(id, name, phone, phone_country)
`;

const ORDER_TAB_STATUSES = ['pending', 'preparing', 'ready', 'delivering', 'completed'];

/** Filtro de origem: all | table (mesas) | delivery (cardápio interativo) */
export type OrderSourceFilter = 'all' | 'table' | 'delivery';

export interface UseOrdersParams {
  restaurantId: string | null;
  /** Página para paginação (0-based). Default 0. */
  page?: number;
  /** Itens por página. Default 50. */
  limit?: number;
  /** Filtro por origem: mesas ou delivery. Default 'all'. */
  orderSourceFilter?: OrderSourceFilter;
}

/** Busca pedidos ativos (exclui cancelados) com paginação. Isolamento por tenant via restaurant_id. */
async function fetchOrders({
  restaurantId,
  page = 0,
  limit = 50,
  orderSourceFilter = 'all',
}: UseOrdersParams): Promise<{ orders: DatabaseOrder[]; hasMore: boolean }> {
  if (!restaurantId) return { orders: [], hasMore: false };
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('orders')
    .select(ORDERS_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', ORDER_TAB_STATUSES)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (orderSourceFilter === 'table') {
    query = query.or('order_source.eq.table,table_id.not.is.null');
  } else if (orderSourceFilter === 'delivery') {
    query = query.is('table_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  const orders = (data || []) as unknown as DatabaseOrder[];
  return { orders, hasMore: orders.length === limit };
}

/** Hook para pedidos do Kanban. Usa paginação. staleTime 30s para refletir mudanças rápido. */
export function useOrders({
  restaurantId,
  page = 0,
  limit = 50,
  orderSourceFilter = 'all',
}: UseOrdersParams) {
  return useQuery({
    queryKey: ['orders', restaurantId, page, limit, orderSourceFilter],
    queryFn: () => fetchOrders({ restaurantId, page, limit, orderSourceFilter }),
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 segundos (pedidos mudam com frequência)
  });
}
