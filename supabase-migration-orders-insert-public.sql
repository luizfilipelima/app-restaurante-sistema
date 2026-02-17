-- =====================================================
-- Migration: Clientes podem criar pedidos (INSERT público em orders)
-- Se você rodou supabase-rls-completo.sql, a política de INSERT foi removida.
-- Esta migration garante que qualquer pessoa (incluindo anônimos) possa criar pedidos.
-- =====================================================

-- Garantir que a política de INSERT público existe
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Garantir que order_items também permite INSERT público
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

SELECT 'Políticas de INSERT público em orders e order_items aplicadas. Clientes podem criar pedidos.' AS mensagem;
