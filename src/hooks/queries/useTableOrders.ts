/**
 * useTableOrders — Pedidos não pagos de uma mesa (para o modal do garçom)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/types';

export interface TableOrderWithItems extends Order {
  order_items?: OrderItem[];
}

async function fetchTableOrders(orderIds: string[]): Promise<TableOrderWithItems[]> {
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, customer_name, customer_phone, total, subtotal, bill_requested, created_at,
      order_items(id, product_name, quantity, unit_price, total_price, observations)
    `)
    .in('id', orderIds)
    .eq('is_paid', false)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TableOrderWithItems[];
}

export function useTableOrders(orderIds: string[]) {
  return useQuery({
    queryKey: ['tableOrders', orderIds.sort().join(',')],
    queryFn: () => fetchTableOrders(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 10 * 1000,
  });
}
