-- =============================================================================
-- Migration: Gerente e proprietário com mesmo poder do super-admin no restaurante
-- Data: 2026-04-14
--
-- Objetivo: owner e manager (via restaurant_user_roles) passam a ter as mesmas
-- permissões que restaurant_admin/super_admin para o restaurante ao qual estão
-- vinculados (gestão completa dentro daquele restaurante).
--
-- Alterações:
--   1. Função current_user_can_admin_restaurant(restaurant_id) para uso em RLS
--   2. can_manage_restaurant_users passa a incluir role 'manager' (além de owner)
--   3. Políticas RLS atualizadas em todas as tabelas por-restaurante
-- =============================================================================

-- Garantir colunas is_active (e deleted_at em restaurants) em todas as tabelas
-- usadas pelas políticas abaixo. Evita erro 42703 em DBs antigos ou schemas diferentes.
DO $$
BEGIN
  -- restaurant_user_roles (usado nas funções current_user_can_admin_restaurant e can_manage_restaurant_users)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_user_roles' AND column_name = 'is_active') THEN
    ALTER TABLE public.restaurant_user_roles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_active') THEN
    ALTER TABLE public.products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- delivery_zones
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'delivery_zones' AND column_name = 'is_active') THEN
    ALTER TABLE public.delivery_zones ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'is_active') THEN
    ALTER TABLE public.categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- subcategories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subcategories' AND column_name = 'is_active') THEN
    ALTER TABLE public.subcategories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tables' AND column_name = 'is_active') THEN
    ALTER TABLE public.tables ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  -- restaurants
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'is_active') THEN
    ALTER TABLE public.restaurants ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.restaurants ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ========== 1. Função helper para RLS ==========
-- Retorna true se o usuário logado pode administrar o restaurante (super_admin,
-- restaurant_admin desse restaurante, ou owner/manager via restaurant_user_roles).
CREATE OR REPLACE FUNCTION public.current_user_can_admin_restaurant(
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
      AND rur.role IN ('owner', 'manager')
  );
$$;

COMMENT ON FUNCTION public.current_user_can_admin_restaurant(UUID) IS
  'True se o usuário logado pode administrar o restaurante (super_admin, restaurant_admin, owner ou manager no restaurante).';


-- ========== 2. can_manage_restaurant_users: incluir manager ==========
-- Usado pelas RPCs de gestão de usuários (listar, alterar cargo, desativar, reativar).
CREATE OR REPLACE FUNCTION public.can_manage_restaurant_users(
  p_restaurant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_user_role  TEXT;
  v_user_rest  UUID;
  v_admin_role BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN RETURN FALSE; END IF;

  SELECT role, restaurant_id INTO v_user_role, v_user_rest
  FROM public.users WHERE id = v_caller_id;
  IF v_user_role = 'super_admin' THEN RETURN TRUE; END IF;
  IF v_user_role = 'restaurant_admin' AND v_user_rest = p_restaurant_id THEN
    RETURN TRUE;
  END IF;

  -- owner ou manager em restaurant_user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_user_roles
    WHERE user_id = v_caller_id
      AND restaurant_id = p_restaurant_id
      AND role IN ('owner', 'manager')
      AND is_active = true
  ) INTO v_admin_role;
  RETURN v_admin_role;
END;
$$;


-- ========== 3. Products ==========
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (
    products.is_active = true
    OR (SELECT current_user_can_admin_restaurant(products.restaurant_id))
  );

DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert"
  ON public.products FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(products.restaurant_id)));

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update"
  ON public.products FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(products.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(products.restaurant_id)));

DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete"
  ON public.products FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(products.restaurant_id)));


-- ========== 4. Delivery zones ==========
DROP POLICY IF EXISTS "Admin or super_admin manage delivery_zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "delivery_zones_select" ON public.delivery_zones;
DROP POLICY IF EXISTS "delivery_zones_mutation" ON public.delivery_zones;
DROP POLICY IF EXISTS "delivery_zones_insert" ON public.delivery_zones;
DROP POLICY IF EXISTS "delivery_zones_update" ON public.delivery_zones;
DROP POLICY IF EXISTS "delivery_zones_delete" ON public.delivery_zones;

