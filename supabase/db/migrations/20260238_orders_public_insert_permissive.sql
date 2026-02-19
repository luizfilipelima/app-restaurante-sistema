-- =============================================================================
-- Migration: Permitir INSERT público em orders e order_items (cliente anônimo)
-- Data: 2026-02-19
-- =============================================================================
--
-- Garante que QUALQUER pessoa (incluindo anônimos) possa criar pedidos pelo
-- cardápio interativo (delivery, retirada, mesa) e enviar para WhatsApp.
--
-- Abordagem: Remove TODAS as políticas de INSERT e recria com WITH CHECK (true).
-- Isso ignora validações RLS no INSERT - a validação é feita na aplicação.
--
-- =============================================================================

-- 1. Remover TODAS as políticas de INSERT em orders
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
  END LOOP;
END $$;

-- 2. Criar política permissiva para orders (qualquer um pode inserir)
CREATE POLICY "public_insert_orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (true);

-- 3. Remover TODAS as políticas de INSERT em order_items
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', pol.policyname);
  END LOOP;
END $$;

-- 4. Criar política permissiva para order_items (qualquer um pode inserir)
CREATE POLICY "public_insert_order_items"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (true);

-- 5. Garantir que anon e authenticated tenham permissão de INSERT nas tabelas
GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO anon;
GRANT INSERT ON public.order_items TO authenticated;
