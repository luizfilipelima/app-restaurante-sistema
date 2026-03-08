-- =============================================================================
-- FIX: "Database error querying schema" ao fazer login
-- =============================================================================
-- Execute no Supabase Dashboard: SQL Editor → New Query → Cole e Execute
--
-- Este script corrige usuários que foram criados via SQL/RPC e ficaram com
-- colunas de token NULL, causando o erro no login.
-- =============================================================================

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  email_change       = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL;

-- email_change_token (opcional em algumas versões)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token') THEN
    UPDATE auth.users SET email_change_token = COALESCE(email_change_token, '') WHERE email_change_token IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new'
  ) THEN
    -- email_change_token_new
    UPDATE auth.users SET email_change_token_new = COALESCE(email_change_token_new, '')
    WHERE email_change_token_new IS NULL;
  END IF;
END $$;
