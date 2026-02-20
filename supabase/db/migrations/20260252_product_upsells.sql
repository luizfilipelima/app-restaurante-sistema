-- =====================================================
-- Migração: Tabela product_upsells (Sugestões de Upsell)
-- Relaciona produtos a até 3 sugestões complementares.
-- Também adiciona `is_upsell` em order_items para BI.
-- =====================================================

CREATE TABLE IF NOT EXISTS product_upsells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  upsell_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_upsells_unique UNIQUE (product_id, upsell_product_id),
  CONSTRAINT no_self_upsell CHECK (product_id <> upsell_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_upsells_product ON product_upsells(product_id);
CREATE INDEX IF NOT EXISTS idx_product_upsells_restaurant ON product_upsells(restaurant_id);

COMMENT ON TABLE product_upsells IS 'Sugestões de upsell por produto (máx. 3 por produto)';

-- RLS: segue o mesmo padrão dos outros objetos do restaurante
ALTER TABLE product_upsells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant staff can manage product_upsells" ON product_upsells;
CREATE POLICY "Restaurant staff can manage product_upsells"
  ON product_upsells FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = product_upsells.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = product_upsells.restaurant_id
    )
  );

-- Leitura pública (anon) para exibir sugestões no cardápio
DROP POLICY IF EXISTS "Public can read product_upsells" ON product_upsells;
CREATE POLICY "Public can read product_upsells"
  ON product_upsells FOR SELECT
  USING (true);

-- Rastreio de upsell nos itens de pedido
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_upsell BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN order_items.is_upsell IS 'Item adicionado via sugestão de upsell no carrinho';

SELECT 'Migração product_upsells aplicada.' AS mensagem;