CREATE POLICY "delivery_zones_select"
  ON public.delivery_zones FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(delivery_zones.restaurant_id))
    OR (delivery_zones.is_active = true)
  );
CREATE POLICY "delivery_zones_insert"
  ON public.delivery_zones FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(delivery_zones.restaurant_id)));
CREATE POLICY "delivery_zones_update"
  ON public.delivery_zones FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(delivery_zones.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(delivery_zones.restaurant_id)));
CREATE POLICY "delivery_zones_delete"
  ON public.delivery_zones FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(delivery_zones.restaurant_id)));


-- ========== 5. Pizza sizes, flavors, doughs, edges ==========
DO $$
DECLARE
  t text;
  tbl text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pizza_sizes', 'pizza_flavors', 'pizza_doughs', 'pizza_edges'])
  LOOP
    tbl := t;
    EXECUTE format(
      'DROP POLICY IF EXISTS "Admin or super_admin manage %s" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_select" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_mutation" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_insert" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_update" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_delete" ON public.%I',
      tbl, tbl
    );
  END LOOP;
END $$;

-- pizza_sizes
CREATE POLICY "pizza_sizes_select" ON public.pizza_sizes FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(pizza_sizes.restaurant_id))
    OR true
  );
CREATE POLICY "pizza_sizes_insert" ON public.pizza_sizes FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_sizes.restaurant_id)));
CREATE POLICY "pizza_sizes_update" ON public.pizza_sizes FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(pizza_sizes.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_sizes.restaurant_id)));
CREATE POLICY "pizza_sizes_delete" ON public.pizza_sizes FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(pizza_sizes.restaurant_id)));

-- pizza_flavors
CREATE POLICY "pizza_flavors_select" ON public.pizza_flavors FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(pizza_flavors.restaurant_id))
    OR true
  );
CREATE POLICY "pizza_flavors_insert" ON public.pizza_flavors FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_flavors.restaurant_id)));
CREATE POLICY "pizza_flavors_update" ON public.pizza_flavors FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(pizza_flavors.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_flavors.restaurant_id)));
CREATE POLICY "pizza_flavors_delete" ON public.pizza_flavors FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(pizza_flavors.restaurant_id)));

-- pizza_doughs
CREATE POLICY "pizza_doughs_select" ON public.pizza_doughs FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(pizza_doughs.restaurant_id))
    OR true
  );
CREATE POLICY "pizza_doughs_insert" ON public.pizza_doughs FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_doughs.restaurant_id)));
CREATE POLICY "pizza_doughs_update" ON public.pizza_doughs FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(pizza_doughs.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_doughs.restaurant_id)));
CREATE POLICY "pizza_doughs_delete" ON public.pizza_doughs FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(pizza_doughs.restaurant_id)));

-- pizza_edges
CREATE POLICY "pizza_edges_select" ON public.pizza_edges FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(pizza_edges.restaurant_id))
    OR true
  );
CREATE POLICY "pizza_edges_insert" ON public.pizza_edges FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_edges.restaurant_id)));
CREATE POLICY "pizza_edges_update" ON public.pizza_edges FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(pizza_edges.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_edges.restaurant_id)));
CREATE POLICY "pizza_edges_delete" ON public.pizza_edges FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(pizza_edges.restaurant_id)));


-- ========== 6. Categories ==========
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_mutation" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;

CREATE POLICY "categories_select" ON public.categories FOR SELECT
  USING (
    categories.is_active = true
    OR (SELECT current_user_can_admin_restaurant(categories.restaurant_id))
  );
CREATE POLICY "categories_insert" ON public.categories FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(categories.restaurant_id)));
CREATE POLICY "categories_update" ON public.categories FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(categories.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(categories.restaurant_id)));
CREATE POLICY "categories_delete" ON public.categories FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(categories.restaurant_id)));


-- ========== 7. Subcategories ==========
DROP POLICY IF EXISTS "subcategories_select" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_mutation" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_insert" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_update" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_delete" ON public.subcategories;

CREATE POLICY "subcategories_select" ON public.subcategories FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(subcategories.restaurant_id))
    OR true
  );
CREATE POLICY "subcategories_insert" ON public.subcategories FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(subcategories.restaurant_id)));
CREATE POLICY "subcategories_update" ON public.subcategories FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(subcategories.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(subcategories.restaurant_id)));
CREATE POLICY "subcategories_delete" ON public.subcategories FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(subcategories.restaurant_id)));


