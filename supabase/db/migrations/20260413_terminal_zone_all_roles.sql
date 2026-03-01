-- =============================================================================
-- Migration: Zona do Terminal para todos os usuários
-- Data: 2026-04-13
-- Depende de: 20260412_waiter_profile_and_self_zone.sql
--
-- Permite que qualquer usuário do Terminal (owner, manager, waiter, cashier)
-- defina sua zona e receba get_my_waiter_hall_zone.
-- =============================================================================

-- 1. get_my_waiter_hall_zone: retorna hall_zone_id para qualquer role
CREATE OR REPLACE FUNCTION public.get_my_waiter_hall_zone(p_restaurant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rur.hall_zone_id
  FROM restaurant_user_roles rur
  WHERE rur.user_id       = auth.uid()
    AND rur.restaurant_id = p_restaurant_id
    AND rur.is_active     = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_waiter_hall_zone(UUID) IS
  'Retorna a zona do salão que o usuário definiu no Terminal. NULL = vê todas. Qualquer role.';

-- 2. update_my_waiter_hall_zone: permite qualquer role atualizar sua zona
CREATE OR REPLACE FUNCTION public.update_my_waiter_hall_zone(
  p_restaurant_id UUID,
  p_hall_zone_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.restaurant_user_roles
  SET hall_zone_id = p_hall_zone_id,
      updated_at   = NOW()
  WHERE user_id       = auth.uid()
    AND restaurant_id = p_restaurant_id
    AND is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'permission_denied: você não tem vínculo ativo com este restaurante';
  END IF;

  RETURN jsonb_build_object('hall_zone_id', p_hall_zone_id);
END;
$$;

COMMENT ON FUNCTION public.update_my_waiter_hall_zone(UUID, UUID) IS
  'Permite ao usuário definir a zona que vê no Terminal. Qualquer role com vínculo.';

-- 3. get_my_waiter_profile: retorna hall_zone_id para qualquer role
CREATE OR REPLACE FUNCTION public.get_my_waiter_profile(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_login        TEXT;
  v_email        TEXT;
  v_full_name    TEXT;
  v_role         TEXT;
  v_hall_zone_id UUID;
  v_first_name   TEXT;
  v_last_name    TEXT;
  v_parts        TEXT[];
BEGIN
  SELECT
    u.login,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', ''),
    COALESCE(rur.role::TEXT, CASE WHEN u.role = 'restaurant_admin' THEN 'owner' ELSE u.role::TEXT END),
    rur.hall_zone_id
  INTO v_login, v_email, v_full_name, v_role, v_hall_zone_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  LEFT JOIN public.restaurant_user_roles rur
    ON rur.user_id = u.id
   AND rur.restaurant_id = p_restaurant_id
   AND rur.is_active = true
  WHERE u.id = auth.uid()
    AND (
      u.restaurant_id = p_restaurant_id
      OR rur.restaurant_id IS NOT NULL
      OR u.role = 'super_admin'
    )
  LIMIT 1;

  IF v_email IS NULL AND v_login IS NULL THEN
    RETURN NULL;
  END IF;

  v_full_name := COALESCE(v_full_name, '');
  IF v_full_name <> '' THEN
    v_parts := string_to_array(trim(v_full_name), ' ');
    v_first_name := COALESCE(v_parts[1], '');
    v_last_name := CASE
      WHEN array_length(v_parts, 1) > 1
      THEN array_to_string(v_parts[2:array_length(v_parts, 1)], ' ')
      ELSE ''
    END;
  ELSE
    v_first_name := '';
    v_last_name := '';
  END IF;

  RETURN jsonb_build_object(
    'login',        COALESCE(v_login, ''),
    'email',        COALESCE(v_email, ''),
    'usuario',      COALESCE(v_login, v_email, ''),
    'full_name',    v_full_name,
    'first_name',   v_first_name,
    'last_name',    v_last_name,
    'role',         v_role,
    'hall_zone_id', v_hall_zone_id
  );
END;
$$;
