/**
 * Tipos para a resposta da RPC get_dashboard_analytics
 */

export interface DashboardKPIs {
  total_faturado: number;
  total_pedidos: number;
  ticket_medio: number;
  pedidos_pendentes: number;
}

export interface DashboardRetention {
  clientes_novos: number;
  clientes_recorrentes: number;
}

export interface DashboardChannel {
  channel: string;
  total_vendas: number;
  total_pedidos: number;
}

export interface DashboardSalesTrendItem {
  date: string;
  revenue: number;
  orders: number;
}

export interface DashboardPaymentMethod {
  name: string;
  value: number;
}

export interface DashboardTopZone {
  name: string;
  count: number;
}

export interface DashboardPeakHour {
  hour: number;
  count: number;
}

export interface DashboardProductCount {
  name: string;
  quantity: number;
}

export interface DashboardAnalyticsResponse {
  kpis: DashboardKPIs;
  retention: DashboardRetention;
  channels: DashboardChannel[];
  sales_trend: DashboardSalesTrendItem[];
  payment_methods?: DashboardPaymentMethod[];
  top_zone?: DashboardTopZone | null;
  peak_hours?: DashboardPeakHour[];
  top_products?: DashboardProductCount[];
  bottom_products?: DashboardProductCount[];
}
