-- =============================================================================
-- Migration: restaurants — domínio personalizado (Enterprise)
-- Data: 2026-04-26
--
-- Permite restaurantes Enterprise usarem domínio próprio para o cardápio público.
-- Ex.: cardapio.minhapizzaria.com.br → resolve para o restaurante via slug.
-- =============================================================================

-- 1. Coluna custom_domain na tabela restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Índice único para lookup por hostname (apenas registros não nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_custom_domain
  ON public.restaurants (LOWER(TRIM(custom_domain)))
  WHERE custom_domain IS NOT NULL AND TRIM(custom_domain) != '';

COMMENT ON COLUMN public.restaurants.custom_domain IS
  'Domínio personalizado do restaurante (Enterprise). Ex: cardapio.minhapizzaria.com.br. Armazenar sempre em minúsculas.';

-- 2. Constraint: não permitir domínios reservados da plataforma
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS chk_restaurants_custom_domain_reserved;

ALTER TABLE public.restaurants
  ADD CONSTRAINT chk_restaurants_custom_domain_reserved
  CHECK (
    custom_domain IS NULL
    OR (
      LOWER(TRIM(custom_domain)) NOT IN (
        'quiero.food', 'www.quiero.food',
        'app.quiero.food', 'admin.quiero.food', 'kds.quiero.food',
        'localhost', 'www.localhost', 'app.localhost', 'admin.localhost', 'kds.localhost',
        '127.0.0.1'
      )
      AND LOWER(TRIM(custom_domain)) NOT LIKE '%.quiero.food'
      AND LOWER(TRIM(custom_domain)) NOT LIKE '%.localhost'
    )
  );
