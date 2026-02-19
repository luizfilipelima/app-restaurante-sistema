import { supabase } from '@/lib/supabase';
import type { DashboardAdvancedStatsResponse } from '@/types/dashboard-analytics';

interface ComputeFallbackParams {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  areaFilter?: string;
}

interface OrderItemLite {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderLite {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  payment_method: string;
  delivery_type?: string | null;
  order_source?: string | null;
  created_at: string;
  accepted_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
  delivery_zone?: { location_name?: string | null } | null;
  order_items?: OrderItemLite[] | null;
}

const EMPTY_ADVANCED: DashboardAdvancedStatsResponse = {
  kpis: { total_faturado: 0, total_pedidos: 0, ticket_medio: 0, pedidos_pendentes: 0 },
  retention: { clientes_novos: 0, clientes_recorrentes: 0 },
  channels: [],
  sales_trend: [],
  payment_methods: [],
  top_zone: null,
  peak_hours: [],
  top_products: [],
  bottom_products: [],
  operational: {
    avg_prep_time: 0,
    avg_delivery_time: 0,
    idleness_heatmap: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  },
  financial: {
    gross_profit: 0,
    cancel_rate: 0,
    avg_ticket_by_channel: [],
  },
  retention_risk: [],
  menu_matrix: {
    items: [],
    avg_sales_cut: 0,
    avg_margin_cut: 0,
  },
};

function normalizeClientKey(phone?: string | null, name?: string | null): string {
  const phoneDigits = (phone ?? '').replace(/\D/g, '');
  if (phoneDigits) return phoneDigits;
  return (name ?? '').trim().toLowerCase();
}

function orderMatchesArea(order: Pick<OrderLite, 'order_source' | 'delivery_type'>, areaFilter: string) {
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

function getChannel(order: Pick<OrderLite, 'order_source' | 'delivery_type'>): string {
  return order.order_source || order.delivery_type || 'outros';
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchOrdersPage(selectCols: string, tenantId: string, from: number, to: number) {
  return supabase
    .from('orders')
    .select(selectCols)
    .eq('restaurant_id', tenantId)
    .order('created_at', { ascending: true })
    .range(from, to);
}

async function fetchAllOrders(selectCols: string, tenantId: string): Promise<OrderLite[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: OrderLite[] = [];

  while (true) {
    const { data, error } = await fetchOrdersPage(selectCols, tenantId, from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as OrderLite[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchPeriodOrders(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<OrderLite[]> {
  const detailedSelect = `
    id, customer_name, customer_phone, total, status, payment_method,
    delivery_type, order_source, created_at, accepted_at, ready_at, delivered_at,
    delivery_zone:delivery_zones(location_name),
    order_items(product_id, product_name, quantity, unit_price, total_price)
  `;

  const fallbackSelect = `
    id, customer_name, customer_phone, total, status, payment_method,
    delivery_type, order_source, created_at,
    delivery_zone:delivery_zones(location_name),
    order_items(product_id, product_name, quantity, unit_price, total_price)
  `;

  const query = async (selectCols: string) => {
    const pageSize = 1000;
    let from = 0;
    const rows: OrderLite[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('orders')
        .select(selectCols)
        .eq('restaurant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const chunk = (data ?? []) as unknown as OrderLite[];
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  };

  try {
    return await query(detailedSelect);
  } catch {
    return query(fallbackSelect);
  }
}

async function fetchCostMap(productIds: string[]): Promise<Map<string, number>> {
  const costMap = new Map<string, number>();
  if (!productIds.length) return costMap;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, cost_price, price_cost')
      .in('id', productIds);
    if (!error) {
      (data ?? []).forEach((p: any) => {
        costMap.set(p.id, Number(p.cost_price ?? p.price_cost ?? 0));
      });
      return costMap;
    }
  } catch {
    // fallback below
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, price_cost')
    .in('id', productIds);
  if (error) return costMap;
  (data ?? []).forEach((p: any) => {
    costMap.set(p.id, Number(p.price_cost ?? 0));
  });
  return costMap;
}

export async function computeDashboardAdvancedStatsFallback({
  tenantId,
  startDate,
  endDate,
  areaFilter = 'all',
}: ComputeFallbackParams): Promise<DashboardAdvancedStatsResponse> {
  if (!tenantId) return EMPTY_ADVANCED;

  const [periodOrdersAll, allOrdersRaw] = await Promise.all([
    fetchPeriodOrders(tenantId, startDate, endDate),
    fetchAllOrders(
      'id, customer_name, customer_phone, total, status, delivery_type, order_source, created_at',
      tenantId
    ),
  ]);

  const periodOrders = periodOrdersAll.filter((o) => orderMatchesArea(o, areaFilter));
  const nonCancelled = periodOrders.filter((o) => o.status !== 'cancelled');

  const totalRevenue = nonCancelled.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const totalOrders = nonCancelled.length;
  const pendingOrders = periodOrders.filter((o) => o.status === 'pending').length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const paymentMap = new Map<string, number>();
  const channelMap = new Map<string, { sales: number; count: number }>();
  const zoneMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  const productQtyMap = new Map<string, number>();
  const productIds = new Set<string>();

  const prepDurations: number[] = [];
  const deliveryDurations: number[] = [];

  const startDay = new Date(startDate);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endDate);
  endDay.setHours(0, 0, 0, 0);
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  for (let day = new Date(startDay); day <= endDay; day.setDate(day.getDate() + 1)) {
    dailyMap.set(dateKey(day), { revenue: 0, orders: 0 });
  }

  nonCancelled.forEach((o) => {
    const total = Number(o.total ?? 0);
    const method = o.payment_method || 'outros';
    paymentMap.set(method, (paymentMap.get(method) ?? 0) + total);

    const channel = getChannel(o);
    const prevChannel = channelMap.get(channel) ?? { sales: 0, count: 0 };
    channelMap.set(channel, { sales: prevChannel.sales + total, count: prevChannel.count + 1 });

    const zoneName = o.delivery_zone?.location_name?.trim();
    if (zoneName) zoneMap.set(zoneName, (zoneMap.get(zoneName) ?? 0) + 1);

    const createdAt = new Date(o.created_at);
    const hour = createdAt.getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);

    const day = dateKey(createdAt);
    const dayAcc = dailyMap.get(day);
    if (dayAcc) {
      dayAcc.revenue += total;
      dayAcc.orders += 1;
      dailyMap.set(day, dayAcc);
    }

    const acceptedAt = o.accepted_at ? new Date(o.accepted_at) : null;
    const readyAt = o.ready_at ? new Date(o.ready_at) : null;
    const deliveredAt = o.delivered_at ? new Date(o.delivered_at) : null;
    if (acceptedAt && readyAt && readyAt > acceptedAt) {
      prepDurations.push((readyAt.getTime() - acceptedAt.getTime()) / 60000);
    }
    if (readyAt && deliveredAt && deliveredAt > readyAt) {
      deliveryDurations.push((deliveredAt.getTime() - readyAt.getTime()) / 60000);
    }

    (o.order_items ?? []).forEach((item) => {
      const qty = Number(item.quantity ?? 0);
      const itemName = item.product_name || 'Item';
      productQtyMap.set(itemName, (productQtyMap.get(itemName) ?? 0) + qty);
      if (item.product_id) productIds.add(item.product_id);
    });
  });

  const costMap = await fetchCostMap(Array.from(productIds));

  let totalCost = 0;
  nonCancelled.forEach((o) => {
    (o.order_items ?? []).forEach((item) => {
      if (!item.product_id) return;
      const cost = costMap.get(item.product_id) ?? 0;
      totalCost += Number(item.quantity ?? 0) * cost;
    });
  });

  const grossProfit = totalRevenue - totalCost;
  const cancelledCount = periodOrders.filter((o) => o.status === 'cancelled').length;
  const cancelRate = periodOrders.length > 0 ? (cancelledCount / periodOrders.length) * 100 : 0;

  const avgPrepTime = prepDurations.length > 0
    ? prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length
    : 0;
  const avgDeliveryTime = deliveryDurations.length > 0
    ? deliveryDurations.reduce((a, b) => a + b, 0) / deliveryDurations.length
    : 0;

  const idlenessHeatmap = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) ?? 0,
  }));

  const topZoneEntry = Array.from(zoneMap.entries()).sort((a, b) => b[1] - a[1])[0];
  const peakHours = Array.from(hourMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour, count]) => ({ hour, count }));

  const productsRanked = Array.from(productQtyMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  const salesTrend = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    revenue: Number(data.revenue.toFixed(2)),
    orders: data.orders,
  }));

