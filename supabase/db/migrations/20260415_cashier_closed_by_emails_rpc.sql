-- =============================================================================
-- Migration: E-mail de quem fechou a conta visível no Caixa (Concluídos)
-- Data: 2026-04-15
--
-- O caixa (/cashier) não consegue ler e-mails de outros usuários (garçom, etc.)
-- porque a RLS em public.users só permite ler o próprio perfil.
-- Esta RPC permite que staff do restaurante obtenha id+email dos usuários que
-- pertencem ao mesmo restaurante (para exibir "Atendido por" nos concluídos).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_emails_for_restaurant_staff(
  p_restaurant_id UUID,
  p_user_ids     UUID[]
)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Caller must be staff of the same restaurant
  IF NOT (
    (SELECT current_user_is_super_admin())
    OR (SELECT current_user_restaurant_id()) = p_restaurant_id
    OR (SELECT current_user_can_admin_restaurant(p_restaurant_id))
    OR EXISTS (
      SELECT 1 FROM public.restaurant_user_roles rur
      WHERE rur.user_id = auth.uid()
        AND rur.restaurant_id = p_restaurant_id
        AND rur.is_active = true
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, (COALESCE(au.email, u.email))::TEXT
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE u.id = ANY(p_user_ids)
    AND (
      u.restaurant_id = p_restaurant_id
      OR EXISTS (
        SELECT 1 FROM public.restaurant_user_roles rur
        WHERE rur.user_id = u.id
          AND rur.restaurant_id = p_restaurant_id
      )
    );
END;
$$;

COMMENT ON FUNCTION public.get_emails_for_restaurant_staff(UUID, UUID[]) IS
  'Retorna id e email dos usuários do restaurante. Usado pelo Caixa para exibir "Atendido por" nos concluídos.';

REVOKE ALL ON FUNCTION public.get_emails_for_restaurant_staff(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_emails_for_restaurant_staff(UUID, UUID[]) TO authenticated;
