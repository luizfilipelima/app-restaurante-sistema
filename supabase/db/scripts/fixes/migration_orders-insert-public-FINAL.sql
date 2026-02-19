-- =====================================================
-- Migration FINAL: Garantir INSERT público em orders
-- Esta versão remove TODAS as políticas de INSERT e cria uma nova
-- Execute esta se as outras versões não funcionaram
-- =====================================================

-- 1. Habilitar RLS (garantir que está ativo)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas de INSERT de orders usando um loop dinâmico
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON orders', pol.policyname);
  END LOOP;
END $$;

-- 3. Criar política pública de INSERT para orders
-- IMPORTANTE: WITH CHECK (true) permite qualquer pessoa criar pedidos
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- 4. Remover TODAS as políticas de INSERT de order_items
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON order_items', pol.policyname);
  END LOOP;
END $$;

-- 5. Criar política pública de INSERT para order_items
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

SELECT 'Políticas de INSERT público aplicadas. Clientes podem criar pedidos.' AS mensagem;
