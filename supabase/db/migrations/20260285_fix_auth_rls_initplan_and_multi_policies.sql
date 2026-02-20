-- =============================================================================
-- Migration: Corrigir auth_rls_initplan e multiple_permissive_policies
-- Data: 2026-02-20
-- =============================================================================
--
-- 1) auth_rls_initplan: auth.uid() reavaliado por linha → (select auth.uid())
-- 2) multiple_permissive_policies: consolidar políticas duplicadas por role+action
--
-- Docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- =============================================================================

-- ── 1. landing_page_content ───────────────────────────────────────────────────
-- auth_rls_initplan + multiple_permissive: merge em uma SELECT e uma modify
DROP POLICY IF EXISTS "landing_content_public_read" ON public.landing_page_content;
DROP POLICY IF EXISTS "landing_content_super_admin_write" ON public.landing_page_content;
CREATE POLICY "landing_content_select"
  ON public.landing_page_content FOR SELECT USING (true);
CREATE POLICY "landing_content_super_admin_modify"
  ON public.landing_page_content FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));
CREATE POLICY "landing_content_super_admin_update"
  ON public.landing_page_content FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));
CREATE POLICY "landing_content_super_admin_delete"
  ON public.landing_page_content FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin'));

-- ── 2. inventory_items ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = inventory_items.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = inventory_items.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = inventory_items.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = inventory_items.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = inventory_items.restaurant_id)))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = inventory_items.restaurant_id AND r.is_active = true AND r.role = 'owner')
  );

-- ── 3. inventory_movements ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_movements_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select" ON public.inventory_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_items ii
      JOIN public.users u ON u.id = (SELECT auth.uid())
      WHERE ii.id = inventory_movements.inventory_item_id AND (u.role = 'super_admin' OR u.restaurant_id = ii.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.inventory_items ii
      JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid())
      WHERE ii.id = inventory_movements.inventory_item_id AND r.restaurant_id = ii.restaurant_id AND r.is_active = true
    )
  );
DROP POLICY IF EXISTS "inventory_movements_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_insert" ON public.inventory_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_items ii
      JOIN public.users u ON u.id = (SELECT auth.uid())
      WHERE ii.id = inventory_item_id AND (u.role = 'super_admin' OR u.restaurant_id = ii.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.inventory_items ii
      JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid())
      WHERE ii.id = inventory_item_id AND r.restaurant_id = ii.restaurant_id AND r.is_active = true
    )
  );

-- ── 4. product_upsells (auth_rls + multiple) ──────────────────────────────────
DROP POLICY IF EXISTS "Public can read product_upsells" ON public.product_upsells;
DROP POLICY IF EXISTS "Restaurant staff can manage product_upsells" ON public.product_upsells;
CREATE POLICY "product_upsells_select" ON public.product_upsells FOR SELECT USING (true);
CREATE POLICY "product_upsells_staff_insert" ON public.product_upsells FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.restaurant_id = product_upsells.restaurant_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = product_upsells.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
CREATE POLICY "product_upsells_staff_update" ON public.product_upsells FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.restaurant_id = product_upsells.restaurant_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = product_upsells.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.restaurant_id = product_upsells.restaurant_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = product_upsells.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
CREATE POLICY "product_upsells_staff_delete" ON public.product_upsells FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.restaurant_id = product_upsells.restaurant_id)
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = product_upsells.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );

-- ── 5. product_combo_items (auth_rls + multiple) ──────────────────────────────
DROP POLICY IF EXISTS "Restaurant staff can manage product_combo_items" ON public.product_combo_items;
DROP POLICY IF EXISTS "Public can read product_combo_items" ON public.product_combo_items;
CREATE POLICY "product_combo_items_select" ON public.product_combo_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true WHERE p.id = product_combo_items.combo_product_id AND p.is_active = true)
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) AND u.restaurant_id = p.restaurant_id WHERE p.id = product_combo_items.combo_product_id)
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_combo_items.combo_product_id)
  );
CREATE POLICY "product_combo_items_staff_modify" ON public.product_combo_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) AND u.restaurant_id = p.restaurant_id WHERE p.id = product_combo_items.combo_product_id));
CREATE POLICY "product_combo_items_staff_update" ON public.product_combo_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) AND u.restaurant_id = p.restaurant_id WHERE p.id = product_combo_items.combo_product_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) AND u.restaurant_id = p.restaurant_id WHERE p.id = product_combo_items.combo_product_id));
CREATE POLICY "product_combo_items_staff_delete" ON public.product_combo_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) AND u.restaurant_id = p.restaurant_id WHERE p.id = product_combo_items.combo_product_id));

