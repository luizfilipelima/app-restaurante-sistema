-- =============================================================================
-- Fix: "Database error querying schema" no login
-- =============================================================================
-- CAUSA: Usuários criados via INSERT direto em auth.users (SQL ou RPC) deixam
--        as colunas de token como NULL. O GoTrue espera strings vazias; NULL
--        causa "sql: Scan error ... converting NULL to string is unsupported".
--
-- REF: https://github.com/supabase/auth/issues/1940
--
-- SOLUÇÃO: Atualiza registros existentes para '' onde estão NULL.
--          Também define DEFAULT '' para futuros inserts (mitiga o problema).
-- =============================================================================

-- Corrige usuários existentes
UPDATE auth.users
SET
  confirmation_token     = COALESCE(confirmation_token, ''),
  recovery_token         = COALESCE(recovery_token, ''),
  email_change           = COALESCE(email_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL;

-- Algumas versões do Supabase usam email_change_token_new
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new'
  ) THEN
    UPDATE auth.users SET email_change_token_new = COALESCE(email_change_token_new, '')
    WHERE email_change_token_new IS NULL;
  END IF;
END $$;
