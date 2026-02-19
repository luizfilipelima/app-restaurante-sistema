-- =============================================================================
-- Migration: Corrige Auth RLS InitPlan (lint 0003)
-- Data: 2026-02-29
-- =============================================================================
--
-- Problema: auth.uid() e auth.role() chamados diretamente em políticas RLS
-- são reavaliados a cada linha, causando lentidão (initplan por linha).
--
-- Solução: Envolver em (SELECT auth.uid()) e (SELECT auth.role()) para que
-- o PostgreSQL avalie uma única vez e cacheie o resultado (initPlan por query).
--
-- Referência: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices
-- =============================================================================

-- ── users ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Super admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Super admin read all users" ON public.users;
CREATE POLICY "Super admin can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can insert users" ON public.users;
CREATE POLICY "Super admin can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can update users" ON public.users;
CREATE POLICY "Super admin can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'super_admin'
    )
  );


-- ── restaurants ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin can manage restaurants" ON public.restaurants;
CREATE POLICY "Super admin can manage restaurants"
  ON public.restaurants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can insert restaurants" ON public.restaurants;
CREATE POLICY "Super admin can insert restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can update restaurants" ON public.restaurants;
CREATE POLICY "Super admin can update restaurants"
  ON public.restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can delete restaurants" ON public.restaurants;
CREATE POLICY "Super admin can delete restaurants"
  ON public.restaurants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );


-- ── subscription_plans ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler planos" ON public.subscription_plans;
CREATE POLICY "Autenticados podem ler planos"
  ON public.subscription_plans FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Super admin gerencia planos" ON public.subscription_plans;
CREATE POLICY "Super admin gerencia planos"
  ON public.subscription_plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admin can update subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admin can update subscription plans"
  ON public.subscription_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can insert subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admin can insert subscription plans"
  ON public.subscription_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admin can delete subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admin can delete subscription plans"
  ON public.subscription_plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'super_admin'
    )
  );


-- ── features ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler features" ON public.features;
CREATE POLICY "Autenticados podem ler features"
  ON public.features FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Super admin gerencia features" ON public.features;
CREATE POLICY "Super admin gerencia features"
  ON public.features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );


-- ── plan_features ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados podem ler plan_features" ON public.plan_features;
CREATE POLICY "Autenticados podem ler plan_features"
  ON public.plan_features FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Super admin gerencia plan_features" ON public.plan_features;
CREATE POLICY "Super admin gerencia plan_features"
  ON public.plan_features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );


-- ── restaurant_subscriptions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurante lê própria assinatura" ON public.restaurant_subscriptions;
CREATE POLICY "Restaurante lê própria assinatura"
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

DROP POLICY IF EXISTS "Super admin gerencia assinaturas" ON public.restaurant_subscriptions;
CREATE POLICY "Super admin gerencia assinaturas"
  ON public.restaurant_subscriptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );


-- ── restaurant_feature_overrides ────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurante lê próprios overrides" ON public.restaurant_feature_overrides;
CREATE POLICY "Restaurante lê próprios overrides"
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

DROP POLICY IF EXISTS "Super admin gerencia overrides" ON public.restaurant_feature_overrides;
CREATE POLICY "Super admin gerencia overrides"
  ON public.restaurant_feature_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
  );


-- ── restaurant_user_roles ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Usuários lêem roles do próprio restaurante" ON public.restaurant_user_roles;
CREATE POLICY "Usuários lêem roles do próprio restaurante"
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

DROP POLICY IF EXISTS "Admin ou super_admin gerenciam roles" ON public.restaurant_user_roles;
CREATE POLICY "Admin ou super_admin gerenciam roles"
  ON public.restaurant_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = restaurant_user_roles.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );


-- ── orders ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant staff can read their orders" ON public.orders;
CREATE POLICY "Restaurant staff can read their orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.restaurant_id = orders.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can update their orders" ON public.orders;
CREATE POLICY "Restaurant staff can update their orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.restaurant_id = orders.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can delete their orders" ON public.orders;
CREATE POLICY "Restaurant staff can delete their orders"
  ON public.orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.restaurant_id = orders.restaurant_id
        OR users.role = 'super_admin'
      )
    )
  );


-- ── order_items ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant staff can read order items" ON public.order_items;
CREATE POLICY "Restaurant staff can read order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      JOIN public.orders ON orders.id = order_items.order_id
      WHERE users.id = (SELECT auth.uid())
      AND users.restaurant_id = orders.restaurant_id
    )
  );


