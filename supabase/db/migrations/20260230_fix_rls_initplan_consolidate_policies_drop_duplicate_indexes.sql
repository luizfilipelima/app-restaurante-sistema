-- =============================================================================
-- Migration: Corrige Auth RLS InitPlan, consolida políticas duplicadas e remove índices duplicados
-- Data: 2026-02-30
-- =============================================================================
--
-- 1) auth_rls_initplan: políticas e funções helper ainda usam auth.uid() direto.
--    Corrige: (SELECT auth.uid()) e atualiza current_user_restaurant_id/current_user_is_super_admin.
--
-- 2) multiple_permissive_policies: consolida políticas que se sobrepõem na mesma
--    tabela/role/ação em uma única política com condição OR.
--
-- 3) duplicate_index: remove índices duplicados (mantém o com sufixo _id ou _status).
--
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 1: Fix Auth RLS InitPlan
-- ─────────────────────────────────────────────────────────────────────────────

-- Funções helper: usar (SELECT auth.uid()) para evitar reavaliação por linha
CREATE OR REPLACE FUNCTION public.current_user_restaurant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'super_admin');
$$;

-- Políticas que ainda usam auth.uid() direto (podem vir de scripts)
-- products
DROP POLICY IF EXISTS "Admin or super_admin manage products" ON public.products;
CREATE POLICY "Admin or super_admin manage products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );

-- delivery_zones
DROP POLICY IF EXISTS "Admin or super_admin manage delivery_zones" ON public.delivery_zones;
CREATE POLICY "Admin or super_admin manage delivery_zones"
  ON public.delivery_zones FOR ALL
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

-- pizza_sizes, pizza_flavors, pizza_doughs, pizza_edges
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_sizes" ON public.pizza_sizes;
CREATE POLICY "Admin or super_admin manage pizza_sizes"
  ON public.pizza_sizes FOR ALL
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

DROP POLICY IF EXISTS "Admin or super_admin manage pizza_flavors" ON public.pizza_flavors;
CREATE POLICY "Admin or super_admin manage pizza_flavors"
  ON public.pizza_flavors FOR ALL
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

DROP POLICY IF EXISTS "Admin or super_admin manage pizza_doughs" ON public.pizza_doughs;
CREATE POLICY "Admin or super_admin manage pizza_doughs"
  ON public.pizza_doughs FOR ALL
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

DROP POLICY IF EXISTS "Admin or super_admin manage pizza_edges" ON public.pizza_edges;
CREATE POLICY "Admin or super_admin manage pizza_edges"
  ON public.pizza_edges FOR ALL
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

-- orders (usando helpers STABLE; com (SELECT ...) para initPlan)
DROP POLICY IF EXISTS "Staff or super_admin read orders" ON public.orders;
CREATE POLICY "Staff or super_admin read orders"
  ON public.orders FOR SELECT
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
  );

DROP POLICY IF EXISTS "Staff or super_admin update orders" ON public.orders;
CREATE POLICY "Staff or super_admin update orders"
  ON public.orders FOR UPDATE
  USING (
    orders.restaurant_id = (SELECT current_user_restaurant_id())
    OR (SELECT current_user_is_super_admin())
  );

-- order_items
DROP POLICY IF EXISTS "Staff or super_admin read order items" ON public.order_items;
CREATE POLICY "Staff or super_admin read order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (o.restaurant_id = (SELECT current_user_restaurant_id()) OR (SELECT current_user_is_super_admin()))
    )
  );

-- restaurants
DROP POLICY IF EXISTS "Super admin read all restaurants" ON public.restaurants;
CREATE POLICY "Super admin read all restaurants"
  ON public.restaurants FOR SELECT
  USING ((SELECT current_user_is_super_admin()));


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 2: Consolidar políticas permissive (multiple_permissive_policies)
-- Uma política por (tabela, role implícito, ação) com condição OR combinada
-- ─────────────────────────────────────────────────────────────────────────────

