-- =====================================================
-- Migração: Destino de Impressão por Categoria
-- Adiciona print_destination em categories
-- 'kitchen' = Cozinha Central | 'bar' = Garçom/Bar
-- =====================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS print_destination TEXT NOT NULL DEFAULT 'kitchen'
    CHECK (print_destination IN ('kitchen', 'bar'));

COMMENT ON COLUMN categories.print_destination IS
  'Destino de impressão do cupom: kitchen = Cozinha Central | bar = Garçom/Bar';

SELECT 'Migração print_destination em categories aplicada.' AS mensagem;
