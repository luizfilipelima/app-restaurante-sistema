-- =============================================================================
-- Migration: Índices para FKs sem índice (unindexed_foreign_keys)
-- Data: 2026-02-86
-- =============================================================================
--
-- Adiciona índices em colunas FK sem índice identificadas pelo linter do Supabase.
-- Melhora desempenho de JOINs, CASCADE e verificações de integridade referencial.
--
-- Baseado em: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
--
-- =============================================================================

-- ingredient_movements.product_id (FK: ingredient_movements_product_id_fkey)
CREATE INDEX IF NOT EXISTS idx_ingredient_movements_product_id
  ON public.ingredient_movements (product_id);

-- product_upsells.upsell_product_id (FK: product_upsells_upsell_product_id_fkey)
CREATE INDEX IF NOT EXISTS idx_product_upsells_upsell_product_id
  ON public.product_upsells (upsell_product_id);
