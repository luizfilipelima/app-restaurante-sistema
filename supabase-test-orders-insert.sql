-- =====================================================
-- TESTE: Verificar se INSERT público está funcionando
-- Execute este script para testar se qualquer pessoa pode criar pedidos
-- =====================================================

-- PASSO 1: Obter um restaurant_id válido para teste
SELECT 
  id,
  name,
  slug
FROM restaurants
WHERE is_active = true
LIMIT 1;

-- PASSO 2: Teste de INSERT (substitua RESTAURANT_ID pelo ID obtido acima)
-- Descomente e execute após obter o restaurant_id:

/*
-- Teste 1: INSERT simples sem autenticação
INSERT INTO orders (restaurant_id, customer_name, customer_phone, total_price, status)
VALUES (
  'RESTAURANT_ID_AQUI'::uuid,  -- Substitua pelo ID real
  'Cliente Teste',
  '11999999999',
  50.00,
  'pending'
)
RETURNING id, customer_name, status, created_at;

-- Se o INSERT acima funcionou, teste criar order_items:
-- (substitua ORDER_ID pelo ID retornado acima)

INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price)
VALUES (
  'ORDER_ID_AQUI'::uuid,  -- Substitua pelo ID do pedido criado
  'Produto Teste',
  2,
  25.00,
  50.00
)
RETURNING id, product_name, quantity, total_price;
*/

-- PASSO 3: Verificar políticas ativas
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' AND with_check = 'true' THEN '✅ INSERT público permitido'
    WHEN cmd = 'INSERT' THEN '❌ INSERT com restrição: ' || with_check::text
    ELSE cmd
  END AS status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items')
  AND cmd = 'INSERT'
ORDER BY tablename;

-- PASSO 4: Verificar se RLS está habilitado
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Habilitado'
    ELSE '❌ RLS Desabilitado (PERIGO!)'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items');

SELECT '✅ Execute os testes acima para verificar se INSERT público está funcionando.' AS instrucao;
