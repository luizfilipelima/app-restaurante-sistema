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

// ========== get_advanced_dashboard_stats ==========

export interface DashboardOperational {
  avg_prep_time: number;
  avg_delivery_time: number;
  idleness_heatmap: { hour: number; count: number }[];
}

export interface DashboardFinancial {
  gross_profit: number;
  total_cost?: number;
  cost_by_ingredients?: number;
  cancel_rate: number;
  avg_ticket_by_channel: { channel: string; avg_ticket: number }[];
}

export interface DashboardRetentionRiskItem {
  nome: string;
  telefone: string;
  total_gasto: number;
}

export interface DashboardMenuMatrixItem {
  name: string;
  total_sold: number;
  avg_margin: number;
}

export interface DashboardMenuMatrix {
  items: DashboardMenuMatrixItem[];
  avg_sales_cut: number;
  avg_margin_cut: number;
}

export interface DashboardAdvancedStatsResponse extends DashboardAnalyticsResponse {
  operational?: DashboardOperational;
  financial?: DashboardFinancial;
  retention_risk?: DashboardRetentionRiskItem[];
  menu_matrix?: DashboardMenuMatrix;
}
