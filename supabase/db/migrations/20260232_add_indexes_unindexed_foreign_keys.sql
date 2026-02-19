-- =============================================================================
-- Migration: Índices para colunas FK sem índice (unindexed_foreign_keys)
-- Data: 2026-02-32
-- =============================================================================
--
-- Adiciona índices em colunas referenciadas por foreign keys que ainda não
-- possuem índice. Melhora desempenho de JOINs e CASCADE/DELETE.
--
-- Baseado no linter: unindexed_foreign_keys (PERFORMANCE)
--
-- =============================================================================

-- comanda_items.product_id
CREATE INDEX IF NOT EXISTS idx_comanda_items_product_id
  ON public.comanda_items (product_id);

-- order_items.product_id
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id);

-- orders.delivery_zone_id
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone_id
  ON public.orders (delivery_zone_id);

-- restaurant_feature_overrides.created_by
CREATE INDEX IF NOT EXISTS idx_restaurant_feature_overrides_created_by
  ON public.restaurant_feature_overrides (created_by);

-- restaurant_user_roles.invited_by
CREATE INDEX IF NOT EXISTS idx_restaurant_user_roles_invited_by
  ON public.restaurant_user_roles (invited_by);

-- virtual_comanda_items.product_id
CREATE INDEX IF NOT EXISTS idx_virtual_comanda_items_product_id
  ON public.virtual_comanda_items (product_id);

-- waiter_calls.table_id
CREATE INDEX IF NOT EXISTS idx_waiter_calls_table_id
  ON public.waiter_calls (table_id);
