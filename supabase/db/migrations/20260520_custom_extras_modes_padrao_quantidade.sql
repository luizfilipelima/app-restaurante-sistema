-- ─────────────────────────────────────────────────────────────────────────────
-- Modos de extras Custom: Padrão (seleção) e Quantidade (max por extra)
-- Padrão: Sem Extras + lista selecionável; min/max e obrigatório configuráveis
-- Quantidade: comportamento atual, max_quantity por extra
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. restaurants: config geral de extras do Custom
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_extras_mode VARCHAR(20) DEFAULT 'quantidade' CHECK (custom_extras_mode IN ('padrao', 'quantidade'));
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_extras_min INTEGER DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_extras_max INTEGER DEFAULT 5;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_extras_required BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN restaurants.custom_extras_mode IS 'padrao = Sem Extras + lista selecionável; quantidade = +/- com max por extra';
COMMENT ON COLUMN restaurants.custom_extras_min IS 'Quantidade mínima de extras selecionáveis (modo Padrão)';
COMMENT ON COLUMN restaurants.custom_extras_max IS 'Quantidade máxima de extras selecionáveis (modo Padrão)';
COMMENT ON COLUMN restaurants.custom_extras_required IS 'Se obrigatório, usuário deve selecionar ao menos custom_extras_min extras (modo Padrão)';

-- 2. pizza_extras: max_quantity para modo Quantidade
ALTER TABLE pizza_extras ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 10;

COMMENT ON COLUMN pizza_extras.max_quantity IS 'Quantidade máxima que o usuário pode adicionar deste extra (modo Quantidade)';
