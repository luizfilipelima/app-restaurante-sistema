-- ============================================================
-- Otimização de Índices para Multi-tenant (restaurant_id)
-- ============================================================
-- Este script cria índices nas colunas restaurant_id das tabelas
-- principais para acelerar consultas filtradas por tenant.
-- Execute após o schema base. Usa IF NOT EXISTS para ser idempotente.
-- ============================================================

-- Restaurantes: lookup por ID (já tem PK)
-- Nenhum índice adicional necessário

-- Produtos: consultas por restaurante (cardápio, admin)
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_active ON products(restaurant_id, is_active);

-- Pedidos: consultas por restaurante e status (Kanban, BI)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);

-- Order items: lookup por order_id (já coberto por FK em muitos casos)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Mesas: consultas por restaurante
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);

-- Chamados de garçom: consultas por restaurante e status
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_status ON waiter_calls(restaurant_id, status);

-- Zonas de entrega
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant_id ON delivery_zones(restaurant_id);

-- Entregadores
CREATE INDEX IF NOT EXISTS idx_couriers_restaurant_id ON couriers(restaurant_id);

-- Categorias
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);

-- Comandas (buffet)
CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_id ON comandas(restaurant_id);

-- Usuários
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);
