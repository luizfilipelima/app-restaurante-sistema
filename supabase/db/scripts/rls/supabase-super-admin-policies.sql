-- ============================================================
-- POLÍTICAS RLS: Super Admin pode gerenciar qualquer restaurante
-- ============================================================
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

-- Products: super_admin pode tudo
DROP POLICY IF EXISTS "Restaurant admin can manage products" ON products;
CREATE POLICY "Restaurant admin or super_admin can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = products.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Delivery zones: admin e super_admin podem gerenciar (ler ativos já é público)
CREATE POLICY "Restaurant admin or super_admin can manage delivery_zones"
  ON delivery_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = delivery_zones.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Orders: super_admin pode ler e atualizar qualquer pedido
DROP POLICY IF EXISTS "Restaurant staff can read their orders" ON orders;
CREATE POLICY "Restaurant staff or super_admin can read orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.restaurant_id = orders.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Restaurant staff can update their orders" ON orders;
CREATE POLICY "Restaurant staff or super_admin can update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.restaurant_id = orders.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Order items: super_admin pode ler
DROP POLICY IF EXISTS "Restaurant staff can read order items" ON order_items;
CREATE POLICY "Restaurant staff or super_admin can read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN orders ON orders.id = order_items.order_id
      WHERE users.id = auth.uid()
      AND (
        (users.restaurant_id = orders.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Restaurants: super_admin pode ler todos (incluindo inativos) para gerenciar
CREATE POLICY "Super admin can read all restaurants"
  ON restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================================
-- Pronto. Super admin pode gerenciar qualquer restaurante.
-- ============================================================
