/**
 * useCashierDailyOrders — Lista de pedidos concluídos para o caixa diário
 *
 * Inclui: delivery, pickup, mesa, buffet (comandas físicas e virtuais).
 * Com tempo de preparo KDS (accepted_at até ready_at) quando aplicável.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export type CashierDailyPeriod = 'today' | '7d' | '30d' | 'max' | 'custom';

export interface CashierDailyOrderItem {
  id: string;
  type: 'order' | 'comanda_buffet';
  tag: 'delivery' | 'pickup' | 'table' | 'buffet' | 'comanda';
  label: string;
  customerName: string | null;
  total: number;
  paymentMethod: string;
  createdAt: string;
  closedAt: string;
  /** Tempo em minutos na cozinha (KDS): ready_at - accepted_at. null se N/A (buffet) */
  prepTimeMinutes: number | null;
  /** Itens do pedido/comanda */
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  /** Para pedidos de mesa: número da mesa */
  tableNumber?: number | null;
  /** Para comandas: número da comanda */
  comandaNumber?: number | null;
}

export interface CashierDailyOrdersResult {
  orders: CashierDailyOrderItem[];
  totalRevenue: number;
  totalOrders: number;
}

export function getCashierDailyDateRange(
  period: CashierDailyPeriod,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;
  if (period === 'custom' && customStart && customEnd && !isNaN(customStart.getTime()) && !isNaN(customEnd.getTime())) {
    start = startOfDay(customStart);
    return { start, end: endOfDay(customEnd) };
  }
  if (period === 'today') {
    start = startOfDay(new Date());
    return { start, end: endOfDay(new Date()) };
  }
  if (period === '7d') {
    start = startOfDay(subDays(new Date(), 7));
    return { start, end };
  }
  if (period === '30d') {
    start = startOfDay(subDays(new Date(), 30));
    return { start, end };
  }
  start = new Date(2020, 0, 1);
  return { start, end };
}

export interface UseCashierDailyOrdersParams {
  restaurantId: string | null;
  period: CashierDailyPeriod;
  customStart?: Date;
  customEnd?: Date;
  hasTables?: boolean;
  hasBuffet?: boolean;
}

function pmLabel(m: string): string {
  const map: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    bank_transfer: 'Transferência',
    table: 'Mesa',
    qrcode: 'QR Code',
  };
  return map[m] ?? m;
}

