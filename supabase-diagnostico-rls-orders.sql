-- =====================================================
-- Script de DIAGNÓSTICO: Verificar políticas RLS em orders
-- Execute este primeiro para ver o que está bloqueando
-- =====================================================

-- Listar TODAS as políticas em orders
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'orders'
ORDER BY cmd, policyname;

-- Listar TODAS as políticas em order_items
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_items'
ORDER BY cmd, policyname;

-- Verificar se RLS está habilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items');
