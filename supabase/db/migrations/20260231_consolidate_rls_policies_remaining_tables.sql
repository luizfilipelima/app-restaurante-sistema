-- =============================================================================
-- Migration: Consolida políticas RLS (multiple_permissive_policies) nas tabelas restantes
-- Data: 2026-02-31
-- =============================================================================
--
-- Une políticas que se sobrepõem (mesma tabela, mesmo role, mesma ação) em uma
-- única política com condição OR, eliminando avisos do linter.
--
-- =============================================================================

-- Helper: condição admin OU super_admin para tabela com restaurant_id
-- Usado para evitar repetição. A verificação é inline nas políticas.

-- ── categories ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active restaurant categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant admins can manage own categories" ON public.categories;
CREATE POLICY "categories_select"
  ON public.categories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = categories.restaurant_id AND r.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = categories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "categories_mutation"
  ON public.categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = categories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "categories_update"
  ON public.categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = categories.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = categories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "categories_delete"
  ON public.categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = categories.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── subcategories ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active restaurant subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Restaurant admins can manage own subcategories" ON public.subcategories;
CREATE POLICY "subcategories_select"
  ON public.subcategories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = subcategories.restaurant_id AND r.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = subcategories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "subcategories_mutation"
  ON public.subcategories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = subcategories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "subcategories_update"
  ON public.subcategories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = subcategories.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = subcategories.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "subcategories_delete"
  ON public.subcategories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = subcategories.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── tables ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active restaurant tables" ON public.tables;
DROP POLICY IF EXISTS "Restaurant admins can manage own tables" ON public.tables;
CREATE POLICY "tables_select"
  ON public.tables FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = tables.restaurant_id AND r.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = tables.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "tables_mutation"
  ON public.tables FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = tables.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "tables_update"
  ON public.tables FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = tables.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = tables.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "tables_delete"
  ON public.tables FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = tables.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── delivery_zones ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active delivery zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Admin or super_admin manage delivery_zones" ON public.delivery_zones;
CREATE POLICY "delivery_zones_select"
  ON public.delivery_zones FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "delivery_zones_mutation"
  ON public.delivery_zones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "delivery_zones_update"
  ON public.delivery_zones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "delivery_zones_delete"
  ON public.delivery_zones FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── pizza_sizes, pizza_flavors, pizza_doughs, pizza_edges ───────────────────
DROP POLICY IF EXISTS "Public can read pizza sizes" ON public.pizza_sizes;
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_sizes" ON public.pizza_sizes;
CREATE POLICY "pizza_sizes_select"
  ON public.pizza_sizes FOR SELECT
  USING (true);  -- público lê todos; admin gerencia via mutation
CREATE POLICY "pizza_sizes_mutation"
  ON public.pizza_sizes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_sizes_update"
  ON public.pizza_sizes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_sizes_delete"
  ON public.pizza_sizes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id) OR u.role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Public can read pizza flavors" ON public.pizza_flavors;
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_flavors" ON public.pizza_flavors;
CREATE POLICY "pizza_flavors_select"
  ON public.pizza_flavors FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_flavors_mutation"
  ON public.pizza_flavors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_flavors_update"
  ON public.pizza_flavors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_flavors_delete"
  ON public.pizza_flavors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id) OR u.role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Public can read pizza doughs" ON public.pizza_doughs;
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_doughs" ON public.pizza_doughs;
CREATE POLICY "pizza_doughs_select"
  ON public.pizza_doughs FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_doughs_mutation"
  ON public.pizza_doughs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_doughs_update"
  ON public.pizza_doughs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_doughs_delete"
  ON public.pizza_doughs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id) OR u.role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Public can read pizza edges" ON public.pizza_edges;
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_edges" ON public.pizza_edges;
CREATE POLICY "pizza_edges_select"
  ON public.pizza_edges FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_edges_mutation"
  ON public.pizza_edges FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_edges_update"
  ON public.pizza_edges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "pizza_edges_delete"
  ON public.pizza_edges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── marmita_sizes, marmita_proteins, marmita_sides ──────────────────────────
DROP POLICY IF EXISTS "Public can read active marmita sizes" ON public.marmita_sizes;
DROP POLICY IF EXISTS "Admin or super_admin manage marmita sizes" ON public.marmita_sizes;
CREATE POLICY "marmita_sizes_select"
  ON public.marmita_sizes FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sizes.restaurant_id))
    )
  );
CREATE POLICY "marmita_sizes_mutation"
  ON public.marmita_sizes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sizes.restaurant_id))
    )
  );
CREATE POLICY "marmita_sizes_update"
  ON public.marmita_sizes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sizes.restaurant_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sizes.restaurant_id))
    )
  );