-- active_sessions: merge "Users can manage own sessions" + "Super admin can view all sessions"
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Super admin can view all sessions" ON public.active_sessions;
CREATE POLICY "active_sessions_select"
  ON public.active_sessions FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT current_user_is_super_admin())
  );
CREATE POLICY "active_sessions_insert_update_delete"
  ON public.active_sessions FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- FOR ALL incluiria SELECT (conflito). Separamos INSERT, UPDATE, DELETE:
DROP POLICY IF EXISTS "active_sessions_insert_update_delete" ON public.active_sessions;
CREATE POLICY "active_sessions_mutation"
  ON public.active_sessions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "active_sessions_update"
  ON public.active_sessions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "active_sessions_delete"
  ON public.active_sessions FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- users: merge "Users can read own profile" + "Super admin can read all users"
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Super admin can read all users" ON public.users;
CREATE POLICY "users_select"
  ON public.users FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR (SELECT current_user_is_super_admin())
  );

-- products: merge "Admin or super_admin manage products" + "Public can read active products" + "Restaurant admin can manage products"
-- SELECT: público lê ativos OU staff/super gerencia. ALL: staff/super
DROP POLICY IF EXISTS "Restaurant admin can manage products" ON public.products;
DROP POLICY IF EXISTS "Public can read active products" ON public.products;
-- Admin or super_admin manage products já existe e cobre ALL. Para SELECT precisamos incluir público.
-- Reescrevemos: 1 policy SELECT (público OU admin), 1 policy para INSERT/UPDATE/DELETE (só admin)
DROP POLICY IF EXISTS "Admin or super_admin manage products" ON public.products;
CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "products_mutation"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );

-- Remover FOR ALL da products_mutation e usar INSERT, UPDATE, DELETE separados? Não - FOR ALL cobre e a WITH CHECK aplica.
-- Mas FOR ALL inclui SELECT - então teríamos duas políticas SELECT. A products_select cobre SELECT. A products_mutation com FOR ALL incluiria SELECT de novo. Mudar para INSERT, UPDATE, DELETE apenas:
DROP POLICY IF EXISTS "products_mutation" ON public.products;
CREATE POLICY "products_insert"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "products_update"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );
CREATE POLICY "products_delete"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND ((u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id) OR u.role = 'super_admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 3: Remover índices duplicados (duplicate_index)
-- Mantém o índice com sufixo _id ou nome mais específico
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_products_restaurant;
DROP INDEX IF EXISTS public.idx_orders_restaurant;
DROP INDEX IF EXISTS public.idx_orders_restaurant_created;
DROP INDEX IF EXISTS public.idx_orders_order_source;
DROP INDEX IF EXISTS public.idx_order_items_order;
DROP INDEX IF EXISTS public.idx_delivery_zones_restaurant;
DROP INDEX IF EXISTS public.idx_pizza_flavors_restaurant;
DROP INDEX IF EXISTS public.idx_pizza_sizes_restaurant;
DROP INDEX IF EXISTS public.idx_couriers_restaurant;
DROP INDEX IF EXISTS public.idx_couriers_restaurant_status;
DROP INDEX IF EXISTS public.idx_couriers_status;
DROP INDEX IF EXISTS public.idx_marmita_sizes_restaurant;
DROP INDEX IF EXISTS public.idx_marmita_proteins_restaurant;
DROP INDEX IF EXISTS public.idx_marmita_sides_restaurant;
DROP INDEX IF EXISTS public.idx_subcategories_restaurant;
DROP INDEX IF EXISTS public.idx_tables_restaurant;
DROP INDEX IF EXISTS public.idx_users_restaurant;
DROP INDEX IF EXISTS public.idx_waiter_calls_restaurant;
DROP INDEX IF EXISTS public.idx_waiter_calls_restaurant_status;
DROP INDEX IF EXISTS public.idx_waiter_calls_status;
