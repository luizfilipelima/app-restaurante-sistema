-- =============================================================================
-- Fix: Garantir que INSERTs em auth.users definam colunas de token como ''
-- =============================================================================
-- GoTrue falha com "Database error querying schema" quando confirmation_token,
-- recovery_token, email_change (e opcionalmente email_change_token_new) são NULL.
-- Ref: https://github.com/supabase/auth/issues/1940
--
-- Esta migration atualiza as funções que inserem em auth.users para incluir
-- explicitamente essas colunas com valor ''.
-- =============================================================================

-- ── 1. super_admin_create_restaurant_with_admin ───────────────────────────────

CREATE OR REPLACE FUNCTION public.super_admin_create_restaurant_with_admin(
  p_restaurant_name TEXT,
  p_slug            TEXT,
  p_phone           TEXT    DEFAULT NULL,
  p_whatsapp        TEXT    DEFAULT NULL,
  p_admin_email     TEXT    DEFAULT NULL,
  p_admin_password  TEXT    DEFAULT NULL,
  p_admin_login     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id       UUID;
  v_caller_role     TEXT;
  v_restaurant_id   UUID;
  v_new_user_id     UUID;
  v_plan_id         UUID;
  v_slug_final      TEXT;
  v_name_clean      TEXT;
  v_email_clean     TEXT;
  v_login_clean     TEXT;
  v_encrypted_pwd   TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super administradores podem criar restaurantes por esta função.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_name_clean := TRIM(COALESCE(p_restaurant_name, ''));
  IF v_name_clean = '' THEN
    RAISE EXCEPTION 'O nome do restaurante não pode ser vazio.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_slug_final := normalize_slug(p_slug);
  IF v_slug_final = '' OR LENGTH(v_slug_final) < 3 THEN
    RAISE EXCEPTION 'Slug inválido: use ao menos 3 letras (ex: meu-restaurante).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurants WHERE slug = v_slug_final AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'O link personalizado "%" já está em uso. Escolha outro.', v_slug_final
      USING ERRCODE = 'unique_violation';
  END IF;

  v_email_clean := LOWER(TRIM(COALESCE(p_admin_email, '')));
  v_login_clean := TRIM(COALESCE(p_admin_login, ''));

  IF v_email_clean != '' THEN
    IF p_admin_password IS NULL OR LENGTH(TRIM(p_admin_password)) < 6 THEN
      RAISE EXCEPTION 'A senha do admin deve ter pelo menos 6 caracteres.'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_email_clean NOT LIKE '%@%.%' THEN
      RAISE EXCEPTION 'E-mail inválido: "%".', v_email_clean
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email_clean) THEN
      RAISE EXCEPTION 'Já existe um usuário com o e-mail "%".', v_email_clean
        USING ERRCODE = 'unique_violation';
    END IF;
    IF v_login_clean != '' AND EXISTS (SELECT 1 FROM public.users WHERE login = v_login_clean) THEN
      RAISE EXCEPTION 'O username "%" já está em uso.', v_login_clean
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  INSERT INTO public.restaurants (name, slug, phone, whatsapp, is_active, created_at, updated_at)
  VALUES (
    v_name_clean, v_slug_final,
    NULLIF(TRIM(COALESCE(p_phone, '')), ''), NULLIF(TRIM(COALESCE(p_whatsapp, '')), ''),
    true, NOW(), NOW()
  )
  RETURNING id INTO v_restaurant_id;

  IF v_email_clean != '' THEN
    v_new_user_id   := gen_random_uuid();
    v_encrypted_pwd := crypt(p_admin_password, gen_salt('bf'));

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change
    )
    VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated', 'authenticated', v_email_clean, v_encrypted_pwd,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role','restaurant_admin','restaurant_id',v_restaurant_id::text,'login',NULLIF(v_login_clean,'')),
      NOW(), NOW(),
      '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_new_user_id, v_new_user_id,
      jsonb_build_object('sub', v_new_user_id::text, 'email', v_email_clean),
      'email', v_email_clean, NOW(), NOW(), NOW()
    );

    INSERT INTO public.users (id, email, login, role, restaurant_id, created_at, updated_at)
    VALUES (v_new_user_id, v_email_clean, NULLIF(v_login_clean, ''), 'restaurant_admin', v_restaurant_id, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      restaurant_id = EXCLUDED.restaurant_id, role = 'restaurant_admin',
      login = COALESCE(NULLIF(v_login_clean, ''), public.users.login), updated_at = NOW();

    INSERT INTO public.restaurant_user_roles (restaurant_id, user_id, role, is_active, invited_by, created_at, updated_at)
    VALUES (v_restaurant_id, v_new_user_id, 'owner'::restaurant_role_type, true, v_caller_id, NOW(), NOW());
  END IF;

  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE name = 'core' AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.subscription_plans WHERE is_active = true ORDER BY price_brl ASC, sort_order ASC LIMIT 1;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.restaurant_subscriptions (restaurant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
    VALUES (v_restaurant_id, v_plan_id, 'trial', NOW() + INTERVAL '7 days', NOW(), NOW() + INTERVAL '7 days', NOW(), NOW());
  END IF;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant_id::text, 'slug', v_slug_final,
    'admin_user_id', COALESCE(v_new_user_id::text, null), 'trial_ends_at', (NOW() + INTERVAL '7 days')::text
  );
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;


-- ── 2. super_admin_add_restaurant_user ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.super_admin_add_restaurant_user(
  p_restaurant_id UUID,
  p_email         TEXT,
  p_password      TEXT,
  p_login         TEXT     DEFAULT NULL,
  p_role          TEXT     DEFAULT 'manager'
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
  SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin pode criar usuários';
  END IF;

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
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email_norm) THEN
    RAISE EXCEPTION 'duplicate_email: já existe um usuário com este e-mail';
  END IF;
  IF p_login IS NOT NULL AND trim(p_login) <> '' AND EXISTS (SELECT 1 FROM public.users WHERE login = lower(trim(p_login))) THEN
    RAISE EXCEPTION 'duplicate_login: já existe um usuário com este nome de usuário';
  END IF;

  v_system_role := CASE p_role WHEN 'kitchen' THEN 'kitchen' ELSE 'restaurant_admin' END;
  v_new_user_id   := gen_random_uuid();
  v_encrypted_pwd := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, role, aud,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin,
    confirmation_token, recovery_token, email_change
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    v_email_norm, v_encrypted_pwd, NOW(), 'authenticated', 'authenticated',
    jsonb_build_object('role', v_system_role, 'restaurant_id', p_restaurant_id::TEXT),
    jsonb_build_object('role', v_system_role, 'restaurant_id', p_restaurant_id::TEXT, 'login', COALESCE(lower(trim(p_login)), '')),
    NOW(), NOW(), false,
    '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_new_user_id, v_email_norm, jsonb_build_object('sub', v_new_user_id::TEXT, 'email', v_email_norm), 'email', NOW(), NOW(), NOW());

  INSERT INTO public.users (id, email, role, restaurant_id, login, created_at, updated_at)
  VALUES (v_new_user_id, v_email_norm, v_system_role, p_restaurant_id, CASE WHEN p_login IS NOT NULL AND trim(p_login) <> '' THEN lower(trim(p_login)) ELSE NULL END, NOW(), NOW());

  INSERT INTO public.restaurant_user_roles (restaurant_id, user_id, role, is_active, invited_by, created_at, updated_at)
  VALUES (p_restaurant_id, v_new_user_id, p_role::restaurant_role_type, true, auth.uid(), NOW(), NOW());

  RETURN jsonb_build_object('user_id', v_new_user_id, 'email', v_email_norm, 'role', p_role);
END;
$$;
