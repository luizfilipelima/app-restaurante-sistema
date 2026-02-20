-- =============================================================================
-- Migration: Permitir proprietário (owner) gerenciar usuários do próprio restaurante
-- Data: 2026-02-20
--
-- Modifica as funções de gestão de usuários para permitir:
--   - super_admin (como antes)
--   - restaurant_admin com users.restaurant_id = p_restaurant_id (proprietário legado)
--   - restaurant_user_roles com role = 'owner' no restaurante
-- =============================================================================

-- Helper: verifica se o caller pode gerenciar o restaurante
CREATE OR REPLACE FUNCTION public.can_manage_restaurant_users(
  p_restaurant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_user_role  TEXT;
  v_user_rest  UUID;
  v_is_owner   BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN RETURN FALSE; END IF;

  -- super_admin sempre pode
  SELECT role, restaurant_id INTO v_user_role, v_user_rest
  FROM public.users WHERE id = v_caller_id;
  IF v_user_role = 'super_admin' THEN RETURN TRUE; END IF;

  -- restaurant_admin do mesmo restaurante (proprietário legado)
  IF v_user_role = 'restaurant_admin' AND v_user_rest = p_restaurant_id THEN
    RETURN TRUE;
  END IF;

  -- owner em restaurant_user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_user_roles
    WHERE user_id = v_caller_id
      AND restaurant_id = p_restaurant_id
      AND role = 'owner'
      AND is_active = true
  ) INTO v_is_owner;
  RETURN v_is_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_restaurant_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_restaurant_users(UUID) TO authenticated;


-- =============================================================================
-- 1. super_admin_list_restaurant_users → permite owner
-- =============================================================================
CREATE OR REPLACE FUNCTION public.super_admin_list_restaurant_users(
  p_restaurant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.can_manage_restaurant_users(p_restaurant_id) THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin ou proprietário do restaurante pode listar usuários';
  END IF;

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


-- =============================================================================
-- 2. super_admin_update_user_role → permite owner
-- =============================================================================
CREATE OR REPLACE FUNCTION public.super_admin_update_user_role(
  p_user_id       UUID,
  p_restaurant_id UUID,
  p_role          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_system_role TEXT;
BEGIN
  IF NOT public.can_manage_restaurant_users(p_restaurant_id) THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin ou proprietário pode alterar cargos';
  END IF;

  IF p_role NOT IN ('owner', 'manager', 'waiter', 'cashier', 'kitchen') THEN
    RAISE EXCEPTION 'validation_error: cargo inválido';
  END IF;

  v_system_role := CASE p_role WHEN 'kitchen' THEN 'kitchen' ELSE 'restaurant_admin' END;

  INSERT INTO public.restaurant_user_roles (user_id, restaurant_id, role, updated_at)
  VALUES (p_user_id, p_restaurant_id, p_role::restaurant_role_type, NOW())
  ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
    role       = EXCLUDED.role,
    updated_at = NOW();

  UPDATE public.users
  SET    role       = v_system_role,
         updated_at = NOW()
  WHERE  id            = p_user_id
    AND  restaurant_id = p_restaurant_id;

  UPDATE auth.users
  SET
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', v_system_role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', v_system_role),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'role', p_role, 'system_role', v_system_role);
END;
$$;


-- =============================================================================
-- 3. super_admin_deactivate_restaurant_user → permite owner
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
BEGIN
  IF NOT public.can_manage_restaurant_users(p_restaurant_id) THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin ou proprietário pode desativar usuários';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'validation_error: você não pode desativar sua própria conta';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'permission_denied: não é possível desativar super_admin';
  END IF;

  UPDATE auth.users
  SET    banned_until = NOW() + INTERVAL '100 years',
         updated_at   = NOW()
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'is_active', false);
END;
$$;


-- =============================================================================
-- 4. super_admin_reactivate_restaurant_user → permite owner
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
BEGIN
  IF NOT public.can_manage_restaurant_users(p_restaurant_id) THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin ou proprietário pode reativar usuários';
  END IF;

  UPDATE auth.users
  SET    banned_until = NULL,
         updated_at   = NOW()
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'is_active', true);
END;
$$;
