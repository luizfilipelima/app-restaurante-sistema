-- =============================================================================
-- Fix: product_upsells RLS para permitir owner/manager via restaurant_user_roles
-- O policy antigo só permitia users.restaurant_id (restaurant_admin legado).
-- Usuários com role em restaurant_user_roles (owner, manager) não conseguiam
-- inserir/deletar sugestões de upsell ao salvar produto.
-- =============================================================================

DROP POLICY IF EXISTS "Restaurant staff can manage product_upsells" ON public.product_upsells;

CREATE POLICY "Restaurant staff can manage product_upsells"
  ON public.product_upsells FOR ALL
  USING (
    -- super_admin
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR
    -- restaurant_admin (proprietário legado via users.restaurant_id)
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.restaurant_id = product_upsells.restaurant_id
    )
    OR
    -- owner/manager via restaurant_user_roles
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
      WHERE r.user_id = auth.uid()
        AND r.restaurant_id = product_upsells.restaurant_id
        AND r.is_active = true
        AND r.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.restaurant_id = product_upsells.restaurant_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
      WHERE r.user_id = auth.uid()
        AND r.restaurant_id = product_upsells.restaurant_id
        AND r.is_active = true
        AND r.role IN ('owner', 'manager')
    )
  );
