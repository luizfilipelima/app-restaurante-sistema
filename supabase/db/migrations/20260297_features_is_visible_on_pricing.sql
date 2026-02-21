-- =============================================================================
-- Migration: Separar features Motor (técnicas) vs Vitrine (comerciais)
-- Data: 2026-02-21
--
-- Adiciona is_visible_on_pricing para ocultar features de base do sistema
-- na UI de Planos e na aba de Assinatura do Super-Admin.
-- Features ocultas permanecem em plan_features para validação (FeatureGuard).
-- =============================================================================

-- 1. Adicionar coluna is_visible_on_pricing
ALTER TABLE features
ADD COLUMN IF NOT EXISTS is_visible_on_pricing BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN features.is_visible_on_pricing IS 'Se false, não exibe na UI de Planos/Preços (Motor); permanece em plan_features para FeatureGuard';

-- 2. Ocultar features que são obrigações de base do sistema (Motor)
-- Exemplos: CRUD básico, atualizar status, cancelar, ativar/desativar, realtime, etc.
UPDATE features
SET is_visible_on_pricing = false
WHERE flag IN (
  -- Cardápio admin — CRUD e operações básicas
  'feature_product_management',   -- CRUD Básico de Produtos
  'feature_product_toggle',       -- Ativar/Desativar Produto
  'feature_categories',           -- Gerenciamento de Categorias
  -- Pedidos — operações core
  'feature_order_status_update',  -- Atualizar Status de Pedido
  'feature_order_cancel',         -- Cancelar Pedido
  -- Cozinha — infra
  'feature_realtime_orders',      -- Atualização em Tempo Real
  -- Configurações base
  'feature_settings_basic',       -- Configurações Básicas
  -- Cardápio público — variante técnica
  'feature_menu_view_only'        -- Cardápio Somente Leitura
);
