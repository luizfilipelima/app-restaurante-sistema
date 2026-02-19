-- =====================================================
-- Migration V2: Clientes podem criar pedidos (INSERT público)
-- Versão simplificada - execute esta se a primeira der erro
-- =====================================================

-- Habilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Remover políticas de INSERT existentes (tente todos os nomes possíveis)
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Public can create orders" ON orders;
DROP POLICY IF EXISTS "Restaurant staff can create orders" ON orders;
DROP POLICY IF EXISTS "Staff or super_admin insert orders" ON orders;

-- Criar política de INSERT público para orders
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Remover políticas de INSERT existentes em order_items
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
DROP POLICY IF EXISTS "Public can create order items" ON order_items;
DROP POLICY IF EXISTS "Restaurant staff can create order items" ON order_items;

-- Criar política de INSERT público para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

SELECT 'Políticas de INSERT público aplicadas. Clientes podem criar pedidos.' AS mensagem;
