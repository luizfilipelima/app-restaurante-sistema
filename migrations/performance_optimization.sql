-- ============================================================
-- PERFORMANCE OPTIMIZATION
-- Índices em colunas de filtro por restaurante (tenant)
-- Otimizações de RLS para consultas BI
-- ============================================================
-- Execute após o schema e demais migrações. Idempotente (IF NOT EXISTS).
-- ============================================================

-- ========== ÍNDICES POR TABELA (restaurant_id) ==========

-- products: cardápio, admin, listagens
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_active ON products(restaurant_id, is_active);

-- orders: Kanban, BI, relatórios (filtros por restaurante + período)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_order_source ON orders(restaurant_id, order_source);

-- order_items: lookup por order (já via FK); índice para BI/agregações
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- tables: mesas por restaurante
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_active ON tables(restaurant_id, is_active);

-- waiter_calls: chamados por restaurante
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_status ON waiter_calls(restaurant_id, status);

-- delivery_zones
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant_id ON delivery_zones(restaurant_id);

-- couriers
CREATE INDEX IF NOT EXISTS idx_couriers_restaurant_id ON couriers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_couriers_restaurant_status ON couriers(restaurant_id, status) WHERE active = true;

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order ON categories(restaurant_id, order_index);

-- subcategories
CREATE INDEX IF NOT EXISTS idx_subcategories_restaurant_id ON subcategories(restaurant_id);

-- comandas (buffet)
CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_id ON comandas(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_status ON comandas(restaurant_id, status);

-- marmita_sizes, marmita_proteins, marmita_sides
CREATE INDEX IF NOT EXISTS idx_marmita_sizes_restaurant_id ON marmita_sizes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marmita_proteins_restaurant_id ON marmita_proteins(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marmita_sides_restaurant_id ON marmita_sides(restaurant_id);

-- users
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);

-- active_sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_restaurant_id ON active_sessions(restaurant_id);

-- pizza_* (schema base)
CREATE INDEX IF NOT EXISTS idx_pizza_sizes_restaurant_id ON pizza_sizes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pizza_flavors_restaurant_id ON pizza_flavors(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pizza_doughs_restaurant_id ON pizza_doughs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pizza_edges_restaurant_id ON pizza_edges(restaurant_id);

-- ========== ÍNDICE users(id) PARA RLS ==========
-- As políticas RLS fazem lookup em users por auth.uid().
-- O PK users(id) já é indexado; garantir que a consulta seja eficiente.
-- (Otimização implícita: PK = índice único em id)

-- ========== FUNÇÕES HELPER PARA RLS (reduz overhead em BI) ==========
-- As políticas atuais usam subquery EXISTS (SELECT 1 FROM users WHERE id = auth.uid() ...)
-- para cada linha. Funções STABLE são avaliadas uma vez por statement e cacheadas.
-- Isso reduz overhead em consultas grandes (ex: BI com milhares de pedidos).

CREATE OR REPLACE FUNCTION public.current_user_restaurant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin');
$$;

COMMENT ON FUNCTION public.current_user_restaurant_id() IS 'Restaurant ID do usuário logado. Usado em políticas RLS para evitar subquery por linha.';
COMMENT ON FUNCTION public.current_user_is_super_admin() IS 'True se usuário logado é super_admin. Usado em políticas RLS para evitar subquery por linha.';

-- ========== POLÍTICAS RLS OTIMIZADAS PARA orders (BI) ==========
-- Substituir as policies de orders que usam subquery por funções STABLE.
-- Execute apenas se quiser aplicar esta otimização (pode requerer DROP das policies atuais).

-- Exemplo de como as policies poderiam ser reescritas (COMENTADO - aplicar manualmente se desejar):
/*
DROP POLICY IF EXISTS "Staff or super_admin read orders" ON orders;
CREATE POLICY "Staff or super_admin read orders"
  ON orders FOR SELECT
  USING (
    orders.restaurant_id = current_user_restaurant_id()
    OR current_user_is_super_admin()
  );

DROP POLICY IF EXISTS "Staff or super_admin update orders" ON orders;
CREATE POLICY "Staff or super_admin update orders"
  ON orders FOR UPDATE
  USING (
    orders.restaurant_id = current_user_restaurant_id()
    OR current_user_is_super_admin()
  );
*/

-- ========== ANÁLISE DE RLS (recomendações) ==========
-- 1. orders / order_items: políticas com EXISTS(subquery users) são executadas por linha.
--    Com current_user_restaurant_id() e current_user_is_super_admin() (STABLE),
--    o PostgreSQL avalia uma vez e reutiliza o resultado.
-- 2. Índice users(id) já existe (PK); lookup por auth.uid() é O(1).
-- 3. Para BI com .range() e filtros em restaurant_id + created_at, os índices
--    idx_orders_restaurant_created_at e idx_orders_restaurant_id aceleram o scan.
-- 4. Evite SELECT * em consultas BI; use colunas específicas.
--    Ex: Dashboard loadMetrics: select('id, total, status, created_at, order_source, delivery_type, delivery_zone_id, payment_method')
--    em vez de select('*') para reduzir payload e I/O.
