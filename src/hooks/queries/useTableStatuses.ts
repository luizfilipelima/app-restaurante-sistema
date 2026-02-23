/**
 * useTableStatuses — Agrega mesas com status em tempo real
 *
 * Status: free | occupied | calling_waiter | awaiting_closure
 * - free: sem pedidos não pagos
 * - occupied: tem pedidos não pagos, sem bill_requested
 * - calling_waiter: tem waiter_call pendente
 * - awaiting_closure: pedidos com bill_requested=true
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Table } from '@/types';

export type TableStatus = 'free' | 'occupied' | 'calling_waiter' | 'awaiting_closure';

export interface TableWithStatus extends Table {
  status: TableStatus;
  /** Quantidade de itens consumidos (soma dos order_items) */
  itemsCount: number;
  /** Valor total parcial (soma dos orders não pagos) */
  totalAmount: number;
  /** Data do pedido mais antigo (quando a mesa foi aberta) */
  openedAt: string | null;
  /** IDs dos pedidos não pagos da mesa */
  orderIds: string[];
  /** Se tem chamado de garçom pendente */
  hasPendingWaiterCall: boolean;
  /** Se bloqueou novos pedidos (bill_requested) */
  billRequested: boolean;
}

async function fetchTableStatuses(restaurantId: string | null): Promise<TableWithStatus[]> {
  if (!restaurantId) return [];

  const [tablesRes, ordersRes, waiterCallsRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, restaurant_id, number, name, is_active, order_index, hall_zone_id, created_at, updated_at')
      .eq('restaurant_id', restaurantId)
      .order('order_index', { ascending: true })
      .order('number', { ascending: true }),
    supabase
      .from('orders')
      .select(`
        id, table_id, total, bill_requested, created_at,
        order_items(id, quantity)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('order_source', 'table')
      .eq('is_paid', false)
      .neq('status', 'cancelled'),
    supabase
      .from('waiter_calls')
      .select('id, table_id, status')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending'),
  ]);

  const tables = (tablesRes.data ?? []) as Table[];
  const orders = (ordersRes.data ?? []) as any[];
  const waiterCalls = (waiterCallsRes.data ?? []) as { table_id: string | null }[];

  const pendingTableIds = new Set(
    waiterCalls.map((c) => c.table_id).filter(Boolean) as string[]
  );

  const ordersByTable = new Map<string, any[]>();
  orders.forEach((o) => {
    if (!o.table_id) return;
    const list = ordersByTable.get(o.table_id) ?? [];
    list.push(o);
    ordersByTable.set(o.table_id, list);
  });

  return tables.map((t) => {
    const tableOrders = ordersByTable.get(t.id) ?? [];
    const hasPendingWaiterCall = pendingTableIds.has(t.id);
    const billRequested = tableOrders.some((o) => o.bill_requested === true);

    let itemsCount = 0;
    let totalAmount = 0;
    let openedAt: string | null = null;

    tableOrders.forEach((o) => {
      totalAmount += Number(o.total ?? 0);
      const items = (o.order_items ?? []) as { quantity: number }[];
      items.forEach((i) => { itemsCount += Number(i.quantity ?? 0); });
      const created = o.created_at;
      if (created && (!openedAt || created < openedAt)) openedAt = created;
    });

    let status: TableStatus = 'free';
    if (tableOrders.length > 0) {
      if (billRequested) status = 'awaiting_closure';
      else if (hasPendingWaiterCall) status = 'calling_waiter';
      else status = 'occupied';
    } else if (hasPendingWaiterCall) {
      status = 'calling_waiter';
    }

    return {
      ...t,
      status,
      itemsCount,
      totalAmount,
      openedAt,
      orderIds: tableOrders.map((o: any) => o.id),
      hasPendingWaiterCall,
      billRequested,
    } satisfies TableWithStatus;
  });
}

export function useTableStatuses(restaurantId: string | null) {
  return useQuery({
    queryKey: ['tableStatuses', restaurantId],
    queryFn: () => fetchTableStatuses(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 1000,
  });
}
