-- =============================================================================
-- Migration: Corrigir avisos do Supabase Security Advisor
-- Data: 2026-02-20
-- =============================================================================
--
-- 1) function_search_path_mutable: set_landing_page_updated_at sem search_path fixo
-- 2) rls_policy_always_true: políticas public_insert_orders e public_insert_order_items
--    com WITH CHECK (true) — todas as inserções passam por place_order, sync_virtual_comanda,
--    close_virtual_comanda (SECURITY DEFINER), que bypassam RLS. Removemos as políticas
--    permissivas para evitar bypass direto.
--
-- NOTA: auth_leaked_password_protection — habilitar manualmente no Supabase:
-- Authentication > Settings > Security > Leaked Password Protection
-- Ver docs/SECURITY_ADVISOR_CONFIG.md para instruções.
--
-- =============================================================================

-- 1. Corrigir search_path na função set_landing_page_updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_landing_page_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- 2. Remover políticas permissivas de INSERT em orders e order_items
-- Todas as inserções são feitas via funções SECURITY DEFINER (place_order,
-- sync_virtual_comanda_to_order, close_virtual_comanda, etc.), que bypassam RLS.
-- Remover essas políticas evita INSERT direto e não afeta o fluxo da aplicação.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "public_insert_order_items" ON public.order_items;
