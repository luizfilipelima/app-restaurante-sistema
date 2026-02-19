-- ============================================================
-- REATIVAR RLS na tabela public.users (ação futura)
-- ============================================================
-- Contexto: o RLS foi desativado temporariamente (DISABLE ROW LEVEL SECURITY)
-- para desbloquear o login. Este script usa uma função SECURITY DEFINER para
-- evitar que a política do super_admin leia a mesma tabela sob RLS (causava falha).
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

-- 0) Função que verifica se o usuário atual é super_admin (lê users sem passar pelo RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 1) Cada usuário pode ler apenas a própria linha (obrigatório para login)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- 2) Super admin pode ler todos os usuários (usa função para não depender de RLS na própria tabela)
DROP POLICY IF EXISTS "Super admin can read all users" ON public.users;
CREATE POLICY "Super admin can read all users"
  ON public.users FOR SELECT
  USING (public.is_super_admin());

-- 3) Super admin pode inserir e atualizar usuários (cadastro pelo painel / Edge Function com anon)
DROP POLICY IF EXISTS "Super admin can insert users" ON public.users;
CREATE POLICY "Super admin can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin can update users" ON public.users;
CREATE POLICY "Super admin can update users"
  ON public.users FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4) Reativar Row Level Security na tabela
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
SELECT 'RLS reativado em public.users. Políticas aplicadas.' AS mensagem;

-- Se o login voltar a falhar, desative de novo temporariamente (rode no SQL Editor):
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