CREATE POLICY "marmita_sizes_delete"
  ON public.marmita_sizes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sizes.restaurant_id))
    )
  );

DROP POLICY IF EXISTS "Public can read active marmita proteins" ON public.marmita_proteins;
DROP POLICY IF EXISTS "Admin or super_admin manage marmita proteins" ON public.marmita_proteins;
CREATE POLICY "marmita_proteins_select"
  ON public.marmita_proteins FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_proteins.restaurant_id))
    )
  );
CREATE POLICY "marmita_proteins_mutation"
  ON public.marmita_proteins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_proteins.restaurant_id))
    )
  );
CREATE POLICY "marmita_proteins_update"
  ON public.marmita_proteins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_proteins.restaurant_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_proteins.restaurant_id))
    )
  );
CREATE POLICY "marmita_proteins_delete"
  ON public.marmita_proteins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_proteins.restaurant_id))
    )
  );

DROP POLICY IF EXISTS "Public can read active marmita sides" ON public.marmita_sides;
DROP POLICY IF EXISTS "Admin or super_admin manage marmita sides" ON public.marmita_sides;
CREATE POLICY "marmita_sides_select"
  ON public.marmita_sides FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sides.restaurant_id))
    )
  );
CREATE POLICY "marmita_sides_mutation"
  ON public.marmita_sides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sides.restaurant_id))
    )
  );
CREATE POLICY "marmita_sides_update"
  ON public.marmita_sides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sides.restaurant_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sides.restaurant_id))
    )
  );
CREATE POLICY "marmita_sides_delete"
  ON public.marmita_sides FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (u.role = 'super_admin' OR (u.role = 'restaurant_admin' AND u.restaurant_id = marmita_sides.restaurant_id))
    )
  );


-- ── comandas ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can insert comandas for active restaurants" ON public.comandas;
DROP POLICY IF EXISTS "Restaurant admins can manage own comandas" ON public.comandas;
CREATE POLICY "comandas_select"
  ON public.comandas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = comandas.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "comandas_insert"
  ON public.comandas FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = comandas.restaurant_id AND r.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = comandas.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "comandas_update"
  ON public.comandas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = comandas.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = comandas.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "comandas_delete"
  ON public.comandas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = comandas.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── comanda_items ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can insert comanda_items for open comandas" ON public.comanda_items;
DROP POLICY IF EXISTS "Restaurant admins can manage own comanda_items" ON public.comanda_items;
CREATE POLICY "comanda_items_select"
  ON public.comanda_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      JOIN public.users u ON (
        (u.role = 'restaurant_admin' AND u.restaurant_id = c.restaurant_id) OR u.role = 'super_admin'
      )
      WHERE c.id = comanda_items.comanda_id AND u.id = (SELECT auth.uid())
    )
  );
CREATE POLICY "comanda_items_insert"
  ON public.comanda_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.comandas c WHERE c.id = comanda_items.comanda_id AND c.status = 'open')
    OR EXISTS (
      SELECT 1 FROM public.comandas c
      JOIN public.users u ON (
        (u.role = 'restaurant_admin' AND u.restaurant_id = c.restaurant_id) OR u.role = 'super_admin'
      )
      WHERE c.id = comanda_items.comanda_id AND u.id = (SELECT auth.uid())
    )
  );
CREATE POLICY "comanda_items_update"
  ON public.comanda_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      JOIN public.users u ON (
        (u.role = 'restaurant_admin' AND u.restaurant_id = c.restaurant_id) OR u.role = 'super_admin'
      )
      WHERE c.id = comanda_items.comanda_id AND u.id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comandas c
      JOIN public.users u ON (
        (u.role = 'restaurant_admin' AND u.restaurant_id = c.restaurant_id) OR u.role = 'super_admin'
      )
      WHERE c.id = comanda_items.comanda_id AND u.id = (SELECT auth.uid())
    )
  );
CREATE POLICY "comanda_items_delete"
  ON public.comanda_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      JOIN public.users u ON (
        (u.role = 'restaurant_admin' AND u.restaurant_id = c.restaurant_id) OR u.role = 'super_admin'
      )
      WHERE c.id = comanda_items.comanda_id AND u.id = (SELECT auth.uid())
    )
  );


-- ── waiter_calls ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can insert waiter_calls for active restaurants" ON public.waiter_calls;
DROP POLICY IF EXISTS "Restaurant admins can manage own waiter_calls" ON public.waiter_calls;
CREATE POLICY "waiter_calls_select"
  ON public.waiter_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = waiter_calls.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "waiter_calls_insert"
  ON public.waiter_calls FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = waiter_calls.restaurant_id AND r.is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = waiter_calls.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "waiter_calls_update"
  ON public.waiter_calls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = waiter_calls.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = waiter_calls.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "waiter_calls_delete"
  ON public.waiter_calls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = waiter_calls.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ── orders ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant staff can read their orders" ON public.orders;
