/** Hooks centralizados para fetch de dados (TanStack Query). Todos aceitam restaurant_id para isolamento multi-tenant. */
export { useRestaurant } from './useRestaurant';
export { useCouriers } from './useCouriers';
export { useCourierMetrics } from './useCourierMetrics';
export type { CourierMetrics } from './useCourierMetrics';
export { useOrderCoordinates } from './useOrderCoordinates';
export type { OrderCoordinate } from './useOrderCoordinates';
export { useProductUpsells, useSaveProductUpsells, fetchUpsellsForProducts } from './useProductUpsells';
export type { UpsellRow } from './useProductUpsells';
export { useDeliveryZones } from './useDeliveryZones';
export { useRestaurantMenuData } from './useRestaurantMenuData';
export type { RestaurantMenuData } from './useRestaurantMenuData';
export { useTables } from './useTables';
export { useWaiterCalls } from './useWaiterCalls';
export { useOrders } from './useOrders';
export type { UseOrdersParams, OrderSourceFilter } from './useOrders';
export { usePrintSettings } from './usePrintSettings';
export { useCategoryDestinations, useProductPrintDestinations } from './useCategoryDestinations';
export type { CategoryDestination } from './useCategoryDestinations';
export {
  useLoyaltyProgram,
  useSaveLoyaltyProgram,
  useLoyaltyStatus,
  useLoyaltyMetrics,
  fetchLoyaltyStatus,
  creditLoyaltyPoint,
  redeemLoyalty,
} from './useLoyaltyProgram';
export type { LoyaltyMetrics } from './useLoyaltyProgram';
export type { PrintSettings } from './usePrintSettings';
export { useDashboardAnalytics } from './useDashboardAnalytics';
export type { UseDashboardAnalyticsParams } from './useDashboardAnalytics';
export { useDashboardKPIs } from './useDashboardKPIs';
export type { UseDashboardKPIsParams } from './useDashboardKPIs';
export { useDashboardStats } from './useDashboardStats';
export type { UseDashboardStatsParams } from './useDashboardStats';
export { useCompletedOrders } from './useCompletedOrders';
export type { UseCompletedOrdersParams, CompletedOrdersDateRange } from './useCompletedOrders';
export { useFeatureAccess } from './useFeatureAccess';
export type { UseFeatureAccessResult } from './useFeatureAccess';
export {
  useSubscriptionPlans,
  useFeaturesCatalog,
  usePlanFeatures,
  useRestaurantSubscription,
  useFeatureOverrides,
  useUpdateSubscription,
  useToggleFeatureOverride,
  subscriptionKeys,
} from './useSubscriptionManager';
export type {
  SubscriptionPlan,
  Feature,
  PlanFeature,
  RestaurantSubscription,
  FeatureOverride,
} from './useSubscriptionManager';
