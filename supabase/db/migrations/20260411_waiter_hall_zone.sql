-- =============================================================================
-- Migration: Zona do Garçom — delimitar garçom a uma zona do salão
-- Data: 2026-04-11
-- Depende de: 20260307_hall_zones_and_table_comanda_links.sql
--
-- Quando o garçom tem hall_zone_id definido em restaurant_user_roles, ele só
-- vê mesas, chamados e pedidos prontos dessa zona no Terminal do Garçom.
-- =============================================================================

-- 1. Adicionar hall_zone_id em restaurant_user_roles (apenas para role waiter)
ALTER TABLE public.restaurant_user_roles
  ADD COLUMN IF NOT EXISTS hall_zone_id UUID REFERENCES public.hall_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_user_roles_hall_zone
  ON public.restaurant_user_roles(hall_zone_id);

COMMENT ON COLUMN public.restaurant_user_roles.hall_zone_id IS
  'Se definido para role=waiter, o garçom só vê/atende mesas desta zona no Terminal.';

-- 2. Atualizar super_admin_list_restaurant_users para retornar hall_zone_id
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
        'hall_zone_id',    rur.hall_zone_id,
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

-- 3. RPC para atualizar zona do garçom (p_hall_zone_id NULL = todas as zonas)
CREATE OR REPLACE FUNCTION public.super_admin_update_waiter_hall_zone(
  p_user_id       UUID,
  p_restaurant_id UUID,
  p_hall_zone_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_restaurant_users(p_restaurant_id) THEN
    RAISE EXCEPTION 'permission_denied: somente super_admin ou proprietário pode alterar zona do garçom';
  END IF;

  -- Só atualiza se for waiter
  UPDATE public.restaurant_user_roles
  SET hall_zone_id = p_hall_zone_id,
      updated_at   = NOW()
  WHERE user_id       = p_user_id
    AND restaurant_id = p_restaurant_id
    AND role          = 'waiter';

  RETURN jsonb_build_object('user_id', p_user_id, 'hall_zone_id', p_hall_zone_id);
END;
$$;

COMMENT ON FUNCTION public.super_admin_update_waiter_hall_zone(UUID, UUID, UUID) IS
  'Define a zona do salão que o garçom atende. NULL = todas as zonas.';

GRANT EXECUTE ON FUNCTION public.super_admin_update_waiter_hall_zone(UUID, UUID, UUID) TO authenticated;

-- 4. RPC para o garçom obter sua própria zona (usado no Terminal)
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
    AND rur.role          = 'waiter'
    AND rur.is_active     = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_waiter_hall_zone(UUID) IS
  'Retorna a zona do salão atribuída ao garçom logado. NULL = vê todas as zonas.';

GRANT EXECUTE ON FUNCTION public.get_my_waiter_hall_zone(UUID) TO authenticated;
