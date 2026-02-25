/**
 * Hook para o Dashboard BI do Super Admin.
 * Agrega métricas de SaaS + faturamento (GMV) por período e por plano.
 */

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { convertBetweenCurrencies, type CurrencyCode, type ExchangeRates } from '@/lib/priceHelper';

export type PlanFilter = 'all' | 'core' | 'standard' | 'enterprise';

export interface RestaurantWithPlan {
  id: string;
  name: string;
  slug: string;
  currency: string;
  plan_name: string;
  plan_label: string;
  price_brl: number;
  manual_monthly_revenue_brl: number | null;
  gmv_total_brl: number;
  gmv_7d_brl: number;
  gmv_30d_brl: number;
  orders_total: number;
  orders_7d: number;
  orders_30d: number;
  created_at: string;
}

export interface DashboardBIMetrics {
  // SaaS
  total_mrr: number;
  total_tenants: number;
  new_tenants_7d: number;
  new_tenants_30d: number;
  arpu: number;
  revenue_by_plan: { plan_name: string; plan_label: string; tenant_count: number; monthly_revenue_brl: number }[];

  // GMV (faturamento dos restaurantes, convertido para BRL)
  gmv_total_brl: number;
  gmv_7d_brl: number;
  gmv_30d_brl: number;
  orders_total: number;
  orders_7d: number;
  orders_30d: number;
  ticket_medio_brl: number;

  // Detalhamento por restaurante
  restaurants: RestaurantWithPlan[];
}

export const dashboardBIKey = () => ['super-admin-dashboard-bi'] as const;

