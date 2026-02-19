-- ============================================================
-- Migração: Colunas para BI avançado
-- - products.cost_price: CMV (Custo de Mercadoria Vendida)
-- - orders.accepted_at, ready_at, delivered_at: fluxo operacional
-- ============================================================

-- 1. products: cost_price para cálculo de CMV
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN products.cost_price IS 'Custo do produto para cálculo de CMV (Custo de Mercadoria Vendida)';

-- Backfill: se price_cost existir, copiar para cost_price onde cost_price = 0
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'price_cost'
  ) THEN
    UPDATE products
    SET cost_price = COALESCE(price_cost, 0)
    WHERE cost_price = 0 AND (price_cost IS NOT NULL AND price_cost != 0);
  END IF;
END $$;

-- 2. orders: timestamps para monitorizar o fluxo operacional
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.accepted_at IS 'Momento em que o pedido foi aceite (ex: enviado para cozinha)';
COMMENT ON COLUMN orders.ready_at IS 'Momento em que o pedido ficou pronto na cozinha';
COMMENT ON COLUMN orders.delivered_at IS 'Momento em que o pedido foi entregue ao cliente';
