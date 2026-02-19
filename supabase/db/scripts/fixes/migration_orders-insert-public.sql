-- =====================================================
-- Migration: Clientes podem criar pedidos (INSERT público em orders)
-- Se você rodou supabase-rls-completo.sql, a política de INSERT foi removida.
-- Esta migration garante que qualquer pessoa (incluindo anônimos) possa criar pedidos.
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas de INSERT possíveis em orders (para evitar conflito)
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Public can create orders" ON orders;
DROP POLICY IF EXISTS "Restaurant staff can create orders" ON orders;
DROP POLICY IF EXISTS "Staff or super_admin insert orders" ON orders;

-- Criar política de INSERT público para orders
-- IMPORTANTE: WITH CHECK (true) permite que qualquer pessoa (incluindo anônimos) crie pedidos
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Remover TODAS as políticas de INSERT possíveis em order_items
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
DROP POLICY IF EXISTS "Public can create order items" ON order_items;
DROP POLICY IF EXISTS "Restaurant staff can create order items" ON order_items;

-- Criar política de INSERT público para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

SELECT 'Políticas de INSERT público em orders e order_items aplicadas. Clientes podem criar pedidos.' AS mensagem;
