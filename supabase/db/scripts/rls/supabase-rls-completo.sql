-- ============================================================
-- RLS COMPLETO - Permite admin e super_admin gerenciarem tudo
-- ============================================================
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- Resolve: "erro ao adicionar zonas de entrega", produtos, pizzas, etc.
-- ============================================================

-- Helper: condição para "é admin deste restaurante OU super_admin"
-- Para INSERT usamos WITH CHECK na linha nova (ex: products.restaurant_id)

-- ========== PRODUCTS ==========
DROP POLICY IF EXISTS "Restaurant admin can manage products" ON products;
DROP POLICY IF EXISTS "Restaurant admin or super_admin can manage products" ON products;
DROP POLICY IF EXISTS "Admin or super_admin manage products" ON products;

CREATE POLICY "Admin or super_admin manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = products.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== DELIVERY_ZONES ==========
DROP POLICY IF EXISTS "Restaurant admin or super_admin can manage delivery_zones" ON delivery_zones;
DROP POLICY IF EXISTS "Admin or super_admin manage delivery_zones" ON delivery_zones;
CREATE POLICY "Admin or super_admin manage delivery_zones"
  ON delivery_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = delivery_zones.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== PIZZA_SIZES ==========
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_sizes" ON pizza_sizes;
CREATE POLICY "Admin or super_admin manage pizza_sizes"
  ON pizza_sizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_sizes.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== PIZZA_FLAVORS ==========
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_flavors" ON pizza_flavors;
CREATE POLICY "Admin or super_admin manage pizza_flavors"
  ON pizza_flavors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_flavors.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== PIZZA_DOUGHS ==========
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_doughs" ON pizza_doughs;
CREATE POLICY "Admin or super_admin manage pizza_doughs"
  ON pizza_doughs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_doughs.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== PIZZA_EDGES ==========
DROP POLICY IF EXISTS "Admin or super_admin manage pizza_edges" ON pizza_edges;
CREATE POLICY "Admin or super_admin manage pizza_edges"
  ON pizza_edges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id)
            OR u.role = 'super_admin' )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( (u.role = 'restaurant_admin' AND u.restaurant_id = pizza_edges.restaurant_id)
            OR u.role = 'super_admin' )
    )
  );

-- ========== ORDERS (garantir INSERT público + super_admin) ==========
-- IMPORTANTE: Qualquer pessoa pode criar pedidos (sem autenticação)
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Staff e super_admin podem ler pedidos
DROP POLICY IF EXISTS "Restaurant staff can read their orders" ON orders;
DROP POLICY IF EXISTS "Restaurant staff or super_admin can read orders" ON orders;
DROP POLICY IF EXISTS "Staff or super_admin read orders" ON orders;
CREATE POLICY "Staff or super_admin read orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- Staff e super_admin podem atualizar pedidos
DROP POLICY IF EXISTS "Restaurant staff can update their orders" ON orders;
DROP POLICY IF EXISTS "Restaurant staff or super_admin can update orders" ON orders;
DROP POLICY IF EXISTS "Staff or super_admin update orders" ON orders;
CREATE POLICY "Staff or super_admin update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = orders.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- ========== ORDER_ITEMS (INSERT público + ler para staff e super_admin) ==========
-- IMPORTANTE: Qualquer pessoa pode criar itens de pedido (sem autenticação)
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- Staff e super_admin podem ler itens de pedido
DROP POLICY IF EXISTS "Restaurant staff can read order items" ON order_items;
DROP POLICY IF EXISTS "Restaurant staff or super_admin can read order items" ON order_items;
DROP POLICY IF EXISTS "Staff or super_admin read order items" ON order_items;
CREATE POLICY "Staff or super_admin read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN orders o ON o.id = order_items.order_id
      WHERE u.id = auth.uid()
      AND ( u.restaurant_id = o.restaurant_id OR u.role = 'super_admin' )
    )
  );

-- ========== RESTAURANTS (super_admin ler todos) ==========
DROP POLICY IF EXISTS "Super admin can read all restaurants" ON restaurants;
DROP POLICY IF EXISTS "Super admin read all restaurants" ON restaurants;
CREATE POLICY "Super admin read all restaurants"
  ON restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ========== USERS (políticas essenciais para login funcionar) ==========
-- IMPORTANTE: Cada usuário DEVE poder ler seu próprio perfil (obrigatório para login)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Super admin pode ler todos os usuários (lista na aba Usuários)
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
DROP POLICY IF EXISTS "Super admin read all users" ON users;
CREATE POLICY "Super admin can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ============================================================
-- Fim. Agora admin do restaurante e super_admin podem:
-- - Produtos: criar, editar, excluir
-- - Zonas de entrega: criar, editar, excluir
-- - Tamanhos/sabores/massas/bordas de pizza: criar, editar, excluir
-- - Pedidos: QUALQUER PESSOA pode criar (INSERT público), staff pode ler e atualizar
-- - Order Items: QUALQUER PESSOA pode criar (INSERT público), staff pode ler
-- - Usuários: cada usuário pode ler seu próprio perfil (login funciona)
-- - Super admin pode listar todos os usuários (para tela de usuários do restaurante)
-- ============================================================
