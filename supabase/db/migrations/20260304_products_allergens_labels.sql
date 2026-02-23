-- Migration: Alérgenos e etiquetas em produtos
-- Data: 2026-02-23
-- Descrição: Adiciona allergens e labels para exibição no cardápio (clientes com restrições)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';

COMMENT ON COLUMN products.allergens IS 'IDs dos alérgenos: gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs';
COMMENT ON COLUMN products.labels IS 'IDs das etiquetas: vegetarian, vegan, spicy, gluten_free, organic';