-- ========== 8. Tables ==========
DROP POLICY IF EXISTS "tables_select" ON public.tables;
DROP POLICY IF EXISTS "tables_mutation" ON public.tables;
DROP POLICY IF EXISTS "tables_insert" ON public.tables;
DROP POLICY IF EXISTS "tables_update" ON public.tables;
DROP POLICY IF EXISTS "tables_delete" ON public.tables;

CREATE POLICY "tables_select" ON public.tables FOR SELECT
  USING (
    tables.is_active = true
    OR (SELECT current_user_can_admin_restaurant(tables.restaurant_id))
  );
CREATE POLICY "tables_insert" ON public.tables FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(tables.restaurant_id)));
CREATE POLICY "tables_update" ON public.tables FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(tables.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(tables.restaurant_id)));
CREATE POLICY "tables_delete" ON public.tables FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(tables.restaurant_id)));


-- ========== 9. Marmita sizes, proteins, sides ==========
DROP POLICY IF EXISTS "Admin or super_admin manage marmita sizes" ON public.marmita_sizes;
DROP POLICY IF EXISTS "marmita_sizes_select" ON public.marmita_sizes;
DROP POLICY IF EXISTS "marmita_sizes_mutation" ON public.marmita_sizes;
DROP POLICY IF EXISTS "marmita_sizes_insert" ON public.marmita_sizes;
DROP POLICY IF EXISTS "marmita_sizes_update" ON public.marmita_sizes;
DROP POLICY IF EXISTS "marmita_sizes_delete" ON public.marmita_sizes;
CREATE POLICY "marmita_sizes_select" ON public.marmita_sizes FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(marmita_sizes.restaurant_id)) OR true);
CREATE POLICY "marmita_sizes_insert" ON public.marmita_sizes FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_sizes.restaurant_id)));
CREATE POLICY "marmita_sizes_update" ON public.marmita_sizes FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(marmita_sizes.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_sizes.restaurant_id)));
CREATE POLICY "marmita_sizes_delete" ON public.marmita_sizes FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(marmita_sizes.restaurant_id)));

DROP POLICY IF EXISTS "Admin or super_admin manage marmita proteins" ON public.marmita_proteins;
DROP POLICY IF EXISTS "marmita_proteins_select" ON public.marmita_proteins;
DROP POLICY IF EXISTS "marmita_proteins_mutation" ON public.marmita_proteins;
DROP POLICY IF EXISTS "marmita_proteins_insert" ON public.marmita_proteins;
DROP POLICY IF EXISTS "marmita_proteins_update" ON public.marmita_proteins;
DROP POLICY IF EXISTS "marmita_proteins_delete" ON public.marmita_proteins;
CREATE POLICY "marmita_proteins_select" ON public.marmita_proteins FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(marmita_proteins.restaurant_id)) OR true);
CREATE POLICY "marmita_proteins_insert" ON public.marmita_proteins FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_proteins.restaurant_id)));
CREATE POLICY "marmita_proteins_update" ON public.marmita_proteins FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(marmita_proteins.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_proteins.restaurant_id)));
CREATE POLICY "marmita_proteins_delete" ON public.marmita_proteins FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(marmita_proteins.restaurant_id)));

DROP POLICY IF EXISTS "Admin or super_admin manage marmita sides" ON public.marmita_sides;
DROP POLICY IF EXISTS "marmita_sides_select" ON public.marmita_sides;
DROP POLICY IF EXISTS "marmita_sides_mutation" ON public.marmita_sides;
DROP POLICY IF EXISTS "marmita_sides_insert" ON public.marmita_sides;
DROP POLICY IF EXISTS "marmita_sides_update" ON public.marmita_sides;
DROP POLICY IF EXISTS "marmita_sides_delete" ON public.marmita_sides;
CREATE POLICY "marmita_sides_select" ON public.marmita_sides FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(marmita_sides.restaurant_id)) OR true);
CREATE POLICY "marmita_sides_insert" ON public.marmita_sides FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_sides.restaurant_id)));
CREATE POLICY "marmita_sides_update" ON public.marmita_sides FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(marmita_sides.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(marmita_sides.restaurant_id)));
CREATE POLICY "marmita_sides_delete" ON public.marmita_sides FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(marmita_sides.restaurant_id)));


