-- Migration: Categorias e Subcategorias editáveis pelo admin
-- Data: 2026-02-17
-- Descrição: Estende categories com config (is_pizza, is_marmita, extra), cria subcategories e product.subcategory_id

-- 1. Adicionar colunas de configuração em categories (para tipo Pizza, Marmita, labels extras)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_pizza BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_marmita BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS extra_field VARCHAR(50),
  ADD COLUMN IF NOT EXISTS extra_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS extra_placeholder VARCHAR(255);

-- 2. Preencher config das categorias existentes por nome (presets)
UPDATE categories SET is_pizza = FALSE, is_marmita = TRUE, extra_field = NULL, extra_label = NULL, extra_placeholder = NULL WHERE name = 'Marmitas';
UPDATE categories SET is_pizza = TRUE, is_marmita = FALSE, extra_field = NULL, extra_label = NULL, extra_placeholder = NULL WHERE name = 'Pizza';
UPDATE categories SET is_pizza = FALSE, is_marmita = FALSE, extra_field = 'volume', extra_label = 'Volume ou medida', extra_placeholder = 'Ex: 350ml, 1L, 2L' WHERE name = 'Bebidas';
UPDATE categories SET is_pizza = FALSE, is_marmita = FALSE, extra_field = 'portion', extra_label = 'Porção', extra_placeholder = 'Ex: individual, fatia, 500g' WHERE name = 'Sobremesas';
UPDATE categories SET is_pizza = FALSE, is_marmita = FALSE, extra_field = 'detail', extra_label = 'Detalhe do combo', extra_placeholder = 'Ex: Pizza + Refrigerante' WHERE name = 'Combos';
UPDATE categories SET is_pizza = FALSE, is_marmita = FALSE, extra_field = NULL, extra_label = NULL, extra_placeholder = NULL WHERE name IN ('Aperitivos', 'Massas', 'Lanches', 'Outros');

-- 3. Criar tabela subcategories
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_order ON subcategories(category_id, order_index);
CREATE INDEX IF NOT EXISTS idx_subcategories_restaurant ON subcategories(restaurant_id);

-- 4. Trigger updated_at para subcategories
CREATE OR REPLACE FUNCTION update_subcategories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW
  EXECUTE PROCEDURE update_subcategories_updated_at();

-- 5. Adicionar subcategory_id em products
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);

-- 6. RLS para subcategories
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant admins can manage own subcategories"
  ON subcategories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = subcategories.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

CREATE POLICY "Public can read active restaurant subcategories"
  ON subcategories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = subcategories.restaurant_id
      AND restaurants.is_active = true
    )
  );

COMMENT ON TABLE subcategories IS 'Subcategorias por categoria (ex: agrupamentos ou configurações como Pizza)';
COMMENT ON COLUMN categories.is_pizza IS 'Se true, produtos desta categoria usam fluxo de pizza (tamanhos, sabores, bordas)';
COMMENT ON COLUMN categories.is_marmita IS 'Se true, produtos desta categoria usam fluxo de marmita';
COMMENT ON COLUMN products.subcategory_id IS 'Subcategoria opcional do produto';
