import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export type CashierCompletedDateRange = 'today' | '7d' | '30d';

export interface CashierCompletedItem {
  id: string;
  type: 'table' | 'comanda_digital' | 'comanda_buffet';
  label: string;
  totalAmount: number;
  arrivalAt: string;
  exitAt: string;
  paymentMethods: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** E-mail do usuário que finalizou o atendimento (painel ou central do garçom) */
  closedByEmail?: string | null;
  order?: import('@/types').DatabaseOrder;
  comandaBuffet?: {
    number: number;
    items: { description: string; quantity: number; total_price: number }[];
  };
}

export function getCashierDateRangeBounds(range: CashierCompletedDateRange): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;
  if (range === 'today') {
    start = startOfDay(new Date());
  } else if (range === '7d') {
    start = startOfDay(subDays(new Date(), 7));
  } else {
    start = startOfDay(subDays(new Date(), 30));
  }
  return { start, end };
}

export interface UseCashierCompletedOrdersParams {
  restaurantId: string | null;
  dateRange: CashierCompletedDateRange;
  hasTables?: boolean;
  hasBuffet?: boolean;
}

async function fetchCashierCompleted({
  restaurantId,
  dateRange,
  hasTables,
  hasBuffet,
}: UseCashierCompletedOrdersParams): Promise<CashierCompletedItem[]> {
  if (!restaurantId) return [];
  const { start, end } = getCashierDateRangeBounds(dateRange);
  const items: CashierCompletedItem[] = [];
  const startIso = start.toISOString();
  const endIso = endOfDay(end).toISOString();

  const pmLabel = (m: string) => {
    const map: Record<string, string> = {
      cash: 'Dinheiro', card: 'Cartão', pix: 'PIX', bank_transfer: 'Transferência',
      table: 'Mesa', qrcode: 'QR Code',
    };
    return map[m] ?? m;
  };

  const [ordersRes, vcRes, comandasRes] = await Promise.all([
    hasTables
      ? supabase
          .from('orders')
          .select(`
            id, customer_name, total, created_at, updated_at, payment_method, customer_phone,
            table_id, order_source, closed_by_user_id,
            order_items(id, product_name, quantity, unit_price, total_price, observations, customer_name),
            tables(number)
          `)
          .eq('restaurant_id', restaurantId)
          .eq('is_paid', true)
          .eq('order_source', 'table')
          .gte('updated_at', startIso)
          .lte('updated_at', endIso)
      : { data: [] },
    supabase
      .from('virtual_comandas')
      .select('id, short_code, customer_name, created_at, closed_at, total_amount, closed_by_user_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['paid', 'closed'])
      .gte('closed_at', startIso)
      .lte('closed_at', endIso)
      .order('closed_at', { ascending: false }),
    hasBuffet
      ? supabase
          .from('comandas')
          .select('id, number, total_amount, opened_at, closed_at, closed_by_user_id, comanda_items(id, description, quantity, unit_price, total_price)')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'closed')
          .gte('closed_at', startIso)
          .lte('closed_at', endIso)
          .order('closed_at', { ascending: false })
      : { data: [] },
  ]);

  const userIds = new Set<string>();
  const ordersData = (ordersRes.data ?? []) as any[];
  const byTable = new Map<string, any[]>();
  for (const o of ordersData) {
    if (o.closed_by_user_id) userIds.add(o.closed_by_user_id);
    const tid = o.table_id ?? 'unknown';
    if (!byTable.has(tid)) byTable.set(tid, []);
    byTable.get(tid)!.push(o);
  }
  const vcData = (vcRes.data ?? []) as any[];
  vcData.forEach((vc: any) => { if (vc.closed_by_user_id) userIds.add(vc.closed_by_user_id); });
  const comandasData = (comandasRes.data ?? []) as any[];
  comandasData.forEach((c: any) => { if (c.closed_by_user_id) userIds.add(c.closed_by_user_id); });

  const emailByUserId = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email')
      .in('id', Array.from(userIds));
    (usersData ?? []).forEach((u: { id: string; email: string }) => emailByUserId.set(u.id, u.email ?? ''));
  }

  for (const [, orders] of byTable) {
    const first = orders[0];
    const lastExitOrder = [...orders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    const closedByUserId = lastExitOrder?.closed_by_user_id ?? first?.closed_by_user_id;
    const tableNumber = first.tables?.number ?? first.table_id ?? '?';
    const totalAmount = orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0);
    const sortedByArrival = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const sortedByExit = [...orders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const arrivalAt = sortedByArrival[0]?.created_at ?? first.created_at;
    const exitAt = sortedByExit[0]?.updated_at ?? first.updated_at;
    const paymentLabels = [...new Set(orders.map((o: any) => pmLabel(o.payment_method ?? 'cash')))];
    const paymentMethods = paymentLabels.join(', ');
    const orderItems = orders.flatMap((o: any) => (o.order_items ?? []));
    const mergedOrder = {
      ...first,
      id: first.id,
      total: totalAmount,
      order_items: orderItems,
      customer_name: first.customer_name ?? `Mesa ${tableNumber}`,
      customer_phone: first.customer_phone,
    };
    items.push({
      id: `table-${first.table_id ?? first.id}`,
      type: 'table',
      label: `Mesa ${tableNumber}`,
      totalAmount,
      arrivalAt,
      exitAt,
      paymentMethods,
      customerName: first.customer_name,
      customerPhone: first.customer_phone,
      closedByEmail: closedByUserId ? emailByUserId.get(closedByUserId) ?? null : null,
      order: mergedOrder as import('@/types').DatabaseOrder,
    });
  }

  for (const vc of vcData) {
    const { data: ord } = await supabase
      .from('orders')
      .select(`
        id, restaurant_id, customer_name, customer_phone, total, subtotal, delivery_fee, payment_method,
        delivery_type, delivery_address, order_source, notes, created_at, status, is_paid, updated_at,
        closed_by_user_id,
        order_items(id, product_name, quantity, unit_price, total_price, observations),
        delivery_zone:delivery_zones(id, location_name, fee)
      `)
      .eq('virtual_comanda_id', vc.id)
      .eq('is_paid', true)
      .maybeSingle();
    const closedByUserId = ord?.closed_by_user_id ?? vc.closed_by_user_id;
    items.push({
      id: `vc-${vc.id}`,
      type: 'comanda_digital',
      label: vc.short_code ?? `VC-${vc.id.slice(0, 8)}`,
      totalAmount: vc.total_amount ?? 0,
      arrivalAt: vc.created_at,
      exitAt: vc.closed_at ?? vc.created_at,
      paymentMethods: ord ? pmLabel(ord.payment_method ?? 'cash') : '—',
      customerName: vc.customer_name ?? ord?.customer_name,
      customerPhone: ord?.customer_phone,
      closedByEmail: closedByUserId ? emailByUserId.get(closedByUserId) ?? null : null,
      order: ord ? (ord as unknown as import('@/types').DatabaseOrder) : undefined,
    });
  }

  comandasData.forEach((c: any) => {
    const closedByUserId = c.closed_by_user_id;
    items.push({
      id: `buf-${c.id}`,
      type: 'comanda_buffet',
      label: `Comanda ${c.number}`,
      totalAmount: c.total_amount ?? 0,
      arrivalAt: c.opened_at,
      exitAt: c.closed_at ?? c.opened_at,
      paymentMethods: 'Finalizado',
      closedByEmail: closedByUserId ? emailByUserId.get(closedByUserId) ?? null : null,
      comandaBuffet: {
        number: c.number,
        items: (c.comanda_items ?? []).map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          total_price: i.total_price,
        })),
      },
    });
  });

  items.sort((a, b) => new Date(b.exitAt).getTime() - new Date(a.exitAt).getTime());
  return items;
}

export function useCashierCompletedOrders(params: UseCashierCompletedOrdersParams) {
  return useQuery({
    queryKey: ['cashier-completed', params.restaurantId, params.dateRange, params.hasTables, params.hasBuffet],
    queryFn: () => fetchCashierCompleted(params),
    enabled: !!params.restaurantId,
    staleTime: 60 * 1000,
  });
}
