-- =============================================================================
-- Migration: Perfil do Garçom + Atualizar própria zona
-- Data: 2026-04-12
-- Depende de: 20260411_waiter_hall_zone.sql
--
-- Permite ao garçom ver seu perfil e definir a zona que atende no Terminal.
-- Notificações, bips e vibrações já são filtradas pela zona (mesas vinculadas).
-- =============================================================================

-- 1. RPC para o usuário do Terminal obter seu perfil (login, email, nome, cargo, zona)
-- Qualquer usuário com acesso ao restaurante (owner, manager, waiter, cashier) pode ver o perfil.
-- hall_zone_id só existe para role=waiter (define zona que atende).
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
    CASE WHEN rur.role = 'waiter' THEN rur.hall_zone_id ELSE NULL END
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

  -- Sem linha: v_email e v_login ficam NULL. Aceita usuário só com email (login opcional).
  IF v_email IS NULL AND v_login IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extrai nome e sobrenome do full_name
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

COMMENT ON FUNCTION public.get_my_waiter_profile(UUID) IS
  'Retorna perfil do garçom logado para exibir no Terminal (login, email, nome, cargo, zona).';

GRANT EXECUTE ON FUNCTION public.get_my_waiter_profile(UUID) TO authenticated;

-- 2. RPC para o garçom atualizar sua própria zona
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
    AND role          = 'waiter'
    AND is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'permission_denied: você não é garçom ativo neste restaurante';
  END IF;

  RETURN jsonb_build_object('hall_zone_id', p_hall_zone_id);
END;
$$;

COMMENT ON FUNCTION public.update_my_waiter_hall_zone(UUID, UUID) IS
  'Permite ao garçom definir a zona que atende. Só mesas dessa zona geram notificações.';

GRANT EXECUTE ON FUNCTION public.update_my_waiter_hall_zone(UUID, UUID) TO authenticated;
