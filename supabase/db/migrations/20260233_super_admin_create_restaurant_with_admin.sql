-- =============================================================================
-- Migration: RPC atômica super_admin_create_restaurant_with_admin()
-- Data: 2026-02-33
-- =============================================================================
--
-- Objetivo:
--   Permitir que o super_admin crie um restaurante E o usuário administrador
--   dele em uma única chamada atômica, a partir do modal "Novo Restaurante".
--
-- O que a função faz:
--   A) Cria o restaurante em public.restaurants
--   B) Cria o usuário em auth.users  (com senha já criptografada via pgcrypto)
--   C) Cria a identidade em auth.identities (necessária para login por senha)
--   D) Cria o perfil em public.users   (role = restaurant_admin, login = username)
--   E) Vincula como 'owner' em restaurant_user_roles
--   F) Cria assinatura trial de 7 dias no plano Core
--
-- Nota sobre o campo "username":
--   A tabela public.users já possui a coluna `login` (adicionada em
--   migration_login-username.sql) que serve como login alternativo ao e-mail.
--   A função aceita p_admin_login como "username" e armazena em users.login.
--
-- Nota de segurança:
--   • SECURITY DEFINER: executa como postgres owner, permitindo INSERT em auth.users
--   • Verifica explicitamente que o chamador é super_admin antes de qualquer operação
--   • search_path fixo evita SQL injection por troca de schema
--   • Todos os campos string são trimados e validados
--   • Falhas em qualquer passo fazem rollback completo (atomicidade via RAISE)
--
-- Uso no frontend:
--   const { data, error } = await supabase.rpc(
--     'super_admin_create_restaurant_with_admin', {
--       p_restaurant_name: 'Pizzaria do João',
--       p_slug:            'pizzaria-do-joao',
--       p_phone:           '(11) 99999-9999',
--       p_whatsapp:        '11999999999',
--       p_admin_email:     'admin@pizzaria.com',
--       p_admin_password:  'senha123',
--       p_admin_login:     'adminjoao',
--     }
--   );
--   // data = { restaurant_id, slug, admin_user_id, trial_ends_at }
-- =============================================================================

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

  -- ─────────────────────────────────────────────────────────────────────────
  -- GUARDA 1: Somente usuários autenticados
  -- ─────────────────────────────────────────────────────────────────────────
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- GUARDA 2: Somente super_admin pode chamar esta função
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT role INTO v_caller_role
  FROM   public.users
  WHERE  id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super administradores podem criar restaurantes por esta função.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- VALIDAÇÃO: nome do restaurante
  -- ─────────────────────────────────────────────────────────────────────────
  v_name_clean := TRIM(COALESCE(p_restaurant_name, ''));
  IF v_name_clean = '' THEN
    RAISE EXCEPTION 'O nome do restaurante não pode ser vazio.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- VALIDAÇÃO: slug
  -- ─────────────────────────────────────────────────────────────────────────
  v_slug_final := normalize_slug(p_slug);
  IF v_slug_final = '' OR LENGTH(v_slug_final) < 3 THEN
    RAISE EXCEPTION 'Slug inválido: use ao menos 3 letras (ex: meu-restaurante).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE  slug = v_slug_final AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'O link personalizado "%" já está em uso. Escolha outro.', v_slug_final
      USING ERRCODE = 'unique_violation';
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- VALIDAÇÃO: dados do admin (opcionais — se e-mail fornecido, todos obrigatórios)
  -- ─────────────────────────────────────────────────────────────────────────
  v_email_clean := LOWER(TRIM(COALESCE(p_admin_email, '')));
  v_login_clean := TRIM(COALESCE(p_admin_login, ''));

  IF v_email_clean != '' THEN

    -- Senha obrigatória e mínimo de 6 caracteres
    IF p_admin_password IS NULL OR LENGTH(TRIM(p_admin_password)) < 6 THEN
      RAISE EXCEPTION 'A senha do admin deve ter pelo menos 6 caracteres.'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- E-mail precisa ser formato válido (checagem básica)
    IF v_email_clean NOT LIKE '%@%.%' THEN
      RAISE EXCEPTION 'E-mail inválido: "%".', v_email_clean
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- E-mail único em auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email_clean) THEN
      RAISE EXCEPTION 'Já existe um usuário com o e-mail "%".', v_email_clean
        USING ERRCODE = 'unique_violation';
    END IF;

    -- Login (username) único em public.users (se fornecido)
    IF v_login_clean != '' THEN
      IF EXISTS (SELECT 1 FROM public.users WHERE login = v_login_clean) THEN
        RAISE EXCEPTION 'O username "%" já está em uso.', v_login_clean
          USING ERRCODE = 'unique_violation';
      END IF;
    END IF;

  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSO A: Criar o restaurante
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.restaurants (
    name, slug, phone, whatsapp,
    is_active, created_at, updated_at
  )
  VALUES (
    v_name_clean,
    v_slug_final,
    NULLIF(TRIM(COALESCE(p_phone, '')),    ''),
    NULLIF(TRIM(COALESCE(p_whatsapp, '')), ''),
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_restaurant_id;


  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSO B, C, D, E: Criar usuário admin (apenas se e-mail fornecido)
  -- ─────────────────────────────────────────────────────────────────────────
  IF v_email_clean != '' THEN

    v_new_user_id   := gen_random_uuid();
    v_encrypted_pwd := crypt(p_admin_password, gen_salt('bf'));

    -- B) Criar conta em auth.users (e-mail auto-confirmado)
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_email_clean,
      v_encrypted_pwd,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'role',          'restaurant_admin',
        'restaurant_id', v_restaurant_id::text,
        'login',         NULLIF(v_login_clean, '')
      ),
      NOW(),
      NOW()
    );

    -- C) Criar identidade para login por e-mail/senha
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_new_user_id,
      v_new_user_id,
      jsonb_build_object('sub', v_new_user_id::text, 'email', v_email_clean),
      'email',
      v_email_clean,
      NOW(),
      NOW(),
      NOW()
    );

    -- D) Criar perfil em public.users
    INSERT INTO public.users (
      id,
      email,
      login,
      role,
      restaurant_id,
      created_at,
      updated_at
    )
    VALUES (
      v_new_user_id,
      v_email_clean,
      NULLIF(v_login_clean, ''),
      'restaurant_admin',
      v_restaurant_id,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
      SET restaurant_id = EXCLUDED.restaurant_id,
          role          = 'restaurant_admin',
          login         = COALESCE(NULLIF(v_login_clean, ''), public.users.login),
          updated_at    = NOW();

    -- E) Vincular como 'owner' no RBAC granular
    INSERT INTO public.restaurant_user_roles (
      restaurant_id, user_id, role, is_active, invited_by, created_at, updated_at
    )
    VALUES (
      v_restaurant_id, v_new_user_id,
      'owner'::restaurant_role_type,
      true, v_caller_id, NOW(), NOW()
    );

  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- PASSO F: Criar assinatura trial de 7 dias no plano Core
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id
  FROM   public.subscription_plans
  WHERE  name = 'core' AND is_active = true
  LIMIT  1;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM   public.subscription_plans
    WHERE  is_active = true
    ORDER  BY price_brl ASC, sort_order ASC
    LIMIT  1;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.restaurant_subscriptions (
      restaurant_id, plan_id, status,
      trial_ends_at, current_period_start, current_period_end,
      created_at, updated_at
    )
    VALUES (
      v_restaurant_id, v_plan_id, 'trial',
      NOW() + INTERVAL '7 days',
      NOW(), NOW() + INTERVAL '7 days',
      NOW(), NOW()
    );
  END IF;


  -- ─────────────────────────────────────────────────────────────────────────
  -- RETORNO
  -- ─────────────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'restaurant_id',  v_restaurant_id::text,
    'slug',           v_slug_final,
    'admin_user_id',  COALESCE(v_new_user_id::text, null),
    'trial_ends_at',  (NOW() + INTERVAL '7 days')::text
  );

EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$;

COMMENT ON FUNCTION public.super_admin_create_restaurant_with_admin IS
  'RPC atômica (super_admin only): cria restaurante + usuário admin com e-mail/senha '
  'auto-confirmado + perfil em public.users + vínculo RBAC owner + assinatura trial. '
  'O campo p_admin_login é opcional e armazenado em public.users.login (login alternativo).';


-- =============================================================================
-- Permissões
-- =============================================================================

REVOKE ALL    ON FUNCTION public.super_admin_create_restaurant_with_admin FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.super_admin_create_restaurant_with_admin TO authenticated;


-- =============================================================================
-- Verificação rápida (execute manualmente no SQL Editor para testar)
-- =============================================================================
-- SELECT public.super_admin_create_restaurant_with_admin(
--   'Pizzaria Teste',
--   'pizzaria-teste',
--   '(11) 99999-9999',
--   '11999999999',
--   'admin@pizzariateste.com',
--   'senha123',
--   'adminpizza'
-- );
