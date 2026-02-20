-- =============================================================================
-- Migration: Garantir is_active = TRUE ao criar/atualizar cargo operacional
-- Data: 2026-02-20
--
-- Corrige super_admin_update_user_role para sempre incluir is_active = TRUE
-- na operação INSERT ... ON CONFLICT DO UPDATE, evitando que usuários fiquem
-- com is_active = NULL/FALSE e não tenham o cargo reconhecido pelo frontend.
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

  INSERT INTO public.restaurant_user_roles (user_id, restaurant_id, role, is_active, updated_at)
  VALUES (p_user_id, p_restaurant_id, p_role::restaurant_role_type, TRUE, NOW())
  ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
    role       = EXCLUDED.role,
    is_active  = TRUE,
    updated_at = NOW();

  UPDATE public.users
  SET    role       = v_system_role,
         updated_at = NOW()
  WHERE  id            = p_user_id
    AND  restaurant_id = p_restaurant_id;

  UPDATE auth.users
  SET
    raw_app_meta_data  = raw_app_meta_data  || jsonb_build_object('role', v_system_role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', v_system_role),
    updated_at         = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'role', p_role, 'system_role', v_system_role);
END;
$$;