-- ── products ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admin can manage products" ON public.products;
CREATE POLICY "Restaurant admin can manage products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.restaurant_id = products.restaurant_id
      AND users.role = 'restaurant_admin'
    )
  );


-- ── tables ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own tables" ON public.tables;
CREATE POLICY "Restaurant admins can manage own tables"
  ON public.tables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = tables.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );


-- ── waiter_calls ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own waiter_calls" ON public.waiter_calls;
CREATE POLICY "Restaurant admins can manage own waiter_calls"
  ON public.waiter_calls FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = waiter_calls.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );


-- ── categories ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own categories" ON public.categories;
CREATE POLICY "Restaurant admins can manage own categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = categories.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );


-- ── subcategories ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own subcategories" ON public.subcategories;
CREATE POLICY "Restaurant admins can manage own subcategories"
  ON public.subcategories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = subcategories.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );


-- ── comandas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own comandas" ON public.comandas;
CREATE POLICY "Restaurant admins can manage own comandas"
  ON public.comandas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = comandas.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );


-- ── comanda_items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Restaurant admins can manage own comanda_items" ON public.comanda_items;
CREATE POLICY "Restaurant admins can manage own comanda_items"
  ON public.comanda_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas
      JOIN public.users ON (
        (users.role = 'restaurant_admin' AND users.restaurant_id = comandas.restaurant_id)
        OR users.role = 'super_admin'
      )
      WHERE comandas.id = comanda_items.comanda_id
      AND users.id = (SELECT auth.uid())
    )
  );


-- ── marmita_sizes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin or super_admin manage marmita sizes" ON public.marmita_sizes;
CREATE POLICY "Admin or super_admin manage marmita sizes"
  ON public.marmita_sizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_sizes.restaurant_id)
      )
    )
  );


-- ── marmita_proteins ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin or super_admin manage marmita proteins" ON public.marmita_proteins;
CREATE POLICY "Admin or super_admin manage marmita proteins"
  ON public.marmita_proteins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_proteins.restaurant_id)
      )
    )
  );


-- ── marmita_sides ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin or super_admin manage marmita sides" ON public.marmita_sides;
CREATE POLICY "Admin or super_admin manage marmita sides"
  ON public.marmita_sides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_sides.restaurant_id)
      )
    )
  );


-- ── couriers ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin or super_admin read couriers" ON public.couriers;
DROP POLICY IF EXISTS "Restaurant staff can read their couriers" ON public.couriers;
CREATE POLICY "Admin or super_admin read couriers"
  ON public.couriers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admin or super_admin insert couriers" ON public.couriers;
DROP POLICY IF EXISTS "Restaurant staff can insert their couriers" ON public.couriers;
CREATE POLICY "Admin or super_admin insert couriers"
  ON public.couriers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admin or super_admin update couriers" ON public.couriers;
DROP POLICY IF EXISTS "Restaurant staff can update their couriers" ON public.couriers;
CREATE POLICY "Admin or super_admin update couriers"
  ON public.couriers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admin or super_admin delete couriers" ON public.couriers;
DROP POLICY IF EXISTS "Restaurant staff can delete their couriers" ON public.couriers;
CREATE POLICY "Admin or super_admin delete couriers"
  ON public.couriers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );


-- ── active_sessions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.active_sessions;
CREATE POLICY "Users can manage own sessions"
  ON public.active_sessions FOR ALL
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Super admin can view all sessions" ON public.active_sessions;
CREATE POLICY "Super admin can view all sessions"
  ON public.active_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'super_admin'
    )
  );


-- ── virtual_comandas ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff gerencia comandas do próprio restaurante" ON public.virtual_comandas;
CREATE POLICY "Staff gerencia comandas do próprio restaurante"
  ON public.virtual_comandas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
      AND (
        u.role = 'super_admin'
        OR (
          u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier')
          AND u.restaurant_id = virtual_comandas.restaurant_id
        )
      )
    )
  );


-- ── virtual_comanda_items ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff gerencia itens de comandas do próprio restaurante" ON public.virtual_comanda_items;
CREATE POLICY "Staff gerencia itens de comandas do próprio restaurante"
  ON public.virtual_comanda_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.virtual_comandas vc
      JOIN public.users u ON (
        u.role = 'super_admin'
        OR (
          u.role IN ('restaurant_admin', 'manager', 'waiter', 'cashier')
          AND u.restaurant_id = vc.restaurant_id
        )
      )
      WHERE vc.id = virtual_comanda_items.comanda_id
      AND u.id = (SELECT auth.uid())
    )
  );
