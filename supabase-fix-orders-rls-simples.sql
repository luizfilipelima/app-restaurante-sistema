-- =====================================================
-- FIX RLS: Permitir INSERT público em orders
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Remover políticas de INSERT existentes que possam estar bloqueando
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Public can create orders" ON orders;
DROP POLICY IF EXISTS "Restaurant staff can create orders" ON orders;

DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
DROP POLICY IF EXISTS "Public can create order items" ON order_items;
DROP POLICY IF EXISTS "Restaurant staff can create order items" ON order_items;

-- Criar política pública de INSERT para orders
-- Permite QUALQUER pessoa criar pedidos, mesmo sem autenticação
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Criar política pública de INSERT para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

SELECT '✅ Políticas de INSERT público criadas. Qualquer pessoa pode criar pedidos agora.' AS resultado;