-- ========== 10. Comandas e comanda_items ==========
DROP POLICY IF EXISTS "comandas_select" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete" ON public.comandas;
CREATE POLICY "comandas_select" ON public.comandas FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(comandas.restaurant_id)) OR true);
CREATE POLICY "comandas_insert" ON public.comandas FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(comandas.restaurant_id)));
CREATE POLICY "comandas_update" ON public.comandas FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(comandas.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(comandas.restaurant_id)));
CREATE POLICY "comandas_delete" ON public.comandas FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(comandas.restaurant_id)));

DROP POLICY IF EXISTS "comanda_items_select" ON public.comanda_items;
DROP POLICY IF EXISTS "comanda_items_insert" ON public.comanda_items;
DROP POLICY IF EXISTS "comanda_items_update" ON public.comanda_items;
DROP POLICY IF EXISTS "comanda_items_delete" ON public.comanda_items;
CREATE POLICY "comanda_items_select" ON public.comanda_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND (SELECT current_user_can_admin_restaurant(c.restaurant_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND c.status = 'open'
    )
  );
CREATE POLICY "comanda_items_insert" ON public.comanda_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND (SELECT current_user_can_admin_restaurant(c.restaurant_id))
    )
  );
CREATE POLICY "comanda_items_update" ON public.comanda_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND (SELECT current_user_can_admin_restaurant(c.restaurant_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND (SELECT current_user_can_admin_restaurant(c.restaurant_id))
    )
  );
CREATE POLICY "comanda_items_delete" ON public.comanda_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_items.comanda_id
      AND (SELECT current_user_can_admin_restaurant(c.restaurant_id))
    )
  );


-- ========== 11. Waiter calls ==========
DROP POLICY IF EXISTS "waiter_calls_select" ON public.waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_insert" ON public.waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_update" ON public.waiter_calls;
DROP POLICY IF EXISTS "waiter_calls_delete" ON public.waiter_calls;
CREATE POLICY "waiter_calls_select" ON public.waiter_calls FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id)) OR true);
CREATE POLICY "waiter_calls_insert" ON public.waiter_calls FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id)));
CREATE POLICY "waiter_calls_update" ON public.waiter_calls FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id)));
CREATE POLICY "waiter_calls_delete" ON public.waiter_calls FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id)));


-- ========== 12. Orders e order_items (incluir owner/manager por restaurant_id) ==========
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
    OR (SELECT current_user_can_admin_restaurant(orders.restaurant_id))
  );
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
    OR (SELECT current_user_can_admin_restaurant(orders.restaurant_id))
  );

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (
        o.restaurant_id = (SELECT current_user_restaurant_id())
        OR (SELECT current_user_is_super_admin())
        OR (SELECT current_user_can_admin_restaurant(o.restaurant_id))
      )
    )
  );


-- ========== 13. Restaurants SELECT (owner/manager podem ler seu restaurante) ==========
DROP POLICY IF EXISTS "restaurants_select" ON public.restaurants;
CREATE POLICY "restaurants_select"
  ON public.restaurants FOR SELECT
  USING (
    (restaurants.is_active = true AND restaurants.deleted_at IS NULL)
    OR (SELECT current_user_is_super_admin())
    OR (SELECT current_user_can_admin_restaurant(restaurants.id))
  );


-- ========== 14. Restaurant subscriptions (leitura para owner/manager) ==========
DROP POLICY IF EXISTS "restaurant_subscriptions_select" ON public.restaurant_subscriptions;
CREATE POLICY "restaurant_subscriptions_select"
  ON public.restaurant_subscriptions FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(restaurant_subscriptions.restaurant_id)));


-- ========== 15. Restaurant feature overrides (leitura para owner/manager) ==========
DROP POLICY IF EXISTS "restaurant_feature_overrides_select" ON public.restaurant_feature_overrides;
CREATE POLICY "restaurant_feature_overrides_select"
  ON public.restaurant_feature_overrides FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(restaurant_feature_overrides.restaurant_id)));


