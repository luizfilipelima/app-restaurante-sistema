-- =============================================================================
-- Migration: Modo Quilometragem para Delivery
-- Data: 2026-03-28
-- =============================================================================
-- Quando delivery_zones_mode = 'kilometers':
-- - restaurants: restaurant_lat, restaurant_lng (localização do restaurante no mapa)
-- - delivery_distance_tiers: faixas de preço por distância (km_min, km_max, fee)
-- O frete no checkout é calculado pela distância entre restaurante e endereço do cliente.
-- =============================================================================

-- 1. Colunas de localização do restaurante (usadas no modo quilometragem)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS restaurant_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS restaurant_lng NUMERIC;

COMMENT ON COLUMN public.restaurants.restaurant_lat IS 'Latitude do restaurante (modo quilometragem). Usada como origem do cálculo de distância.';
COMMENT ON COLUMN public.restaurants.restaurant_lng IS 'Longitude do restaurante (modo quilometragem). Usada como origem do cálculo de distância.';

-- Valores padrão por moeda (Tríplice Fronteira)
UPDATE public.restaurants r
SET
  restaurant_lat = CASE r.currency
    WHEN 'PYG' THEN -25.5097
    WHEN 'ARS' THEN -25.5991
    ELSE -25.5278
  END,
  restaurant_lng = CASE r.currency
    WHEN 'PYG' THEN -54.6111
    WHEN 'ARS' THEN -54.5735
    ELSE -54.5828
  END
WHERE r.restaurant_lat IS NULL
  AND r.delivery_zones_mode = 'kilometers';

UPDATE public.restaurants
SET restaurant_lat = -25.5278, restaurant_lng = -54.5828
WHERE restaurant_lat IS NULL AND delivery_zones_mode = 'kilometers';

-- 2. Tabela de faixas de preço por distância
CREATE TABLE IF NOT EXISTS public.delivery_distance_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  km_min NUMERIC(8, 2) NOT NULL CHECK (km_min >= 0),
  km_max NUMERIC(8, 2) CHECK (km_max IS NULL OR km_max > km_min),
  fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_distance_tiers IS 'Faixas de preço por distância (modo quilometragem). km_max NULL = acima de km_min. Ordenadas por km_min ASC.';
COMMENT ON COLUMN public.delivery_distance_tiers.km_min IS 'Início da faixa em km (0 = do restaurante)';
COMMENT ON COLUMN public.delivery_distance_tiers.km_max IS 'Fim da faixa em km. NULL = acima de km_min';
COMMENT ON COLUMN public.delivery_distance_tiers.fee IS 'Taxa de entrega em moeda base (centavos BRL, inteiro PYG, etc.)';

CREATE INDEX IF NOT EXISTS idx_delivery_distance_tiers_restaurant
  ON public.delivery_distance_tiers(restaurant_id);

-- RLS
ALTER TABLE public.delivery_distance_tiers ENABLE ROW LEVEL SECURITY;

-- Política: leitura pública (para checkout do cardápio)
CREATE POLICY "delivery_distance_tiers_select_public"
  ON public.delivery_distance_tiers
  FOR SELECT
  USING (true);

-- Política: insert/update/delete apenas por admins do restaurante (via service_role ou policies de restaurants)
DROP POLICY IF EXISTS "delivery_distance_tiers_insert_admin" ON public.delivery_distance_tiers;
CREATE POLICY "delivery_distance_tiers_insert_admin"
  ON public.delivery_distance_tiers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role = 'super_admin' OR (u.restaurant_id = delivery_distance_tiers.restaurant_id AND u.role IN ('owner', 'admin', 'manager')))
    )
  );

DROP POLICY IF EXISTS "delivery_distance_tiers_update_admin" ON public.delivery_distance_tiers;
CREATE POLICY "delivery_distance_tiers_update_admin"
  ON public.delivery_distance_tiers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role = 'super_admin' OR (u.restaurant_id = delivery_distance_tiers.restaurant_id AND u.role IN ('owner', 'admin', 'manager')))
    )
  );

DROP POLICY IF EXISTS "delivery_distance_tiers_delete_admin" ON public.delivery_distance_tiers;
CREATE POLICY "delivery_distance_tiers_delete_admin"
  ON public.delivery_distance_tiers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role = 'super_admin' OR (u.restaurant_id = delivery_distance_tiers.restaurant_id AND u.role IN ('owner', 'admin', 'manager')))
    )
  );
