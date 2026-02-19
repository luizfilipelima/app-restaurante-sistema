-- =====================================================
-- Migration FORCE: Forçar INSERT público em orders
-- Use esta se NADA mais funcionar - remove TUDO e recria
-- =====================================================

-- Desabilitar temporariamente RLS para garantir que podemos criar políticas
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas de orders (cuidado: isso remove SELECT, UPDATE, DELETE também)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON orders', pol.policyname);
  END LOOP;
END $$;

-- Remover TODAS as políticas de order_items
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', pol.policyname);
  END LOOP;
END $$;

-- Reabilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Criar política pública de INSERT para orders
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Criar política pública de INSERT para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- Recriar políticas de SELECT para staff (baseado no supabase-rls-completo.sql)
CREATE POLICY "Staff or super_admin read orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- Recriar políticas de UPDATE para staff
CREATE POLICY "Staff or super_admin update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- Recriar políticas de SELECT para order_items
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

SELECT 'Políticas recriadas: INSERT público + SELECT/UPDATE para staff. Teste criar um pedido agora.' AS mensagem;