-- ========== 16. Restaurant user roles (owner/manager gerenciam cargos do restaurante) ==========
DROP POLICY IF EXISTS "restaurant_user_roles_select" ON public.restaurant_user_roles;
DROP POLICY IF EXISTS "restaurant_user_roles_mutation" ON public.restaurant_user_roles;
DROP POLICY IF EXISTS "restaurant_user_roles_insert" ON public.restaurant_user_roles;
DROP POLICY IF EXISTS "restaurant_user_roles_update" ON public.restaurant_user_roles;
DROP POLICY IF EXISTS "restaurant_user_roles_delete" ON public.restaurant_user_roles;

CREATE POLICY "restaurant_user_roles_select"
  ON public.restaurant_user_roles FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(restaurant_user_roles.restaurant_id))
    OR (SELECT auth.uid()) = restaurant_user_roles.user_id
  );
CREATE POLICY "restaurant_user_roles_insert"
  ON public.restaurant_user_roles FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(restaurant_user_roles.restaurant_id)));
CREATE POLICY "restaurant_user_roles_update"
  ON public.restaurant_user_roles FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(restaurant_user_roles.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(restaurant_user_roles.restaurant_id)));
CREATE POLICY "restaurant_user_roles_delete"
  ON public.restaurant_user_roles FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(restaurant_user_roles.restaurant_id)));


-- ========== 17. Couriers ==========
DROP POLICY IF EXISTS "Admin or super_admin read couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin or super_admin insert couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin or super_admin update couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin or super_admin delete couriers" ON public.couriers;

CREATE POLICY "Admin or super_admin read couriers"
  ON public.couriers FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(couriers.restaurant_id)));
CREATE POLICY "Admin or super_admin insert couriers"
  ON public.couriers FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(couriers.restaurant_id)));
CREATE POLICY "Admin or super_admin update couriers"
  ON public.couriers FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(couriers.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(couriers.restaurant_id)));
CREATE POLICY "Admin or super_admin delete couriers"
  ON public.couriers FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(couriers.restaurant_id)));


-- ========== 18. Hall zones e table_comanda_links ==========
DROP POLICY IF EXISTS "Restaurant admins can manage own hall_zones" ON public.hall_zones;
CREATE POLICY "Restaurant admins can manage own hall_zones"
  ON public.hall_zones FOR ALL
  USING ((SELECT current_user_can_admin_restaurant(hall_zones.restaurant_id)));

DROP POLICY IF EXISTS "Restaurant admins can manage own table_comanda_links" ON public.table_comanda_links;
CREATE POLICY "Restaurant admins can manage own table_comanda_links"
  ON public.table_comanda_links FOR ALL
  USING ((SELECT current_user_can_admin_restaurant(table_comanda_links.restaurant_id)));


-- ========== 19. Loyalty programs e loyalty_points ==========
DROP POLICY IF EXISTS "loyalty_programs_select" ON public.loyalty_programs;
DROP POLICY IF EXISTS "loyalty_programs_insert" ON public.loyalty_programs;
DROP POLICY IF EXISTS "loyalty_programs_update" ON public.loyalty_programs;
DROP POLICY IF EXISTS "loyalty_programs_delete" ON public.loyalty_programs;
CREATE POLICY "loyalty_programs_select" ON public.loyalty_programs FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(loyalty_programs.restaurant_id)));
CREATE POLICY "loyalty_programs_insert" ON public.loyalty_programs FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(loyalty_programs.restaurant_id)));
CREATE POLICY "loyalty_programs_update" ON public.loyalty_programs FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(loyalty_programs.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(loyalty_programs.restaurant_id)));
CREATE POLICY "loyalty_programs_delete" ON public.loyalty_programs FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(loyalty_programs.restaurant_id)));

DROP POLICY IF EXISTS "loyalty_points_select" ON public.loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_insert" ON public.loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_update" ON public.loyalty_points;
CREATE POLICY "loyalty_points_select" ON public.loyalty_points FOR SELECT
  USING ((SELECT current_user_can_admin_restaurant(loyalty_points.restaurant_id)));
CREATE POLICY "loyalty_points_insert" ON public.loyalty_points FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(loyalty_points.restaurant_id)));
CREATE POLICY "loyalty_points_update" ON public.loyalty_points FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(loyalty_points.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(loyalty_points.restaurant_id)));
