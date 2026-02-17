-- =====================================================
-- MIGRAÇÃO: Sistema de Marmitas
-- Cria tabelas e estrutura para configuração de marmitas
-- =====================================================

-- Adicionar campo is_marmita na tabela products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_marmita BOOLEAN DEFAULT FALSE;

-- =====================================================
-- TABELA: marmita_sizes
-- Tamanhos/pesos de marmita disponíveis
-- =====================================================
CREATE TABLE IF NOT EXISTS marmita_sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  weight_grams INTEGER NOT NULL, -- Peso em gramas (ex: 300g, 500g, 700g)
  base_price DECIMAL(10, 2) NOT NULL, -- Preço base por grama ou fixo
  price_per_gram DECIMAL(10, 4) DEFAULT 0, -- Preço por grama (opcional)
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: marmita_proteins
-- Proteínas disponíveis para marmitas
-- =====================================================
CREATE TABLE IF NOT EXISTS marmita_proteins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_per_gram DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Preço por grama da proteína
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: marmita_sides
-- Acompanhamentos disponíveis para marmitas
-- =====================================================
CREATE TABLE IF NOT EXISTS marmita_sides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_per_gram DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Preço por grama do acompanhamento
  category VARCHAR(100), -- Ex: 'arroz', 'feijao', 'salada', 'legumes'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_marmita_sizes_restaurant ON marmita_sizes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marmita_sizes_active ON marmita_sizes(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_marmita_proteins_restaurant ON marmita_proteins(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marmita_proteins_active ON marmita_proteins(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_marmita_sides_restaurant ON marmita_sides(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marmita_sides_active ON marmita_sides(restaurant_id, is_active);

-- =====================================================
-- RLS (Row Level Security) para marmitas
-- =====================================================

-- Habilitar RLS
ALTER TABLE marmita_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marmita_proteins ENABLE ROW LEVEL SECURITY;
ALTER TABLE marmita_sides ENABLE ROW LEVEL SECURITY;

-- Políticas para marmita_sizes
CREATE POLICY "Public can read active marmita sizes"
  ON marmita_sizes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin or super_admin manage marmita sizes"
  ON marmita_sizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_sizes.restaurant_id)
      )
    )
  );

-- Políticas para marmita_proteins
CREATE POLICY "Public can read active marmita proteins"
  ON marmita_proteins FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin or super_admin manage marmita proteins"
  ON marmita_proteins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_proteins.restaurant_id)
      )
    )
  );

-- Políticas para marmita_sides
CREATE POLICY "Public can read active marmita sides"
  ON marmita_sides FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin or super_admin manage marmita sides"
  ON marmita_sides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'
        OR (users.role = 'restaurant_admin' AND users.restaurant_id = marmita_sides.restaurant_id)
      )
    )
  );
