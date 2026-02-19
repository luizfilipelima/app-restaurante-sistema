-- =============================================================================
-- Migration: Super Admin — Gestão de Usuários por Restaurante
-- Data: 2026-02-20
--
-- Funções criadas:
--   1. super_admin_list_restaurant_users   → lista usuários de um restaurante
--   2. super_admin_add_restaurant_user     → cria novo usuário + vincula ao restaurante
--   3. super_admin_update_user_role        → altera cargo do usuário
--   4. super_admin_deactivate_restaurant_user → desativa usuário (soft-delete)
--   5. super_admin_reactivate_restaurant_user → reativa usuário desativado
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- 1. super_admin_list_restaurant_users
-- =============================================================================
-- Retorna todos os usuários vinculados ao restaurante informado,
-- combinando dados de auth.users, public.users e restaurant_user_roles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_list_restaurant_users(
  p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- ── Guarda: somente super_admin pode chamar esta função ──────────────────────
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode listar usuários';
  END IF;

  -- ── Retorna usuários do restaurante ─────────────────────────────────────────
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'user_id',         u.id,
        'email',           au.email,
        'login',           u.login,
        'system_role',     u.role,
        'restaurant_role', COALESCE(rur.role::TEXT, 'owner'),
        'is_active',       COALESCE(au.banned_until IS NULL OR au.banned_until < NOW(), true),
        'email_confirmed', au.email_confirmed_at IS NOT NULL,
        'created_at',      u.created_at,
        'last_sign_in_at', au.last_sign_in_at
      )
      ORDER BY
        CASE COALESCE(rur.role::TEXT, 'owner')
          WHEN 'owner'   THEN 1
          WHEN 'manager' THEN 2
          WHEN 'waiter'  THEN 3
          WHEN 'cashier' THEN 4
          WHEN 'kitchen' THEN 5
          ELSE 6
        END,
        u.created_at
    )
    FROM public.users u
    JOIN auth.users au ON au.id = u.id
    LEFT JOIN restaurant_user_roles rur
      ON rur.user_id = u.id
     AND rur.restaurant_id = p_restaurant_id
    WHERE u.restaurant_id = p_restaurant_id
      AND u.role <> 'super_admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_list_restaurant_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_list_restaurant_users(UUID) TO authenticated;

COMMENT ON FUNCTION public.super_admin_list_restaurant_users IS
  'Super Admin: lista usuários de um restaurante com dados de auth e cargo.';


-- =============================================================================
-- 2. super_admin_add_restaurant_user
-- =============================================================================
-- Cria um usuário no auth + public.users + restaurant_user_roles.
-- Se o usuário já existir no auth (email duplicado) retorna erro descritivo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_add_restaurant_user(
  p_restaurant_id UUID,
  p_email         TEXT,
  p_password      TEXT,
  p_login         TEXT     DEFAULT NULL,
  p_role          TEXT     DEFAULT 'manager'  -- restaurant_role_type
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role    TEXT;
  v_new_user_id    UUID;
  v_encrypted_pwd  TEXT;
  v_system_role    TEXT;
  v_email_norm     TEXT;
BEGIN
  -- ── Guarda: somente super_admin ──────────────────────────────────────────────
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode criar usuários';
  END IF;

  -- ── Validações básicas ───────────────────────────────────────────────────────
  v_email_norm := lower(trim(p_email));

  IF v_email_norm = '' OR v_email_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'validation_error: e-mail inválido';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'validation_error: senha deve ter pelo menos 6 caracteres';
  END IF;

  IF p_role NOT IN ('owner', 'manager', 'waiter', 'cashier', 'kitchen') THEN
    RAISE EXCEPTION 'validation_error: cargo inválido. Use: owner, manager, waiter, cashier, kitchen';
  END IF;

  -- ── Verifica duplicidade de e-mail ───────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email_norm) THEN
    RAISE EXCEPTION 'duplicate_email: já existe um usuário com este e-mail';
  END IF;

  -- ── Verifica duplicidade de login (username) ─────────────────────────────────
  IF p_login IS NOT NULL AND trim(p_login) <> '' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE login = lower(trim(p_login))) THEN
      RAISE EXCEPTION 'duplicate_login: já existe um usuário com este nome de usuário';
    END IF;
  END IF;

  -- ── Mapeia restaurant_role → system_role ─────────────────────────────────────
  -- kitchen → 'kitchen' ; todos os outros → 'restaurant_admin'
  v_system_role := CASE p_role WHEN 'kitchen' THEN 'kitchen' ELSE 'restaurant_admin' END;

  -- ── Cria usuário no auth ─────────────────────────────────────────────────────
  v_new_user_id   := gen_random_uuid();
  v_encrypted_pwd := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    v_email_norm,
    v_encrypted_pwd,
    NOW(),                      -- e-mail já confirmado (criado pelo super-admin)
    'authenticated',
    'authenticated',
    jsonb_build_object(
      'role',          v_system_role,
      'restaurant_id', p_restaurant_id::TEXT
    ),
    jsonb_build_object(
      'role',          v_system_role,
      'restaurant_id', p_restaurant_id::TEXT,
      'login',         COALESCE(lower(trim(p_login)), '')
    ),
    NOW(),
    NOW(),
    false
  );

  -- ── Cria identidade (email/senha) ────────────────────────────────────────────
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    v_email_norm,
    jsonb_build_object('sub', v_new_user_id::TEXT, 'email', v_email_norm),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- ── Cria perfil em public.users ───────────────────────────────────────────────
  INSERT INTO public.users (id, email, role, restaurant_id, login, created_at, updated_at)
  VALUES (
    v_new_user_id,
    v_email_norm,
    v_system_role,
    p_restaurant_id,
    CASE WHEN p_login IS NOT NULL AND trim(p_login) <> '' THEN lower(trim(p_login)) ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role          = EXCLUDED.role,
    restaurant_id = EXCLUDED.restaurant_id,
    login         = EXCLUDED.login,
    updated_at    = NOW();

  -- ── Vincula ao restaurante com o cargo informado ─────────────────────────────
  INSERT INTO public.restaurant_user_roles (user_id, restaurant_id, role, created_at, updated_at)
  VALUES (v_new_user_id, p_restaurant_id, p_role::restaurant_role_type, NOW(), NOW())
  ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
    role       = EXCLUDED.role,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'user_id',   v_new_user_id,
    'email',     v_email_norm,
    'login',     COALESCE(lower(trim(p_login)), NULL),
    'role',      p_role,
    'system_role', v_system_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_add_restaurant_user(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_add_restaurant_user(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.super_admin_add_restaurant_user IS
  'Super Admin: cria novo usuário e vincula ao restaurante com cargo específico.';


-- =============================================================================
-- 3. super_admin_update_user_role
-- =============================================================================
-- Atualiza o cargo de um usuário em um restaurante.
-- Também sincroniza o system_role em public.users (kitchen vs restaurant_admin).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_update_user_role(
  p_user_id       UUID,
  p_restaurant_id UUID,
  p_role          TEXT   -- restaurant_role_type
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_system_role TEXT;
BEGIN
  -- ── Guarda ───────────────────────────────────────────────────────────────────
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode alterar cargos';
  END IF;

  IF p_role NOT IN ('owner', 'manager', 'waiter', 'cashier', 'kitchen') THEN
    RAISE EXCEPTION 'validation_error: cargo inválido';
  END IF;

  -- ── Sincroniza system_role ────────────────────────────────────────────────────
  v_system_role := CASE p_role WHEN 'kitchen' THEN 'kitchen' ELSE 'restaurant_admin' END;

  -- ── Atualiza restaurant_user_roles ───────────────────────────────────────────
  INSERT INTO public.restaurant_user_roles (user_id, restaurant_id, role, updated_at)
  VALUES (p_user_id, p_restaurant_id, p_role::restaurant_role_type, NOW())
  ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
    role       = EXCLUDED.role,
    updated_at = NOW();

  -- ── Sincroniza public.users ───────────────────────────────────────────────────
  UPDATE public.users
  SET    role       = v_system_role,
         updated_at = NOW()
  WHERE  id            = p_user_id
    AND  restaurant_id = p_restaurant_id;

  -- ── Sincroniza auth.users metadata ───────────────────────────────────────────
  UPDATE auth.users
  SET
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', v_system_role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', v_system_role),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'user_id',     p_user_id,
    'role',        p_role,
    'system_role', v_system_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_update_user_role(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_user_role(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.super_admin_update_user_role IS
  'Super Admin: atualiza cargo do usuário no restaurante, sincronizando system_role.';


-- =============================================================================
-- 4. super_admin_deactivate_restaurant_user
-- =============================================================================
-- Bane o usuário temporariamente (banned_until = far future) sem excluir dados.
-- O usuário não consegue mais fazer login mas seus registros são preservados.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_deactivate_restaurant_user(
  p_user_id       UUID,
  p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode desativar usuários';
  END IF;

  -- Impede desativar o próprio super_admin
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'validation_error: você não pode desativar sua própria conta';
  END IF;

  -- Impede desativar outro super_admin
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'permission_denied: não é possível desativar outro super_admin';
  END IF;

  -- Bane via banned_until (100 anos)
  UPDATE auth.users
  SET    banned_until = NOW() + INTERVAL '100 years',
         updated_at   = NOW()
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'is_active', false);
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_deactivate_restaurant_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_deactivate_restaurant_user(UUID, UUID) TO authenticated;


-- =============================================================================
-- 5. super_admin_reactivate_restaurant_user
-- =============================================================================
-- Reativa usuário previamente banido (remove banned_until).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_reactivate_restaurant_user(
  p_user_id       UUID,
  p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode reativar usuários';
  END IF;

  UPDATE auth.users
  SET    banned_until = NULL,
         updated_at   = NOW()
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'is_active', true);
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_reactivate_restaurant_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_reactivate_restaurant_user(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.super_admin_reactivate_restaurant_user IS
  'Super Admin: reativa usuário previamente desativado.';