-- ── 6. product_offers (auth_rls + multiple) ───────────────────────────────────
DROP POLICY IF EXISTS "Restaurant staff can manage product_offers" ON public.product_offers;
DROP POLICY IF EXISTS "Public can read active product_offers" ON public.product_offers;
CREATE POLICY "product_offers_select" ON public.product_offers FOR SELECT
  USING (
    (product_offers.is_active = true AND EXISTS (SELECT 1 FROM public.restaurants r JOIN public.products p ON p.restaurant_id = r.id AND p.id = product_offers.product_id WHERE r.id = product_offers.restaurant_id AND r.is_active = true AND p.is_active = true))
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = product_offers.restaurant_id))
  );
CREATE POLICY "product_offers_staff_insert" ON public.product_offers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = product_offers.restaurant_id)));
CREATE POLICY "product_offers_staff_update" ON public.product_offers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = product_offers.restaurant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = product_offers.restaurant_id)));
CREATE POLICY "product_offers_staff_delete" ON public.product_offers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = product_offers.restaurant_id)));

-- ── 7. ingredients ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ingredients_select" ON public.ingredients;
CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "ingredients_insert" ON public.ingredients;
CREATE POLICY "ingredients_insert" ON public.ingredients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredients_update" ON public.ingredients;
CREATE POLICY "ingredients_update" ON public.ingredients FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredients_delete" ON public.ingredients;
CREATE POLICY "ingredients_delete" ON public.ingredients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = (SELECT auth.uid()) AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );

-- ── 8. ingredient_stock ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ingredient_stock_select" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_select" ON public.ingredient_stock FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.ingredients i JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredients i JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "ingredient_stock_insert" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_insert" ON public.ingredient_stock FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ingredients i JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE i.id = ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredients i JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE i.id = ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredient_stock_update" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_update" ON public.ingredient_stock FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.ingredients i JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredients i JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredient_stock_delete" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_delete" ON public.ingredient_stock FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.ingredients i JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredients i JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role = 'owner')
  );

-- ── 9. ingredient_movements ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "ingredient_movements_select" ON public.ingredient_movements;
CREATE POLICY "ingredient_movements_select" ON public.ingredient_movements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.ingredient_stock ist JOIN public.ingredients i ON i.id = ist.ingredient_id JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE ist.id = ingredient_movements.ingredient_stock_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredient_stock ist JOIN public.ingredients i ON i.id = ist.ingredient_id JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE ist.id = ingredient_movements.ingredient_stock_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "ingredient_movements_insert" ON public.ingredient_movements;
CREATE POLICY "ingredient_movements_insert" ON public.ingredient_movements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ingredient_stock ist JOIN public.ingredients i ON i.id = ist.ingredient_id JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE ist.id = ingredient_stock_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.ingredient_stock ist JOIN public.ingredients i ON i.id = ist.ingredient_id JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE ist.id = ingredient_stock_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true)
  );

-- ── 10. product_ingredients ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "product_ingredients_select" ON public.product_ingredients;
CREATE POLICY "product_ingredients_select" ON public.product_ingredients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "product_ingredients_insert" ON public.product_ingredients;
CREATE POLICY "product_ingredients_insert" ON public.product_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE p.id = product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE p.id = product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "product_ingredients_update" ON public.product_ingredients;
CREATE POLICY "product_ingredients_update" ON public.product_ingredients FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "product_ingredients_delete" ON public.product_ingredients;
CREATE POLICY "product_ingredients_delete" ON public.product_ingredients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.users u ON u.id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles r ON r.user_id = (SELECT auth.uid()) WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );

-- ── 11. product_addon_groups (auth_rls + multiple) ────────────────────────────
DROP POLICY IF EXISTS "Users can manage addon groups" ON public.product_addon_groups;
DROP POLICY IF EXISTS "Public can read addon groups" ON public.product_addon_groups;
CREATE POLICY "product_addon_groups_select" ON public.product_addon_groups FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_groups_staff_insert" ON public.product_addon_groups FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_groups_staff_update" ON public.product_addon_groups FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_groups_staff_delete" ON public.product_addon_groups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE p.id = product_addon_groups.product_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );

-- ── 12. product_addon_items (auth_rls + multiple) ─────────────────────────────
DROP POLICY IF EXISTS "Users can manage addon items" ON public.product_addon_items;
DROP POLICY IF EXISTS "Public can read addon items" ON public.product_addon_items;
CREATE POLICY "product_addon_items_select" ON public.product_addon_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_items_staff_insert" ON public.product_addon_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_items_staff_update" ON public.product_addon_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
CREATE POLICY "product_addon_items_staff_delete" ON public.product_addon_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.product_addon_groups g JOIN public.products p ON p.id = g.product_id JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = (SELECT auth.uid()) AND rur.is_active WHERE g.id = product_addon_items.addon_group_id)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );
