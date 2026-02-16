-- ============================================================
-- CORREÇÃO: Login não funcionava porque faltava política RLS
-- na tabela users para o usuário ler o PRÓPRIO perfil.
-- ============================================================
-- Execute isto no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

-- Remove a política se já existir (para poder rodar de novo sem erro)
DROP POLICY IF EXISTS "Users can read own profile" ON users;

-- Permite que cada usuário leia sua própria linha na tabela users
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- ============================================================
-- Pronto. Tente fazer login novamente no app.
-- ============================================================