DROP POLICY IF EXISTS "Staff or super_admin read orders" ON public.orders;
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
  );

DROP POLICY IF EXISTS "Restaurant staff can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Staff or super_admin update orders" ON public.orders;
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
  );


-- ── order_items ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant staff can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff or super_admin read order items" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (o.restaurant_id = (SELECT current_user_restaurant_id()) OR (SELECT current_user_is_super_admin()))
    )
  );


-- ── restaurants ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admin can manage restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admin read all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admin can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admin can update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admin can delete restaurants" ON public.restaurants;
CREATE POLICY "restaurants_select"
  ON public.restaurants FOR SELECT
  USING (
    (is_active = true AND deleted_at IS NULL)
    OR (SELECT current_user_is_super_admin())
  );
CREATE POLICY "restaurants_insert"
  ON public.restaurants FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurants_update"
  ON public.restaurants FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurants_delete"
  ON public.restaurants FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── subscription_plans ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler planos" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admin gerencia planos" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admin can update subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admin can insert subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Super admin can delete subscription plans" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select"
  ON public.subscription_plans FOR SELECT
  USING (
    (SELECT auth.role()) = 'authenticated'
    OR (SELECT current_user_is_super_admin())
  );
CREATE POLICY "subscription_plans_insert"
  ON public.subscription_plans FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "subscription_plans_update"
  ON public.subscription_plans FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "subscription_plans_delete"
  ON public.subscription_plans FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── features ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler features" ON public.features;
DROP POLICY IF EXISTS "Super admin gerencia features" ON public.features;
CREATE POLICY "features_select"
  ON public.features FOR SELECT
  USING (
    (SELECT auth.role()) = 'authenticated'
    OR (SELECT current_user_is_super_admin())
  );
CREATE POLICY "features_mutation"
  ON public.features FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "features_update"
  ON public.features FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "features_delete"
  ON public.features FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── plan_features ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler plan_features" ON public.plan_features;
DROP POLICY IF EXISTS "Super admin gerencia plan_features" ON public.plan_features;
CREATE POLICY "plan_features_select"
  ON public.plan_features FOR SELECT
  USING (
    (SELECT auth.role()) = 'authenticated'
    OR (SELECT current_user_is_super_admin())
  );
CREATE POLICY "plan_features_mutation"
  ON public.plan_features FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "plan_features_update"
  ON public.plan_features FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "plan_features_delete"
  ON public.plan_features FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── restaurant_subscriptions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurante lê própria assinatura" ON public.restaurant_subscriptions;
DROP POLICY IF EXISTS "Super admin gerencia assinaturas" ON public.restaurant_subscriptions;
CREATE POLICY "restaurant_subscriptions_select"
  ON public.restaurant_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_subscriptions.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );
CREATE POLICY "restaurant_subscriptions_mutation"
  ON public.restaurant_subscriptions FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurant_subscriptions_update"
  ON public.restaurant_subscriptions FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurant_subscriptions_delete"
  ON public.restaurant_subscriptions FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── restaurant_feature_overrides ───────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurante lê próprios overrides" ON public.restaurant_feature_overrides;
DROP POLICY IF EXISTS "Super admin gerencia overrides" ON public.restaurant_feature_overrides;
CREATE POLICY "restaurant_feature_overrides_select"
  ON public.restaurant_feature_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_feature_overrides.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );
CREATE POLICY "restaurant_feature_overrides_mutation"
  ON public.restaurant_feature_overrides FOR INSERT
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurant_feature_overrides_update"
  ON public.restaurant_feature_overrides FOR UPDATE
  USING ((SELECT current_user_is_super_admin()))
  WITH CHECK ((SELECT current_user_is_super_admin()));
CREATE POLICY "restaurant_feature_overrides_delete"
  ON public.restaurant_feature_overrides FOR DELETE
  USING ((SELECT current_user_is_super_admin()));


-- ── restaurant_user_roles ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Usuários lêem roles do próprio restaurante" ON public.restaurant_user_roles;
DROP POLICY IF EXISTS "Admin ou super_admin gerenciam roles" ON public.restaurant_user_roles;
CREATE POLICY "restaurant_user_roles_select"
  ON public.restaurant_user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id)
        OR u.role = 'super_admin'
        OR u.id = restaurant_user_roles.user_id
      )
    )
  );
CREATE POLICY "restaurant_user_roles_mutation"
  ON public.restaurant_user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "restaurant_user_roles_update"
  ON public.restaurant_user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "restaurant_user_roles_delete"
  ON public.restaurant_user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id) OR u.role = 'super_admin')
    )
  );
