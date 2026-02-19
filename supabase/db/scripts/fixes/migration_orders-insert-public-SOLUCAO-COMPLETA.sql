-- =====================================================
-- SOLUÇÃO COMPLETA: Remover TODAS as políticas e recriar
-- Execute esta se o script DEFINITIVO não funcionou
-- =====================================================

-- PASSO 1: Desabilitar RLS temporariamente para poder remover políticas
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- PASSO 2: Remover TODAS as políticas de orders (usando loop dinâmico)
DO $$
DECLARE
  pol RECORD;
  count_policies INTEGER := 0;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON orders', pol.policyname);
    count_policies := count_policies + 1;
  END LOOP;
  RAISE NOTICE 'Removidas % políticas de orders', count_policies;
END $$;

-- PASSO 3: Remover TODAS as políticas de order_items
DO $$
DECLARE
  pol RECORD;
  count_policies INTEGER := 0;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', pol.policyname);
    count_policies := count_policies + 1;
  END LOOP;
  RAISE NOTICE 'Removidas % políticas de order_items', count_policies;
END $$;

-- PASSO 4: Reabilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- PASSO 5: Criar política pública de INSERT para orders
-- Esta política permite QUALQUER pessoa criar pedidos, mesmo sem autenticação
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- PASSO 6: Criar política pública de INSERT para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- PASSO 7: Criar política de SELECT para staff (ler pedidos do próprio restaurante)
CREATE POLICY "Staff or super_admin read orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- PASSO 8: Criar política de UPDATE para staff (atualizar pedidos do próprio restaurante)
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

-- PASSO 9: Criar política de SELECT para order_items (staff pode ler itens dos pedidos)
CREATE POLICY "Staff or super_admin read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN orders o ON o.id = order_items.order_id
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = o.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- PASSO 10: Verificar se as políticas foram criadas corretamente
SELECT 
  '✅ Políticas criadas:' AS status,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN with_check = 'true' THEN '✅ Permite INSERT'
    ELSE with_check::text
  END AS with_check_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd, policyname;

-- PASSO 11: Teste rápido - verificar se RLS está habilitado
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Habilitado'
    ELSE '❌ RLS Desabilitado'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items');

SELECT '✅ Migration completa! Agora qualquer pessoa pode criar pedidos.' AS resultado;
