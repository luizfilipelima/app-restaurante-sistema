-- ─────────────────────────────────────────────────────────────────────────────
-- Modos Padrão e Quantidade para adicionais normais (product_addon_groups/items)
-- Padrão: Sem Extras + lista selecionável; min/max/obrigatório
-- Quantidade: +/- com max_quantity por item
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. product_addon_groups: modo e config do Padrão
ALTER TABLE product_addon_groups ADD COLUMN IF NOT EXISTS addon_mode VARCHAR(20) DEFAULT 'quantidade' CHECK (addon_mode IN ('padrao', 'quantidade'));
ALTER TABLE product_addon_groups ADD COLUMN IF NOT EXISTS addon_min INTEGER DEFAULT 0;
ALTER TABLE product_addon_groups ADD COLUMN IF NOT EXISTS addon_max INTEGER DEFAULT 5;
ALTER TABLE product_addon_groups ADD COLUMN IF NOT EXISTS addon_required BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN product_addon_groups.addon_mode IS 'padrao = Sem Extras + lista selecionável; quantidade = +/- com max por item';
COMMENT ON COLUMN product_addon_groups.addon_min IS 'Quantidade mínima selecionável (modo Padrão)';
COMMENT ON COLUMN product_addon_groups.addon_max IS 'Quantidade máxima selecionável (modo Padrão)';
COMMENT ON COLUMN product_addon_groups.addon_required IS 'Obrigatório selecionar ao menos addon_min (modo Padrão)';

-- 2. product_addon_items: max_quantity para modo Quantidade
ALTER TABLE product_addon_items ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 10;

COMMENT ON COLUMN product_addon_items.max_quantity IS 'Quantidade máxima que o usuário pode adicionar (modo Quantidade)';
