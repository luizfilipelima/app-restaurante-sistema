-- ─────────────────────────────────────────────────────────────────────────────
-- Cambio Inteligente
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite ao proprietário:
--   1. Configurar cotações (ex: 1 BRL = X PYG, 1 BRL = Y ARS)
--   2. Definir moedas disponíveis no alternador de pagamento no checkout
--   3. Definir moeda do custo por produto (cardápio) e por item de estoque
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Restaurants: exchange_rates e payment_currencies ───────────────────────

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS exchange_rates JSONB DEFAULT '{"pyg_per_brl": 3600, "ars_per_brl": 1150}',
  ADD COLUMN IF NOT EXISTS payment_currencies TEXT[] DEFAULT ARRAY['BRL', 'PYG'];

COMMENT ON COLUMN public.restaurants.exchange_rates IS
  'Cotações por 1 BRL: pyg_per_brl, ars_per_brl. Ex: {"pyg_per_brl": 3600, "ars_per_brl": 1150}';
COMMENT ON COLUMN public.restaurants.payment_currencies IS
  'Moedas disponíveis no alternador do checkout. Ex: [''BRL'', ''PYG'']';

-- ── 2. Products: cost_currency ───────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'BRL'
    CHECK (cost_currency IS NULL OR cost_currency IN ('BRL', 'PYG', 'ARS'));

COMMENT ON COLUMN public.products.cost_currency IS
  'Moeda do custo (price_cost): BRL, PYG ou ARS. NULL usa moeda base do restaurante.';

-- ── 3. Inventory_items: cost_currency ────────────────────────────────────────

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'BRL'
    CHECK (cost_currency IS NULL OR cost_currency IN ('BRL', 'PYG', 'ARS'));

COMMENT ON COLUMN public.inventory_items.cost_currency IS
  'Moeda do custo (cost_price): BRL, PYG ou ARS. NULL usa moeda base do restaurante.';
