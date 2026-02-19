-- Migration: Sistema de Gestão de Comandas para Buffet
-- Data: 2026-02-17

-- 1. Atualizar tabela products para suportar buffet
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS price_sale DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS price_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS is_by_weight BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sku TEXT;

-- Atualizar produtos existentes: se não tiver price_sale, usar price
UPDATE products 
SET price_sale = price 
WHERE price_sale IS NULL;

-- 2. Criar tabela comandas
CREATE TABLE IF NOT EXISTS comandas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  total_amount DECIMAL(10,2) DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, number)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_status ON comandas(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_comandas_number ON comandas(number);
CREATE INDEX IF NOT EXISTS idx_comandas_opened_at ON comandas(opened_at);

-- 3. Criar tabela comanda_items
CREATE TABLE IF NOT EXISTS comanda_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  is_pending_sync BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda ON comanda_items(comanda_id);
CREATE INDEX IF NOT EXISTS idx_comanda_items_pending_sync ON comanda_items(is_pending_sync) WHERE is_pending_sync = true;

-- 4. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comandas_updated_at
  BEFORE UPDATE ON comandas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comanda_items_updated_at
  BEFORE UPDATE ON comanda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Função para calcular total da comanda
CREATE OR REPLACE FUNCTION calculate_comanda_total(comanda_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_price) FROM comanda_items WHERE comanda_id = comanda_uuid),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para atualizar total_amount da comanda
CREATE OR REPLACE FUNCTION update_comanda_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE comandas
  SET total_amount = calculate_comanda_total(COALESCE(NEW.comanda_id, OLD.comanda_id)),
      last_sync = NOW()
  WHERE id = COALESCE(NEW.comanda_id, OLD.comanda_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comanda_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON comanda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_comanda_total();

-- 7. RLS Policies para comandas
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_items ENABLE ROW LEVEL SECURITY;

-- Políticas para comandas
CREATE POLICY "Restaurant admins can manage own comandas"
  ON comandas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'restaurant_admin'
        AND users.restaurant_id = comandas.restaurant_id
      )
      OR users.role = 'super_admin'
    )
  );

-- Políticas para comanda_items
CREATE POLICY "Restaurant admins can manage own comanda_items"
  ON comanda_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM comandas
      JOIN users ON (
        (users.role = 'restaurant_admin' AND users.restaurant_id = comandas.restaurant_id)
        OR users.role = 'super_admin'
      )
      WHERE comandas.id = comanda_items.comanda_id
      AND users.id = auth.uid()
    )
  );

-- Política pública para inserção (permite operação offline)
CREATE POLICY "Public can insert comandas for active restaurants"
  ON comandas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = comandas.restaurant_id
      AND restaurants.is_active = true
    )
  );

CREATE POLICY "Public can insert comanda_items for open comandas"
  ON comanda_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comandas
      WHERE comandas.id = comanda_items.comanda_id
      AND comandas.status = 'open'
    )
  );

-- 8. Função para obter próximo número de comanda
CREATE OR REPLACE FUNCTION get_next_comanda_number(restaurant_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1
  INTO next_number
  FROM comandas
  WHERE restaurant_id = restaurant_uuid;
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;
