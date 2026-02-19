/** Hooks centralizados para fetch de dados (TanStack Query). Todos aceitam restaurant_id para isolamento multi-tenant. */
export { useRestaurant } from './useRestaurant';
export { useCouriers } from './useCouriers';
export { useDeliveryZones } from './useDeliveryZones';
export { useTables } from './useTables';
export { useWaiterCalls } from './useWaiterCalls';
export { useOrders } from './useOrders';
export type { UseOrdersParams, OrderSourceFilter } from './useOrders';
export { usePrintSettings } from './usePrintSettings';
export type { PrintSettings } from './usePrintSettings';
export { useDashboardAnalytics } from './useDashboardAnalytics';
export type { UseDashboardAnalyticsParams } from './useDashboardAnalytics';
export { useDashboardKPIs } from './useDashboardKPIs';
export type { UseDashboardKPIsParams } from './useDashboardKPIs';
export { useDashboardStats } from './useDashboardStats';
export type { UseDashboardStatsParams } from './useDashboardStats';
export { useCompletedOrders } from './useCompletedOrders';
export type { UseCompletedOrdersParams, CompletedOrdersDateRange } from './useCompletedOrders';
