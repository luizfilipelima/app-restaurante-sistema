-- Permite que owner e manager (via restaurant_user_roles) e restaurant_admin
-- (via users.restaurant_id) possam fazer UPDATE em restaurants.
-- Antes apenas super_admin tinha permissão, causando erro ao salvar configurações.
DROP POLICY IF EXISTS "restaurants_update" ON public.restaurants;
CREATE POLICY "restaurants_update"
  ON public.restaurants FOR UPDATE
  USING (
    (SELECT current_user_is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'restaurant_admin' AND u.restaurant_id = restaurants.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurant_user_roles rur
      WHERE rur.restaurant_id = restaurants.id
        AND rur.user_id = (SELECT auth.uid())
        AND rur.is_active = true
        AND rur.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    (SELECT current_user_is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'restaurant_admin' AND u.restaurant_id = restaurants.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurant_user_roles rur
      WHERE rur.restaurant_id = restaurants.id
        AND rur.user_id = (SELECT auth.uid())
        AND rur.is_active = true
        AND rur.role IN ('owner', 'manager')
    )
  );
