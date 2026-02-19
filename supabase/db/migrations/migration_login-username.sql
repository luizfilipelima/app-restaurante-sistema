-- ============================================================
-- Login com email OU usuário (login)
-- ============================================================
-- Permite que o usuário entre com email+senha ou com um "login" (usuário)+senha.
-- O Supabase Auth continua usando apenas email; esta migração adiciona a coluna
-- login e uma função que resolve login -> email para o frontend.
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

-- 1) Coluna opcional "login" (usuário) na tabela users (única, para buscar por ela)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login VARCHAR(100) UNIQUE;

COMMENT ON COLUMN public.users.login IS 'Login/usuário opcional para entrar no sistema (além do email)';

-- 2) Função que retorna o email a partir de login ou email (para uso na tela de login)
-- SECURITY DEFINER para poder ler na tabela users sem RLS bloquear (usuário ainda não autenticado)
CREATE OR REPLACE FUNCTION public.get_email_for_login(login_input TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.users
  WHERE (email = trim(login_input) OR login = trim(login_input))
  LIMIT 1;
$$;

-- Permitir que o cliente (anon) chame a função na tela de login
GRANT EXECUTE ON FUNCTION public.get_email_for_login(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_login(TEXT) TO authenticated;

-- ============================================================
SELECT 'Migração login/usuário aplicada. Pode usar email ou login para entrar.' AS mensagem;
