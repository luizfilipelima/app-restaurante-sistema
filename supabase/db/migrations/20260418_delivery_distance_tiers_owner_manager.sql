-- =============================================================================
-- Migration: delivery_distance_tiers — permitir owner e manager (RLS)
-- Data: 2026-04-18
--
-- As políticas antigas checavam u.role IN ('owner', 'admin', 'manager'), mas
-- em public.users a role do proprietário é restaurant_admin; owner/manager
-- vêm de restaurant_user_roles. Isso impedia proprietário e gerente de
-- adicionar/editar faixas de quilometragem.
--
-- Atualiza INSERT/UPDATE/DELETE para usar current_user_can_admin_restaurant(),
-- alinhado a delivery_zones e às demais tabelas do painel.
-- =============================================================================

DROP POLICY IF EXISTS "delivery_distance_tiers_insert_admin" ON public.delivery_distance_tiers;
DROP POLICY IF EXISTS "delivery_distance_tiers_update_admin" ON public.delivery_distance_tiers;
DROP POLICY IF EXISTS "delivery_distance_tiers_delete_admin" ON public.delivery_distance_tiers;

CREATE POLICY "delivery_distance_tiers_insert_admin"
  ON public.delivery_distance_tiers
  FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(delivery_distance_tiers.restaurant_id)));

CREATE POLICY "delivery_distance_tiers_update_admin"
  ON public.delivery_distance_tiers
  FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(delivery_distance_tiers.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(delivery_distance_tiers.restaurant_id)));

CREATE POLICY "delivery_distance_tiers_delete_admin"
  ON public.delivery_distance_tiers
  FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(delivery_distance_tiers.restaurant_id)));
