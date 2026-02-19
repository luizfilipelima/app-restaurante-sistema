-- =============================================================================
-- Migration: Corrigir RLS orders/order_items para cardápio público (delivery, retirada, mesa)
-- Data: 2026-02-19
-- =============================================================================
--
-- Problema: "new row violates row-level security policy for table orders"
-- Clientes anônimos (cardápio público) falham ao criar pedidos porque:
-- 1) orders INSERT usa EXISTS (SELECT FROM restaurants) - anon pode não conseguir ler restaurants
-- 2) order_items INSERT usa EXISTS (SELECT FROM orders) - anon não pode ler orders
--
-- Solução: Funções SECURITY DEFINER que bypassam RLS ao validar.
--
-- =============================================================================

-- 1) orders: validar que restaurant existe e está ativo (SECURITY DEFINER bypassa RLS em restaurants)
CREATE OR REPLACE FUNCTION public.restaurant_is_active(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.is_active = true
      AND r.deleted_at IS NULL
  );
$$;

-- 2) order_items: validar que order existe e pertence a restaurante ativo (SECURITY DEFINER bypassa RLS)
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

-- orders INSERT: usar função SECURITY DEFINER (não subquery em restaurants)
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND public.restaurant_is_active(restaurant_id)
  );

-- order_items INSERT: usar função SECURITY DEFINER (não subquery em orders)
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND public.order_exists_and_restaurant_active(order_id)
  );

COMMENT ON FUNCTION public.restaurant_is_active(uuid) IS
  'RLS orders INSERT. SECURITY DEFINER para anon poder criar pedidos (subquery em restaurants pode falhar para anon).';
COMMENT ON FUNCTION public.order_exists_and_restaurant_active(uuid) IS
  'RLS order_items INSERT. SECURITY DEFINER para anon inserir itens após criar order (anon não pode ler orders).';
