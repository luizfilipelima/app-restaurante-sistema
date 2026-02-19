-- =====================================================
-- FIX: Permitir que usuários leiam seu próprio perfil
-- Necessário para o login funcionar
-- Execute no Supabase SQL Editor
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Cada usuário DEVE poder ler seu próprio perfil
-- Isso é obrigatório para o login funcionar, pois após autenticar,
-- o código busca o perfil do usuário na tabela users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Super admin pode ler todos os usuários (para listagem)
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
DROP POLICY IF EXISTS "Super admin read all users" ON users;
CREATE POLICY "Super admin can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Verificar se as políticas foram criadas
SELECT 
  '✅ Políticas de users:' AS status,
  policyname,
  cmd,
  CASE 
    WHEN policyname = 'Users can read own profile' THEN '✅ Permite ler próprio perfil'
    WHEN policyname = 'Super admin can read all users' THEN '✅ Super admin pode ler todos'
    ELSE cmd
  END AS detalhes
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

SELECT '✅ Política de leitura do próprio perfil aplicada! Tente fazer login novamente.' AS resultado;
