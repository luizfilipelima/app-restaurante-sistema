-- =============================================================================
-- Migration: delivery_zones — modelo visual baseado em raio (center_lat, center_lng, radius_meters)
-- Data: 2026-02-21
-- =============================================================================
--
-- Evolução das Zonas de Entrega de "nome do bairro" para um modelo visual:
-- - center_lat, center_lng: coordenadas do centro da zona no mapa
-- - radius_meters: raio de alcance em metros (ex: 2000 = 2 km)
--
-- Zonas já existentes recebem valores padrão baseados na moeda do restaurante
-- (Tríplice Fronteira: Foz, Ciudad del Este, Puerto Iguazú).
-- =============================================================================

-- Adicionar colunas de coordenadas e raio
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS center_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS center_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 2000;

-- Valores padrão para zonas existentes (sem coordenadas):
-- BRL → Foz do Iguaçu (-25.5278, -54.5828)
-- PYG → Ciudad del Este (-25.5097, -54.6111)
-- ARS → Puerto Iguazú (-25.5991, -54.5735)
-- USD/outros → Foz do Iguaçu
UPDATE public.delivery_zones dz
SET
  center_lat = CASE r.currency
    WHEN 'PYG' THEN -25.5097
    WHEN 'ARS' THEN -25.5991
    ELSE -25.5278
  END,
  center_lng = CASE r.currency
    WHEN 'PYG' THEN -54.6111
    WHEN 'ARS' THEN -54.5735
    ELSE -54.5828
  END,
  radius_meters = COALESCE(dz.radius_meters, 2000)
FROM public.restaurants r
WHERE dz.restaurant_id = r.id
  AND dz.center_lat IS NULL;

-- Para restaurantes sem moeda definida ou fora do join, usar Foz
UPDATE public.delivery_zones
SET
  center_lat = -25.5278,
  center_lng = -54.5828,
  radius_meters = COALESCE(radius_meters, 2000)
WHERE center_lat IS NULL;

-- Garantir NOT NULL após migração (zonas novas devem ter valores)
ALTER TABLE public.delivery_zones
  ALTER COLUMN center_lat SET DEFAULT -25.5278,
  ALTER COLUMN center_lng SET DEFAULT -54.5828,
  ALTER COLUMN radius_meters SET DEFAULT 2000;
