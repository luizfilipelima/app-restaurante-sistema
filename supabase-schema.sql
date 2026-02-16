-- =====================================================
-- SCHEMA DO BANCO DE DADOS - SISTEMA DE RESTAURANTES
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: restaurants
-- Armazena os dados dos restaurantes (tenants)
-- =====================================================
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  logo TEXT,
  phone VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  primary_color VARCHAR(7) DEFAULT '#000000',
  secondary_color VARCHAR(7) DEFAULT '#ffffff',
  is_active BOOLEAN DEFAULT TRUE,
  opening_hours JSONB DEFAULT '{}',
  is_manually_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: users
-- Usuários do sistema com controle de roles
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'restaurant_admin', 'kitchen')),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: products
-- Produtos do cardápio
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_pizza BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: pizza_sizes
-- Tamanhos de pizza disponíveis
-- =====================================================
CREATE TABLE pizza_sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  max_flavors INTEGER NOT NULL DEFAULT 1,
  price_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: pizza_flavors
-- Sabores de pizza disponíveis
-- =====================================================
CREATE TABLE pizza_flavors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: pizza_doughs
-- Tipos de massa disponíveis
-- =====================================================
CREATE TABLE pizza_doughs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  extra_price DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: pizza_edges
-- Bordas recheadas disponíveis
-- =====================================================
CREATE TABLE pizza_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: delivery_zones
-- Zonas de entrega com taxas
-- =====================================================
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  location_name VARCHAR(255) NOT NULL,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: orders
-- Pedidos dos clientes
-- =====================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
  delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
  delivery_address TEXT,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('pix', 'card', 'cash')),
  payment_change_for DECIMAL(10, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivering', 'completed')),
  notes TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: order_items
-- Itens dos pedidos
-- =====================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  observations TEXT,
  pizza_size VARCHAR(100),
  pizza_flavors TEXT[],
  pizza_dough VARCHAR(100),
  pizza_edge VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA MELHOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_products_restaurant ON products(restaurant_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_users_restaurant ON users(restaurant_id);
CREATE INDEX idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);
CREATE INDEX idx_pizza_sizes_restaurant ON pizza_sizes(restaurant_id);
CREATE INDEX idx_pizza_flavors_restaurant ON pizza_flavors(restaurant_id);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Importante: Configure conforme necessário
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Usuário pode ler o próprio perfil (necessário para o login funcionar)
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_flavors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_doughs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajuste conforme necessário)

-- Restaurants: público pode ler, apenas super_admin pode modificar
CREATE POLICY "Public can read active restaurants"
  ON restaurants FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admin can manage restaurants"
  ON restaurants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Products: público pode ler produtos ativos
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restaurant admin can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = products.restaurant_id
      AND users.role = 'restaurant_admin'
    )
  );

-- Pizza data: público pode ler
CREATE POLICY "Public can read pizza sizes"
  ON pizza_sizes FOR SELECT
  USING (true);

CREATE POLICY "Public can read pizza flavors"
  ON pizza_flavors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read pizza doughs"
  ON pizza_doughs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read pizza edges"
  ON pizza_edges FOR SELECT
  USING (is_active = true);

-- Delivery zones: público pode ler zonas ativas
CREATE POLICY "Public can read active delivery zones"
  ON delivery_zones FOR SELECT
  USING (is_active = true);

-- Orders: qualquer um pode criar, apenas do restaurante pode gerenciar
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Restaurant staff can read their orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = orders.restaurant_id
    )
  );

CREATE POLICY "Restaurant staff can update their orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = orders.restaurant_id
    )
  );

-- Order items: vinculado às policies de orders
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Restaurant staff can read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN orders ON orders.id = order_items.order_id
      WHERE users.id = auth.uid()
      AND users.restaurant_id = orders.restaurant_id
    )
  );

-- =====================================================
-- FUNÇÃO PARA CRIAR PRIMEIRO SUPER ADMIN
-- Execute após criar seu usuário no Supabase Auth
-- =====================================================

-- Exemplo de uso:
-- SELECT create_super_admin('seu-email@exemplo.com', 'seu-user-id-do-auth');

CREATE OR REPLACE FUNCTION create_super_admin(
  user_email VARCHAR,
  user_id UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (id, email, role)
  VALUES (user_id, user_email, 'super_admin')
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- =====================================================

-- Após criar o schema, você pode adicionar dados de exemplo
-- executando estas queries manualmente

/*
-- Criar um restaurante de exemplo
INSERT INTO restaurants (name, slug, phone, whatsapp, is_active)
VALUES ('Pizzaria Exemplo', 'pizzaria-exemplo', '11999999999', '11999999999', true);

-- Obter o ID do restaurante criado
-- Use este ID para criar os dados abaixo

-- Criar tamanhos de pizza
INSERT INTO pizza_sizes (restaurant_id, name, max_flavors, price_multiplier, order_index)
VALUES 
  ('ID_DO_RESTAURANTE', 'Pequena', 1, 1.0, 1),
  ('ID_DO_RESTAURANTE', 'Média', 2, 1.5, 2),
  ('ID_DO_RESTAURANTE', 'Grande', 3, 2.0, 3);

-- Criar sabores de pizza
INSERT INTO pizza_flavors (restaurant_id, name, price, is_active)
VALUES 
  ('ID_DO_RESTAURANTE', 'Margherita', 35.00, true),
  ('ID_DO_RESTAURANTE', 'Calabresa', 38.00, true),
  ('ID_DO_RESTAURANTE', 'Portuguesa', 42.00, true);

-- Criar tipos de massa
INSERT INTO pizza_doughs (restaurant_id, name, extra_price, is_active)
VALUES 
  ('ID_DO_RESTAURANTE', 'Tradicional', 0, true),
  ('ID_DO_RESTAURANTE', 'Integral', 5.00, true);

-- Criar bordas
INSERT INTO pizza_edges (restaurant_id, name, price, is_active)
VALUES 
  ('ID_DO_RESTAURANTE', 'Catupiry', 8.00, true),
  ('ID_DO_RESTAURANTE', 'Cheddar', 8.00, true);

-- Criar zonas de entrega
INSERT INTO delivery_zones (restaurant_id, location_name, fee, is_active)
VALUES 
  ('ID_DO_RESTAURANTE', 'Centro', 0, true),
  ('ID_DO_RESTAURANTE', 'Bairro Alto', 5.00, true);
*/
