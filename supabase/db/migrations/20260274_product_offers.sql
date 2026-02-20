-- =============================================================================
-- Migration: Ofertas de produtos — product_offers
-- Permite ofertas imediatas e pré-agendadas por data
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  offer_price INTEGER NOT NULL,
  original_price INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_offers_valid_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_product_offers_restaurant_active_dates
  ON public.product_offers(restaurant_id, is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_product_offers_product
  ON public.product_offers(product_id);

COMMENT ON TABLE public.product_offers IS 'Ofertas de produtos e combos — imediatas ou pré-agendadas por período';

-- RLS
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant staff can manage product_offers" ON public.product_offers;
CREATE POLICY "Restaurant staff can manage product_offers"
  ON public.product_offers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.restaurant_id = product_offers.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.restaurant_id = product_offers.restaurant_id
    )
  );

DROP POLICY IF EXISTS "Public can read active product_offers" ON public.product_offers;
CREATE POLICY "Public can read active product_offers"
  ON public.product_offers FOR SELECT
  USING (
    product_offers.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.products p ON p.restaurant_id = r.id AND p.id = product_offers.product_id
      WHERE r.id = product_offers.restaurant_id AND r.is_active = true AND p.is_active = true
    )
  );
