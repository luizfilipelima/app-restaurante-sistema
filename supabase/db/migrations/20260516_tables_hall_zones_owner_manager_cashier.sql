-- =============================================================================
-- Migration: Mesas e zonas — owner, manager e caixa podem adicionar e editar
-- Data: 2026-05-16
--
-- Objetivo: Permitir que proprietário (owner), gerente (manager) e caixa (cashier)
-- adicionem e editem mesas e zonas na Central de Mesas e Zonas.
-- A função current_user_can_admin_restaurant só inclui owner e manager;
-- cashier não estava autorizado. Esta migration cria uma função específica
-- para mesas/zonas que inclui também cashier.
-- =============================================================================

-- Função: retorna true se o usuário pode gerenciar mesas e zonas do restaurante
-- (super_admin, restaurant_admin, owner, manager ou cashier)
CREATE OR REPLACE FUNCTION public.current_user_can_manage_tables_zones(
  p_restaurant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.role = 'super_admin'
      OR (u.role = 'restaurant_admin' AND u.restaurant_id = p_restaurant_id)
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurant_user_roles rur
    WHERE rur.user_id = (SELECT auth.uid())
      AND rur.restaurant_id = p_restaurant_id
      AND rur.is_active = true
      AND rur.role IN ('owner', 'manager', 'cashier')
  );
$$;

COMMENT ON FUNCTION public.current_user_can_manage_tables_zones(UUID) IS
  'True se o usuário pode gerenciar mesas e zonas (super_admin, restaurant_admin, owner, manager ou cashier).';

-- ========== Tables: usar nova função para INSERT/UPDATE/DELETE ==========
DROP POLICY IF EXISTS "tables_select" ON public.tables;
DROP POLICY IF EXISTS "tables_insert" ON public.tables;
DROP POLICY IF EXISTS "tables_update" ON public.tables;
DROP POLICY IF EXISTS "tables_delete" ON public.tables;

CREATE POLICY "tables_select" ON public.tables FOR SELECT
  USING (
    tables.is_active = true
    OR (SELECT current_user_can_manage_tables_zones(tables.restaurant_id))
  );
CREATE POLICY "tables_insert" ON public.tables FOR INSERT
  WITH CHECK ((SELECT current_user_can_manage_tables_zones(tables.restaurant_id)));
CREATE POLICY "tables_update" ON public.tables FOR UPDATE
  USING ((SELECT current_user_can_manage_tables_zones(tables.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_manage_tables_zones(tables.restaurant_id)));
CREATE POLICY "tables_delete" ON public.tables FOR DELETE
  USING ((SELECT current_user_can_manage_tables_zones(tables.restaurant_id)));


-- ========== Hall zones: usar nova função para todas as operações ==========
DROP POLICY IF EXISTS "Restaurant admins can manage own hall_zones" ON public.hall_zones;

CREATE POLICY "Restaurant staff can manage hall_zones"
  ON public.hall_zones FOR ALL
  USING ((SELECT current_user_can_manage_tables_zones(hall_zones.restaurant_id)));


-- ========== table_comanda_links: alinhado a mesas (owner/manager/cashier) ==========
DROP POLICY IF EXISTS "Restaurant admins can manage own table_comanda_links" ON public.table_comanda_links;

CREATE POLICY "Restaurant staff can manage table_comanda_links"
  ON public.table_comanda_links FOR ALL
  USING ((SELECT current_user_can_manage_tables_zones(table_comanda_links.restaurant_id)));
