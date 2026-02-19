-- Migration: Sistema de Reordenação de Categorias
-- Data: 2026-02-17
-- Descrição: Adiciona tabela categories com order_index para permitir reordenação visual

-- 1. Criar tabela categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

-- 2. Índice composto para otimizar busca ordenada
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order 
  ON categories(restaurant_id, order_index);

-- 3. Índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_name 
  ON categories(restaurant_id, name);

-- 4. Função para obter próximo order_index ao criar categoria
CREATE OR REPLACE FUNCTION get_next_category_order_index(restaurant_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  next_index INTEGER;
BEGIN
  SELECT COALESCE(MAX(order_index), -1) + 1
  INTO next_index
  FROM categories
  WHERE restaurant_id = restaurant_uuid;
  
  RETURN next_index;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- 6. Migrar categorias existentes dos produtos para a tabela categories
-- Isso cria uma entrada na tabela categories para cada categoria única encontrada em products
INSERT INTO categories (restaurant_id, name, order_index)
WITH category_groups AS (
  SELECT 
    p.restaurant_id,
    p.category,
    MIN(p.created_at) AS first_created_at,
    CASE p.category
      WHEN 'Marmitas' THEN 0
      WHEN 'Pizza' THEN 1
      WHEN 'Massas' THEN 2
      WHEN 'Lanches' THEN 3
      WHEN 'Aperitivos' THEN 4
      WHEN 'Combos' THEN 5
      WHEN 'Sobremesas' THEN 6
      WHEN 'Bebidas' THEN 7
      ELSE 999
    END AS category_order
  FROM products p
  WHERE p.category IS NOT NULL
    AND p.category != ''
  GROUP BY p.restaurant_id, p.category
),
numbered_categories AS (
  SELECT 
    restaurant_id,
    category,
    ROW_NUMBER() OVER (
      PARTITION BY restaurant_id 
      ORDER BY category_order, first_created_at
    ) - 1 AS order_index
  FROM category_groups
)
SELECT 
  nc.restaurant_id,
  nc.category,
  nc.order_index
FROM numbered_categories nc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.restaurant_id = nc.restaurant_id 
  AND c.name = nc.category
)
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- 7. RLS Policies para categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Política para restaurantes admins gerenciarem suas próprias categorias
CREATE POLICY "Restaurant admins can manage own categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        (users.role = 'restaurant_admin' AND users.restaurant_id = categories.restaurant_id)
        OR users.role = 'super_admin'
      )
    )
  );

-- Política para leitura pública (cardápio)
CREATE POLICY "Public can read active restaurant categories"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = categories.restaurant_id
      AND restaurants.is_active = true
    )
  );

-- 8. Função auxiliar para atualizar order_index em lote
CREATE OR REPLACE FUNCTION update_categories_order(
  restaurant_uuid UUID,
  category_updates JSONB
)
RETURNS void AS $$
DECLARE
  update_item JSONB;
BEGIN
  -- category_updates deve ser um array de objetos: [{"id": "...", "order_index": 0}, ...]
  FOR update_item IN SELECT * FROM jsonb_array_elements(category_updates)
  LOOP
    UPDATE categories
    SET order_index = (update_item->>'order_index')::INTEGER,
        updated_at = NOW()
    WHERE id = (update_item->>'id')::UUID
      AND restaurant_id = restaurant_uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comentários para documentação
COMMENT ON TABLE categories IS 'Armazena as categorias de produtos com ordem personalizada por restaurante';
COMMENT ON COLUMN categories.order_index IS 'Índice de ordenação: menor número = aparece primeiro';
COMMENT ON FUNCTION get_next_category_order_index IS 'Retorna o próximo order_index disponível para um restaurante';
COMMENT ON FUNCTION update_categories_order IS 'Atualiza order_index de múltiplas categorias em uma única transação';
