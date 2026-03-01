/**
 * useTableStatuses — Agrega mesas com status em tempo real
 *
 * Status: free | occupied | calling_waiter | awaiting_closure
 * - free: sem pedidos não pagos
 * - occupied: tem pedidos não pagos, sem bill_requested
 * - calling_waiter: tem waiter_call pendente
 * - awaiting_closure: pedidos com bill_requested=true
 *
 * hasReservation: apenas quando há reserva para o dia atual (scheduled_at no dia)
 */

import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/lib/core/supabase';
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
  /** Se tem reserva pendente/confirmada */
  hasReservation?: boolean;
  /** Dados da reserva quando hasReservation */
  reservationAt?: string | null;
  reservationCustomerName?: string | null;
  reservationCustomerPhone?: string | null;
  /** Observações da reserva */
  reservationNotes?: string | null;
  /** Nome do cliente salvo no cardápio (antes do pedido) — aparece em tempo real no painel */
  currentCustomerName?: string | null;
}

async function fetchTableStatuses(restaurantId: string | null): Promise<TableWithStatus[]> {
  if (!restaurantId) return [];

  const [tablesRes, ordersRes, waiterCallsRes, reservationsRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, restaurant_id, number, name, is_active, order_index, hall_zone_id, current_customer_name, created_at, updated_at')
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
    // Reservations: pode não existir se migração não foi executada
    (async () => {
      try {
        const { data } = await supabase
          .from('reservations')
          .select('id, table_id, customer_name, customer_phone, scheduled_at, notes, status')
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'confirmed']);
        return data ?? [];
      } catch {
        return [];
      }
    })(),
  ]);

  const tables = (tablesRes.data ?? []) as Table[];
  const orders = (ordersRes.data ?? []) as any[];
  const waiterCalls = (waiterCallsRes.data ?? []) as { table_id: string | null }[];

  const pendingTableIds = new Set(
    waiterCalls.map((c) => c.table_id).filter(Boolean) as string[]
  );

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();
  const reservationsByTable = new Map<string, { customer_name: string; customer_phone?: string | null; scheduled_at: string; notes?: string | null }[]>();
  (Array.isArray(reservationsRes) ? reservationsRes : []).forEach((r: any) => {
    if (!r.table_id) return;
    const scheduled = new Date(r.scheduled_at).getTime();
    if (scheduled < todayStart || scheduled > todayEnd) return;
    const list = reservationsByTable.get(r.table_id) ?? [];
    list.push({ customer_name: r.customer_name, customer_phone: r.customer_phone ?? null, scheduled_at: r.scheduled_at, notes: r.notes ?? null });
    reservationsByTable.set(r.table_id, list);
  });

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

    const resList = reservationsByTable.get(t.id) ?? [];
    const nextRes = resList[0];

    return {
      ...t,
      status,
      itemsCount,
      totalAmount,
      openedAt,
      orderIds: tableOrders.map((o: any) => o.id),
      hasPendingWaiterCall,
      billRequested,
      hasReservation: resList.length > 0,
      reservationAt: nextRes?.scheduled_at ?? null,
      reservationCustomerName: nextRes?.customer_name ?? null,
      reservationCustomerPhone: nextRes?.customer_phone ?? null,
      reservationNotes: nextRes?.notes ?? null,
      currentCustomerName: (t as { current_customer_name?: string | null }).current_customer_name ?? null,
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
