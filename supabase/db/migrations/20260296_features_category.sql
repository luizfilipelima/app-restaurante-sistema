-- =============================================================================
-- Migration: Adicionar coluna category à tabela features
-- Data: 2026-02-21
--
-- Categorias para organização da UI no Super-Admin:
--   'Delivery & Logística'  — zonas, entregadores, pedidos delivery
--   'Salão & PDV'          — mesas, QR, chamada garçom, impressão
--   'Gestão & BI'          — dashboard, analytics, inventário, export
--   'Operação & Cozinha'   — KDS, cardápio admin, buffet, pedidos
--   'Marketing'            — cardápio público, cores, idiomas, marca
--   'Geral'                — configurações de sistema
-- =============================================================================

-- 1. Adicionar coluna category
ALTER TABLE features
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Geral';

COMMENT ON COLUMN features.category IS 'Categoria para agrupamento na UI do Super-Admin (tabs/accordion)';

-- 2. Classificar features existentes por módulo lógico
-- Mapeamento module -> category:
--   delivery, entregadores -> 'Delivery & Logística'
--   mesas                  -> 'Salão & PDV'
--   pedidos, cardapio_admin, buffet, cozinha -> 'Operação & Cozinha'
--   inventario, dashboard  -> 'Gestão & BI'
--   menu_publico           -> 'Marketing'
--   configuracoes          -> 'Geral'

UPDATE features SET category = 'Delivery & Logística'
WHERE module IN ('delivery', 'entregadores');

UPDATE features SET category = 'Salão & PDV'
WHERE module = 'mesas';

UPDATE features SET category = 'Operação & Cozinha'
WHERE module IN ('pedidos', 'cardapio_admin', 'buffet', 'cozinha');

UPDATE features SET category = 'Gestão & BI'
WHERE module IN ('inventario', 'dashboard');

UPDATE features SET category = 'Marketing'
WHERE module = 'menu_publico';

UPDATE features SET category = 'Geral'
WHERE module = 'configuracoes';

-- Garantir que nenhuma feature ficou sem categoria válida
UPDATE features
SET category = 'Geral'
WHERE category IS NULL OR category = '';
