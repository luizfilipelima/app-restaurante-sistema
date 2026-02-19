-- =============================================================================
-- Migration: Corrigir RLS orders/order_items para cardápio público (delivery, retirada, mesa)
-- Data: 2026-02-19
-- =============================================================================
--
-- Problema: Clientes anônimos (cardápio público) inseriam order mas falhavam ao inserir
-- order_items porque a policy de order_items faz EXISTS (SELECT FROM orders). O SELECT
-- em orders está sujeito a RLS, e anon não pode ler orders (só staff/super_admin).
-- Resultado: "new row violates row-level security policy for table order_items"
--
-- Solução: Usar função SECURITY DEFINER para validar order_id sem RLS.
--
-- =============================================================================

-- Função auxiliar: verifica se order existe e pertence a restaurante ativo
-- SECURITY DEFINER = roda com privilégios do owner, bypassa RLS na leitura de orders
CREATE OR REPLACE FUNCTION public.order_exists_and_restaurant_active(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = p_order_id
      AND r.is_active = true
      AND r.deleted_at IS NULL
  );
$$;

-- Garantir policies de INSERT para cardápio público
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

-- order_items: usar função SECURITY DEFINER para evitar RLS no SELECT de orders
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND public.order_exists_and_restaurant_active(order_id)
  );

COMMENT ON FUNCTION public.order_exists_and_restaurant_active(uuid) IS
  'Usado em RLS de order_items INSERT. SECURITY DEFINER para que anon possa inserir itens após criar order (o SELECT em orders exigiria permissão que anon não tem).';
