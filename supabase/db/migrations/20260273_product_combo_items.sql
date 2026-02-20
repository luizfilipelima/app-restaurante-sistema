-- =============================================================================
-- Migration: Combos inteligentes — product_combo_items
-- Permite compor um produto combo a partir de produtos existentes do cardápio
-- =============================================================================

-- 1. Coluna em products para marcar combo
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_combo IS 'Se true, produto é um combo; composição em product_combo_items';

-- 2. Tabela de composição do combo
CREATE TABLE IF NOT EXISTS public.product_combo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(10, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_combo_no_self CHECK (combo_product_id <> product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_combo_unique
  ON public.product_combo_items(combo_product_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_combo_items_combo
  ON public.product_combo_items(combo_product_id);

CREATE INDEX IF NOT EXISTS idx_product_combo_items_product
  ON public.product_combo_items(product_id);

COMMENT ON TABLE public.product_combo_items IS
  'Itens que compõem um combo. combo_product_id = produto combo; product_id = item incluído.';

-- 3. RLS
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant staff can manage product_combo_items" ON public.product_combo_items;
CREATE POLICY "Restaurant staff can manage product_combo_items"
  ON public.product_combo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid() AND u.restaurant_id = p.restaurant_id
      WHERE p.id = product_combo_items.combo_product_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid() AND u.restaurant_id = p.restaurant_id
      WHERE p.id = product_combo_items.combo_product_id
    )
  );

DROP POLICY IF EXISTS "Public can read product_combo_items" ON public.product_combo_items;
CREATE POLICY "Public can read product_combo_items"
  ON public.product_combo_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true
      WHERE p.id = product_combo_items.combo_product_id AND p.is_active = true
    )
  );
