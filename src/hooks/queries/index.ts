/** Hooks centralizados para fetch de dados (TanStack Query). Todos aceitam restaurant_id para isolamento multi-tenant. */
export { useRestaurant } from './useRestaurant';
export { useCouriers } from './useCouriers';
export { useCourierMetrics } from './useCourierMetrics';
export type { CourierMetrics } from './useCourierMetrics';
export { useProductUpsells, useSaveProductUpsells, fetchUpsellsForProducts } from './useProductUpsells';
export { useProductComboItems, useProductComboItemsMap, useSaveProductComboItems } from './useProductComboItems';
export { useProductAddons, useProductAddonsMap, useSaveProductAddons } from './useProductAddons';
export { useProductOffers, useActiveOffers, useActiveOffersByRestaurantId, fetchActiveOffersBySlug } from './useProductOffers';
export { useDiscountCoupons, validateCoupon, useHasActiveCoupons } from './useDiscountCoupons';
export type { UpsellRow } from './useProductUpsells';
export { useDeliveryZones } from './useDeliveryZones';
export {
  useDeliveryDistanceTiers,
  useCreateDeliveryDistanceTier,
  useUpdateDeliveryDistanceTier,
  useDeleteDeliveryDistanceTier,
} from './useDeliveryDistanceTiers';
export { useRestaurantMenuData } from './useRestaurantMenuData';
export type { RestaurantMenuData } from './useRestaurantMenuData';
export { useTables } from './useTables';
export { useTableStatuses } from './useTableStatuses';
export { useResetTable, resetTable } from './useResetTable';
export { useCloseTableAccount } from './useCloseTableAccount';
export type { CloseTablePaymentMethod } from './useCloseTableAccount';
export { useCancelVirtualComanda } from './useCancelVirtualComanda';
export {
  useReservations,
  useCreateReservation,
  useCancelReservation,
} from './useReservations';
export type { Reservation, ReservationWithDetails, ReservationStatus } from './useReservations';
export {
  useWaitingQueue,
  useAddToWaitingQueue,
  useNotifyQueueItem,
} from './useWaitingQueue';
export type { WaitingQueueItem } from './useWaitingQueue';
export type { TableWithStatus, TableStatus } from './useTableStatuses';
export { useTableOrders } from './useTableOrders';
export {
  useHallZones,
  useCreateHallZone,
  useUpdateHallZone,
  useDeleteHallZone,
} from './useHallZones';
export {
  useTableComandaLinks,
  useLinkComandaToTable,
  useUnlinkComandaFromTable,
} from './useTableComandaLinks';
export type { TableComandaLinkWithComanda } from './useTableComandaLinks';
export type { TableOrderWithItems } from './useTableOrders';
export { useWaiterCalls } from './useWaiterCalls';
export { useAdminProducts } from './useAdminProducts';
export { useOrders } from './useOrders';
export type { UseOrdersParams, OrderSourceFilter } from './useOrders';
export { isDeliveryOrPickupOrder, getOrderSector } from './useOrders';
export type { OrderSectorKey } from './useOrders';
export { usePrintSettings } from './usePrintSettings';
export { useProductPrintDestinations } from './useCategoryDestinations';
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