  const paymentMethods = Array.from(paymentMap.entries())
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const channels = Array.from(channelMap.entries())
    .map(([channel, stats]) => ({
      channel,
      total_vendas: Number(stats.sales.toFixed(2)),
      total_pedidos: stats.count,
    }))
    .sort((a, b) => b.total_vendas - a.total_vendas);

  const allNonCancelled = allOrdersRaw.filter((o) => o.status !== 'cancelled');
  const firstOrderByClient = new Map<string, Date>();
  const churnAcc = new Map<string, { nome: string; telefone: string; total: number; lastAt: Date }>();

  allNonCancelled.forEach((o) => {
    const key = normalizeClientKey(o.customer_phone, o.customer_name);
    if (!key) return;
    const createdAt = new Date(o.created_at);

    const first = firstOrderByClient.get(key);
    if (!first || createdAt < first) firstOrderByClient.set(key, createdAt);

    const prev = churnAcc.get(key);
    if (!prev) {
      churnAcc.set(key, {
        nome: o.customer_name,
        telefone: o.customer_phone,
        total: Number(o.total ?? 0),
        lastAt: createdAt,
      });
    } else {
      prev.total += Number(o.total ?? 0);
      if (createdAt > prev.lastAt) {
        prev.lastAt = createdAt;
        prev.nome = o.customer_name || prev.nome;
        prev.telefone = o.customer_phone || prev.telefone;
      }
      churnAcc.set(key, prev);
    }
  });