async function fetchDashboardBI(): Promise<DashboardBIMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [restaurantsRes, ordersRes, subsRes, plansRes, settingsRes] = await Promise.all([
    supabase.from('restaurants').select('id, name, slug, currency, created_at, deleted_at, is_active, manual_monthly_revenue_brl').is('deleted_at', null),
    supabase.from('orders').select('restaurant_id, total, created_at').neq('status', 'cancelled'),
    supabase.from('restaurant_subscriptions').select('restaurant_id, plan_id').in('status', ['active', 'trial']),
    supabase.from('subscription_plans').select('id, name, label, price_brl, sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('super_admin_settings').select('value').eq('key', 'exchange_rates').maybeSingle(),
  ]);

  if (restaurantsRes.error) throw restaurantsRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (subsRes.error) throw subsRes.error;
  if (plansRes.error) throw plansRes.error;

  const restaurants = (restaurantsRes.data ?? []).filter((r: { is_active: boolean }) => r.is_active);
  const orders = ordersRes.data ?? [];
  const subs = subsRes.data ?? [];
  const plans = plansRes.data ?? [];

  const planMap = new Map(plans.map((p: { id: string; name: string; label: string; price_brl: number }) => [p.id, { name: p.name, label: p.label, price_brl: p.price_brl }]));
  const subByRestaurant = new Map(subs.map((s: { restaurant_id: string; plan_id: string }) => [s.restaurant_id, s.plan_id]));

  const rates: ExchangeRates = (settingsRes.data?.value as ExchangeRates) ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };

  const restaurantCurrency = new Map(restaurants.map((r: { id: string; currency?: string }) => [r.id, (r.currency || 'BRL') as CurrencyCode]));

  const restaurantIds = new Set(restaurants.map((r: { id: string }) => r.id));

  const gmvByRestaurant: Record<string, { total: number; gmv7d: number; gmv30d: number; count: number; count7d: number; count30d: number }> = {};
  for (const id of restaurantIds) {
    gmvByRestaurant[id] = { total: 0, gmv7d: 0, gmv30d: 0, count: 0, count7d: 0, count30d: 0 };
  }

  for (const o of orders as { restaurant_id: string; total?: number; created_at?: string }[]) {
    if (!restaurantIds.has(o.restaurant_id)) continue;
    const cur = restaurantCurrency.get(o.restaurant_id) ?? 'BRL';
    const tot = o.total ?? 0;
    const created = o.created_at ? new Date(o.created_at) : null;
    const gmvBRL = convertBetweenCurrencies(tot, cur, 'BRL', rates);

    const bucket = gmvByRestaurant[o.restaurant_id];
    bucket.total += gmvBRL;
    bucket.count += 1;
    if (created && created >= sevenDaysAgo) {
      bucket.gmv7d += gmvBRL;
      bucket.count7d += 1;
    }
    if (created && created >= thirtyDaysAgo) {
      bucket.gmv30d += gmvBRL;
      bucket.count30d += 1;
    }
  }

  let totalMrr = 0;
  const revenueByPlan: { plan_name: string; plan_label: string; tenant_count: number; monthly_revenue_brl: number }[] = [];
  const planStats: Record<string, { count: number; revenue: number }> = { core: { count: 0, revenue: 0 }, standard: { count: 0, revenue: 0 }, enterprise: { count: 0, revenue: 0 } };

  const restaurantsWithPlan: RestaurantWithPlan[] = [];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  for (const r of restaurants) {
    const planId = subByRestaurant.get(r.id);
    const planInfo = planId ? planMap.get(planId) : null;
    const planName = planInfo?.name ?? 'core';
    const planLabel = planInfo?.label ?? 'Core';
    const priceBrl = r.manual_monthly_revenue_brl ?? planInfo?.price_brl ?? 0;
    totalMrr += priceBrl;
    planStats[planName] = planStats[planName] ?? { count: 0, revenue: 0 };
    planStats[planName].count += 1;
    planStats[planName].revenue += priceBrl;

    const gmv = gmvByRestaurant[r.id] ?? { total: 0, gmv7d: 0, gmv30d: 0, count: 0, count7d: 0, count30d: 0 };
    restaurantsWithPlan.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      currency: r.currency ?? 'BRL',
      plan_name: planName,
      plan_label: planLabel,
      price_brl: priceBrl,
      manual_monthly_revenue_brl: r.manual_monthly_revenue_brl ?? null,
      gmv_total_brl: gmv.total,
      gmv_7d_brl: gmv.gmv7d,
      gmv_30d_brl: gmv.gmv30d,
      orders_total: gmv.count,
      orders_7d: gmv.count7d,
      orders_30d: gmv.count30d,
      created_at: r.created_at,
    });
  }

  for (const p of plans as { name: string; label: string }[]) {
    const s = planStats[p.name] ?? { count: 0, revenue: 0 };
    revenueByPlan.push({
      plan_name: p.name,
      plan_label: p.label,
      tenant_count: s.count,
      monthly_revenue_brl: Math.round(s.revenue * 100) / 100,
    });
  }

  const gmvTotal = restaurantsWithPlan.reduce((a, r) => a + r.gmv_total_brl, 0);
  const gmv7d = restaurantsWithPlan.reduce((a, r) => a + r.gmv_7d_brl, 0);
  const gmv30d = restaurantsWithPlan.reduce((a, r) => a + r.gmv_30d_brl, 0);
  const ordersTotal = restaurantsWithPlan.reduce((a, r) => a + r.orders_total, 0);
  const orders7d = restaurantsWithPlan.reduce((a, r) => a + r.orders_7d, 0);
  const orders30d = restaurantsWithPlan.reduce((a, r) => a + r.orders_30d, 0);
  const newTenants7d = restaurants.filter((r: { created_at: string }) => r.created_at >= sevenDaysAgoStr).length;
  const newTenants30d = restaurants.filter((r: { created_at: string }) => r.created_at >= thirtyDaysAgoStr).length;

  return {
    total_mrr: Math.round(totalMrr * 100) / 100,
    total_tenants: restaurants.length,
    new_tenants_7d: newTenants7d,
    new_tenants_30d: newTenants30d,
    arpu: restaurants.length > 0 ? Math.round((totalMrr / restaurants.length) * 100) / 100 : 0,
    revenue_by_plan: revenueByPlan,
    gmv_total_brl: gmvTotal,
    gmv_7d_brl: gmv7d,
    gmv_30d_brl: gmv30d,
    orders_total: ordersTotal,
    orders_7d: orders7d,
    orders_30d: orders30d,
    ticket_medio_brl: ordersTotal > 0 ? Math.round((gmvTotal / ordersTotal) * 100) / 100 : 0,
    restaurants: restaurantsWithPlan,
  };
}

export function useSuperAdminDashboardBI() {
  return useQuery<DashboardBIMetrics>({
    queryKey: dashboardBIKey(),
    queryFn: fetchDashboardBI,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
    refetchInterval: 1000 * 60 * 2,
  });
}

export function useInvalidateDashboardBI() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['super-admin-dashboard-bi'] });
}
