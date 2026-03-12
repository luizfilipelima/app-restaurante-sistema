-- ─────────────────────────────────────────────────────────────────────────────
-- Config por produto Custom: quais tamanhos, massas, bordas e extras se aplicam
-- Null ou arrays vazios = usa todos do Configuração Custom
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_config JSONB DEFAULT NULL;

COMMENT ON COLUMN products.custom_config IS 'Para produtos Custom: { sizeIds, doughIds, edgeIds, extraIds }. Null/vazio = usa todos da config global';