  const clientsInPeriod = new Set(
    nonCancelled
      .map((o) => normalizeClientKey(o.customer_phone, o.customer_name))
      .filter(Boolean)
  );

  let clientesNovos = 0;
  let clientesRecorrentes = 0;
  clientsInPeriod.forEach((key) => {
    const first = firstOrderByClient.get(key);
    if (!first) return;
    if (first >= startDate && first <= endDate) clientesNovos += 1;
    else if (first < startDate) clientesRecorrentes += 1;
  });

  const churnCut = new Date();
  churnCut.setDate(churnCut.getDate() - 30);
  const retentionRisk = Array.from(churnAcc.values())
    .filter((c) => c.lastAt < churnCut)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)
    .map((c) => ({
      nome: c.nome || 'Cliente',
      telefone: c.telefone || '',
      total_gasto: Number(c.total.toFixed(2)),
    }));

  const productMarginAcc = new Map<string, { name: string; totalSold: number; marginSum: number; lineCount: number }>();
  nonCancelled.forEach((o) => {
    (o.order_items ?? []).forEach((item) => {
      const key = item.product_id || item.product_name || 'Item';
      const name = item.product_name || 'Item';
      const unitPrice = Number(item.unit_price ?? 0);
      const cost = item.product_id ? (costMap.get(item.product_id) ?? 0) : 0;
      const margin = unitPrice - cost;
      const prev = productMarginAcc.get(key) ?? { name, totalSold: 0, marginSum: 0, lineCount: 0 };
      prev.totalSold += Number(item.quantity ?? 0);
      prev.marginSum += margin;
      prev.lineCount += 1;
      productMarginAcc.set(key, prev);
    });
  });

  const marginByProduct = Array.from(productMarginAcc.values()).map((p) => ({
    name: p.name,
    total_sold: p.totalSold,
    avg_margin: Number((p.lineCount > 0 ? p.marginSum / p.lineCount : 0).toFixed(2)),
  }));

  const avgSalesCut = marginByProduct.length > 0
    ? marginByProduct.reduce((acc, i) => acc + i.total_sold, 0) / marginByProduct.length
    : 0;
  const avgMarginCut = marginByProduct.length > 0
    ? marginByProduct.reduce((acc, i) => acc + i.avg_margin, 0) / marginByProduct.length
    : 0;

  const avgTicketByChannel = channels.map((c) => ({
    channel: c.channel,
    avg_ticket: c.total_pedidos > 0
      ? Number((c.total_vendas / c.total_pedidos).toFixed(2))
      : 0,
  }));

  return {
    kpis: {
      total_faturado: Number(totalRevenue.toFixed(2)),
      total_pedidos: totalOrders,
      ticket_medio: Number(avgTicket.toFixed(2)),
      pedidos_pendentes: pendingOrders,
    },
    retention: {
      clientes_novos: clientesNovos,
      clientes_recorrentes: clientesRecorrentes,
    },
    channels,
    sales_trend: salesTrend,
    payment_methods: paymentMethods,
    top_zone: topZoneEntry ? { name: topZoneEntry[0], count: topZoneEntry[1] } : null,
    peak_hours: peakHours,
    top_products: productsRanked.slice(0, 5),
    bottom_products: [...productsRanked].reverse().slice(0, 5),
    operational: {
      avg_prep_time: Number(avgPrepTime.toFixed(2)),
      avg_delivery_time: Number(avgDeliveryTime.toFixed(2)),
      idleness_heatmap: idlenessHeatmap,
    },
    financial: {
      gross_profit: Number(grossProfit.toFixed(2)),
      cancel_rate: Number(cancelRate.toFixed(2)),
      avg_ticket_by_channel: avgTicketByChannel,
    },
    retention_risk: retentionRisk,
    menu_matrix: {
      items: marginByProduct,
      avg_sales_cut: Number(avgSalesCut.toFixed(2)),
      avg_margin_cut: Number(avgMarginCut.toFixed(2)),
    },
  };
}
