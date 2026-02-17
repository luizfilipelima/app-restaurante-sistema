-- =====================================================
-- Migration DEFINITIVA: Garantir INSERT público em orders
-- Esta versão garante que QUALQUER pessoa possa criar pedidos
-- Execute esta migration no Supabase SQL Editor
-- =====================================================

-- 1. Garantir que RLS está habilitado
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas de INSERT de orders (usando loop dinâmico)
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
-- IMPORTANTE: WITH CHECK (true) permite QUALQUER pessoa criar pedidos, mesmo sem autenticação
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

-- 6. Verificar se há políticas FOR ALL que possam estar bloqueando
-- Se houver uma política FOR ALL sem WITH CHECK adequado, ela pode bloquear INSERTs
-- Vamos listar para você verificar manualmente
DO $$
DECLARE
  pol RECORD;
  has_all_policy BOOLEAN := false;
BEGIN
  FOR pol IN 
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND cmd = 'ALL'
  LOOP
    has_all_policy := true;
    RAISE NOTICE '⚠️ ATENÇÃO: Política FOR ALL encontrada: %', pol.policyname;
    RAISE NOTICE '   WITH CHECK: %', pol.with_check;
    RAISE NOTICE '   Se WITH CHECK não for "true", pode estar bloqueando INSERTs!';
  END LOOP;
  
  IF NOT has_all_policy THEN
    RAISE NOTICE '✅ Nenhuma política FOR ALL encontrada. Política de INSERT deve funcionar.';
  END IF;
END $$;

-- 7. Verificar se as políticas foram criadas corretamente
SELECT 
  'Políticas de INSERT criadas:' AS status,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

SELECT '✅ Migration aplicada! Teste criar um pedido agora.' AS resultado;