async function fetchCashierDailyOrders(params: UseCashierDailyOrdersParams): Promise<CashierDailyOrdersResult> {
  const { restaurantId, period, customStart, customEnd, hasTables = true, hasBuffet = true } = params;
  if (!restaurantId) return { orders: [], totalRevenue: 0, totalOrders: 0 };

  const { start, end } = getCashierDailyDateRange(period, customStart, customEnd);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const items: CashierDailyOrderItem[] = [];

  // 1. Orders: delivery, pickup, table (exclui orders de virtual_comanda, tratados no passo 2)
  let ordersQuery = supabase
    .from('orders')
    .select(`
      id, customer_name, total, created_at, updated_at, payment_method,
      order_source, table_id, accepted_at, ready_at,
      order_items(id, product_name, quantity, unit_price, total_price),
      tables(number)
    `)
    .eq('restaurant_id', restaurantId)
    .in('status', ['completed'])
    .eq('is_paid', true)
    .is('virtual_comanda_id', null)
    .gte('updated_at', startIso)
    .lte('updated_at', endIso)
    .order('updated_at', { ascending: false });

  if (!hasTables) {
    ordersQuery = ordersQuery.neq('order_source', 'table');
  }

  const { data: ordersData } = await ordersQuery;
  const orders = (ordersData ?? []) as any[];

  for (const o of orders) {
    const tag =
      o.order_source === 'table'
        ? 'table'
        : o.order_source === 'buffet'
          ? 'buffet'
          : o.order_source === 'delivery' || o.delivery_type === 'delivery'
            ? 'delivery'
            : o.order_source === 'pickup' || o.delivery_type === 'pickup'
              ? 'pickup'
              : 'comanda';

    let prepTime: number | null = null;
    if (o.accepted_at && o.ready_at) {
      const ms = new Date(o.ready_at).getTime() - new Date(o.accepted_at).getTime();
      prepTime = Math.round(ms / 60000);
    }

    const orderItems = (o.order_items ?? []).map((i: any) => ({
      name: i.product_name ?? i.description ?? '—',
      quantity: i.quantity ?? 1,
      unitPrice: i.unit_price ?? 0,
      totalPrice: i.total_price ?? 0,
    }));

    items.push({
      id: o.id,
      type: 'order',
      tag,
      label: tag === 'table' ? `Mesa ${o.tables?.number ?? '?'}` : `Pedido ${o.id.slice(0, 8)}`,
      customerName: o.customer_name ?? null,
      total: o.total ?? 0,
      paymentMethod: pmLabel(o.payment_method ?? 'cash'),
      createdAt: o.created_at,
      closedAt: o.updated_at,
      prepTimeMinutes: prepTime,
      items: orderItems,
      tableNumber: o.tables?.number ?? null,
    });
  }

  // 2. Virtual comandas (comanda digital) — orders linked to virtual_comandas
  const { data: vcData } = await supabase
    .from('virtual_comandas')
    .select('id, short_code, customer_name, created_at, closed_at, total_amount')
    .eq('restaurant_id', restaurantId)
    .in('status', ['paid', 'closed'])
    .gte('closed_at', startIso)
    .lte('closed_at', endIso);

  const vcList = (vcData ?? []) as any[];
  for (const vc of vcList) {
    const { data: vcOrder } = await supabase
      .from('orders')
      .select('id, payment_method, order_items(id, product_name, quantity, unit_price, total_price)')
      .eq('virtual_comanda_id', vc.id)
      .eq('is_paid', true)
      .maybeSingle();

    const ord = vcOrder as any;
    const orderItems = (ord?.order_items ?? []).map((i: any) => ({
      name: i.product_name ?? '—',
      quantity: i.quantity ?? 1,
      unitPrice: i.unit_price ?? 0,
      totalPrice: i.total_price ?? 0,
    }));

    items.push({
      id: `vc-${vc.id}`,
      type: 'order',
      tag: 'comanda',
      label: vc.short_code ?? `VC-${vc.id.slice(0, 8)}`,
      customerName: vc.customer_name ?? null,
      total: vc.total_amount ?? ord?.total ?? 0,
      paymentMethod: ord ? pmLabel(ord.payment_method ?? 'cash') : '—',
      createdAt: vc.created_at,
      closedAt: vc.closed_at ?? vc.created_at,
      prepTimeMinutes: null,
      items: orderItems,
    });
  }

  // 3. Comandas buffet (físicas)
  if (hasBuffet) {
    const { data: comandasData } = await supabase
      .from('comandas')
      .select('id, number, total_amount, opened_at, closed_at, comanda_items(description, quantity, unit_price, total_price)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'closed')
      .gte('closed_at', startIso)
      .lte('closed_at', endIso);

    const comandas = (comandasData ?? []) as any[];
    for (const c of comandas) {
      const comandaItems = (c.comanda_items ?? []).map((i: any) => ({
        name: i.description ?? '—',
        quantity: i.quantity ?? 1,
        unitPrice: i.unit_price ?? 0,
        totalPrice: i.total_price ?? 0,
      }));

      items.push({
        id: `buf-${c.id}`,
        type: 'comanda_buffet',
        tag: 'buffet',
        label: `Comanda ${c.number}`,
        customerName: null,
        total: c.total_amount ?? 0,
        paymentMethod: 'Finalizado',
        createdAt: c.opened_at,
        closedAt: c.closed_at ?? c.opened_at,
        prepTimeMinutes: null,
        items: comandaItems,
        comandaNumber: c.number,
      });
    }
  }

  items.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

  const totalRevenue = items.reduce((s, i) => s + i.total, 0);
  return { orders: items, totalRevenue, totalOrders: items.length };
}

export function useCashierDailyOrders(params: UseCashierDailyOrdersParams) {
  return useQuery({
    queryKey: [
      'cashier-daily-orders',
      params.restaurantId,
      params.period,
      params.customStart?.toISOString(),
      params.customEnd?.toISOString(),
      params.hasTables,
      params.hasBuffet,
    ],
    queryFn: () => fetchCashierDailyOrders(params),
    enabled: !!params.restaurantId,
    staleTime: 60 * 1000,
  });
}
