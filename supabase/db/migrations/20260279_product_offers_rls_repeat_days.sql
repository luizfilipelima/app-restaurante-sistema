-- =============================================================================
-- Migration: product_offers — RLS para super_admin + coluna repeat_days
-- 1. Permite super_admin gerenciar ofertas (quando em contexto de restaurante)
-- 2. Adiciona repeat_days para ofertas recorrentes em dias da semana
-- =============================================================================

-- RLS: permitir super_admin além de staff do restaurante
DROP POLICY IF EXISTS "Restaurant staff can manage product_offers" ON public.product_offers;
CREATE POLICY "Restaurant staff can manage product_offers"
  ON public.product_offers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR u.restaurant_id = product_offers.restaurant_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR u.restaurant_id = product_offers.restaurant_id
      )
    )
  );

-- Coluna repeat_days: dias da semana em que a oferta repete (mon,tue,wed,thu,fri,sat,sun)
-- Quando NULL ou vazio = oferta única (usa starts_at/ends_at como período único)
ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS repeat_days TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.product_offers.repeat_days IS
  'Dias da semana para oferta recorrente: mon,tue,wed,thu,fri,sat,sun. NULL = oferta única.';
