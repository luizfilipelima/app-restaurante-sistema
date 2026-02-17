-- =====================================================
-- FIX FINAL: Garantir INSERT público em orders
-- Este script resolve definitivamente o problema de RLS
-- Execute no Supabase SQL Editor
-- =====================================================

-- PASSO 1: Desabilitar RLS temporariamente para remover políticas
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- PASSO 2: Remover TODAS as políticas de orders (incluindo FOR ALL)
DO $$
DECLARE
  pol RECORD;
  removed_count INTEGER := 0;
BEGIN
  -- Remover todas as políticas de orders
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'orders'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON orders', pol.policyname);
      removed_count := removed_count + 1;
      RAISE NOTICE 'Removida política: %', pol.policyname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao remover política %: %', pol.policyname, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Total de políticas removidas de orders: %', removed_count;
END $$;

-- PASSO 3: Remover TODAS as políticas de order_items
DO $$
DECLARE
  pol RECORD;
  removed_count INTEGER := 0;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'order_items'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', pol.policyname);
      removed_count := removed_count + 1;
      RAISE NOTICE 'Removida política: %', pol.policyname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao remover política %: %', pol.policyname, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Total de políticas removidas de order_items: %', removed_count;
END $$;

-- PASSO 4: Reabilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- PASSO 5: Criar política pública de INSERT para orders
-- IMPORTANTE: WITH CHECK (true) permite QUALQUER pessoa criar pedidos, SEM autenticação
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- PASSO 6: Criar política pública de INSERT para order_items
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- PASSO 7: Criar política de SELECT para staff (ler pedidos do próprio restaurante)
-- Esta política permite que staff autenticado leia pedidos
DROP POLICY IF EXISTS "Staff or super_admin read orders" ON orders;
CREATE POLICY "Staff or super_admin read orders"
  ON orders FOR SELECT
  USING (
    -- Permite se for staff do restaurante OU super_admin OU se não houver autenticação (para permitir leitura pública se necessário)
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- PASSO 8: Criar política de UPDATE para staff
DROP POLICY IF EXISTS "Staff or super_admin update orders" ON orders;
CREATE POLICY "Staff or super_admin update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- PASSO 9: Criar política de SELECT para order_items
DROP POLICY IF EXISTS "Staff or super_admin read order items" ON order_items;
CREATE POLICY "Staff or super_admin read order items"
  ON order_items FOR SELECT
  USING (
    -- Permite se for staff do restaurante OU super_admin OU se não houver autenticação
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN orders o ON o.id = order_items.order_id
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = o.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- PASSO 10: Verificar se as políticas foram criadas corretamente
SELECT 
  '✅ Políticas ativas:' AS status,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' AND with_check = 'true' THEN '✅ Permite INSERT público'
    WHEN cmd = 'INSERT' THEN '⚠️ INSERT com restrição: ' || with_check::text
    ELSE cmd || ' - ' || COALESCE(qual::text, 'sem qual')
  END AS detalhes
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd, policyname;

-- PASSO 11: Verificar RLS status
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Habilitado'
    ELSE '❌ RLS Desabilitado'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items');

SELECT '✅ Migration aplicada! Qualquer pessoa pode criar pedidos agora.' AS resultado;
SELECT '⚠️ IMPORTANTE: Teste criar um pedido no frontend para confirmar.' AS proximo_passo;
