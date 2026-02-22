-- =============================================================================
-- Fix: Usuário teste-delivery@quiero.food — "Database error querying schema"
-- =============================================================================
-- O usuário foi criado via SQL direto (bypass GoTrue) e tem estado interno
-- incompleto. Este script remove do auth e permite recriação correta.
--
-- EXECUÇÃO:
--   1. Supabase Dashboard → SQL Editor → New Query → Cole este script → Run
--   2. Em seguida: Gestão de Usuários → Remover o usuário @delivery (se aparecer)
--   3. Clicar "Novo usuário" e criar novamente com:
--      E-mail: teste-delivery@quiero.food
--      Usuário: delivery
--      Senha: (definir nova)
--      Cargo: Proprietário
-- =============================================================================

DO $$
DECLARE
  v_email TEXT := 'teste-delivery@quiero.food';
  v_uid   UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Usuário % não encontrado em auth.users. Verifique o e-mail.', v_email;
    RETURN;
  END IF;

  -- Remove vínculos em restaurant_user_roles (evita FK ao recriar)
  DELETE FROM public.restaurant_user_roles WHERE user_id = v_uid;
  -- Remove perfil em public.users (permite recriar com mesmo email)
  DELETE FROM public.users WHERE id = v_uid;
  -- Remove sessões ativas
  DELETE FROM auth.sessions       WHERE user_id = v_uid;
  -- Remove identidades (e-mail/senha)
  DELETE FROM auth.identities     WHERE user_id = v_uid;
  -- Remove refresh tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = v_uid::TEXT;
  -- Remove o usuário do auth (causa do erro "Database error querying schema")
  DELETE FROM auth.users          WHERE id = v_uid;

  RAISE NOTICE 'Usuário % removido. Recrie-o pela Gestão de Usuários (Novo usuário) com o mesmo e-mail e login.', v_email;
END $$;
