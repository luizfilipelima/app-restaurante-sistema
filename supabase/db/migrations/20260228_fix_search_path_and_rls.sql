-- =============================================================================
-- Migration: Corrige lints do Supabase Security Advisor
-- Data: 2026-02-28
-- =============================================================================
--
-- 1) function_search_path_mutable: define search_path = public em funções
--    que não tinham, evitando ataques de search_path hijacking.
--
-- 2) rls_policy_always_true: substitui WITH CHECK (true) por validações que
--    restringem inserts a restaurantes ativos e existentes, mantendo o fluxo
--    público (clientes anônimos podem criar pedidos).
--
-- Referência: https://supabase.com/docs/guides/database/database-linter
--
-- Nota: auth_leaked_password_protection deve ser habilitado manualmente no
-- Dashboard Supabase: Auth → Settings → Leaked password protection
-- =============================================================================

-- ── 1. SET search_path = public em todas as funções afetadas ─────────────────

ALTER FUNCTION public.get_next_product_order_index(uuid, text) SET search_path = public;
ALTER FUNCTION public.update_subcategories_updated_at() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_sessions() SET search_path = public;
ALTER FUNCTION public.calculate_comanda_total(uuid) SET search_path = public;
ALTER FUNCTION public.update_comanda_total() SET search_path = public;
ALTER FUNCTION public.get_next_comanda_number(uuid) SET search_path = public;
ALTER FUNCTION public.register_session(uuid, uuid, character varying) SET search_path = public;
ALTER FUNCTION public.remove_session(uuid, character varying) SET search_path = public;
ALTER FUNCTION public.update_session_heartbeat(uuid, character varying) SET search_path = public;
ALTER FUNCTION public.get_next_category_order_index(uuid) SET search_path = public;
ALTER FUNCTION public.update_categories_updated_at() SET search_path = public;
ALTER FUNCTION public.update_categories_order(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.get_restaurant_currency(uuid) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.restaurant_has_feature(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_saas_metrics() SET search_path = public;
ALTER FUNCTION public.normalize_slug(text) SET search_path = public;
ALTER FUNCTION public.recalculate_virtual_comanda_total() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.create_super_admin(character varying, uuid) SET search_path = public;
ALTER FUNCTION public.update_couriers_updated_at() SET search_path = public;


-- ── 2. RLS policies menos permissivas para orders e order_items ──────────────
-- Mantém INSERT público (clientes anônimos), mas valida que:
--   • orders: restaurant_id referencia restaurante ativo e não deletado
--   • order_items: order_id referencia pedido de restaurante ativo

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id
        AND r.is_active = true
        AND r.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = order_id
        AND r.is_active = true
        AND r.deleted_at IS NULL
    )
  );
