-- ============================================================
-- CORREÇÃO: Login não funciona – políticas RLS na tabela users
-- ============================================================
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================
-- Causas comuns: falta política para ler o próprio perfil, ou
-- o usuário existe no Auth mas não tem linha em public.users.
-- ============================================================

-- 1) Cada usuário DEVE poder ler a própria linha (obrigatório para login)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- 2) Super admin pode ler todos os usuários (lista na aba Usuários)
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
CREATE POLICY "Super admin can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ============================================================
-- Se ainda não conseguir entrar:
-- - Confirme que seu email tem uma linha em public.users (role e restaurant_id).
-- - Use o script: node --env-file=.env.script scripts/criar-usuarios.js
--   ou a Edge Function create-restaurant-user para criar usuários.
-- ============================================================
SELECT 'Políticas de login aplicadas. Tente fazer login novamente.' AS mensagem;
