-- =============================================================================
-- Migration: Repara usuários criados via SQL direto (bypass GoTrue)
-- Data: 2026-02-20
--
-- PROBLEMA:
--   Usuários criados por INSERT direto em auth.users (sem usar a API admin do GoTrue)
--   ficam com estado interno incompleto e retornam "Database error querying schema"
--   ao tentar fazer login.
--
-- SOLUÇÃO:
--   1. Identifica usuários problemáticos (criados via SQL sem GoTrue)
--   2. Remove seus registros de auth.users e auth.identities
--   3. MANTÉM os dados em public.users (restaurant_id, role, login) para serem
--      preservados quando o super-admin recriar via Edge Function (GoTrue admin API)
--
-- COMO APLICAR:
--   Supabase Dashboard → SQL Editor → New Query → Cole este script → Run
--
-- APÓS APLICAR:
--   Recrie o usuário pelo painel super-admin (botão "Novo usuário" no ícone Users).
--   O sistema usará a Edge Function (create-restaurant-user) que chama a API correta.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Verificação — lista usuários que podem estar com problemas
-- Execute apenas este bloco primeiro para conferir quais serão afetados.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  au.id,
  au.email,
  au.created_at,
  au.last_sign_in_at,
  au.email_confirmed_at,
  pu.role,
  pu.restaurant_id,
  pu.login,
  -- Indica se foi criado via SQL direto (sem last_sign_in_at e instance_id vazio)
  CASE
    WHEN au.last_sign_in_at IS NULL
     AND au.instance_id = '00000000-0000-0000-0000-000000000000'::UUID
     AND au.role = 'authenticated'
    THEN 'provável SQL direto ⚠️'
    ELSE 'normal'
  END AS criacao_suspeita
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE au.role = 'authenticated'
  AND pu.role IN ('restaurant_admin', 'kitchen')
ORDER BY au.created_at DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Remove o usuário problemático do auth (mantém public.users intacto).
--
-- SUBSTITUA o e-mail abaixo pelo usuário que precisa ser corrigido.
-- Pode executar uma linha por vez para cada usuário problemático.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_email TEXT := 'gerentefagues@quiero.food';  -- ← altere aqui se precisar
  v_uid   UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Usuário % não encontrado em auth.users — nada a fazer.', v_email;
    RETURN;
  END IF;

  -- Remove sessões ativas
  DELETE FROM auth.sessions     WHERE user_id = v_uid;
  -- Remove identidades (e-mail/senha)
  DELETE FROM auth.identities   WHERE user_id = v_uid;
  -- Remove refresh tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = v_uid;
  -- Remove o usuário do auth
  DELETE FROM auth.users        WHERE id = v_uid;

  -- public.users é MANTIDO para preservar restaurant_id, role e login.
  -- Na recriação via Edge Function, o upsert atualizará o registro existente.

  RAISE NOTICE 'Usuário % (%) removido do auth. Recrie-o via painel super-admin.', v_email, v_uid;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 (opcional): confirma que foi removido do auth mas ainda existe em public
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  'auth.users'   AS origem, id::TEXT, email FROM auth.users  WHERE email = 'gerentefagues@quiero.food'
UNION ALL
SELECT
  'public.users' AS origem, id::TEXT, email FROM public.users WHERE email = 'gerentefagues@quiero.food';
