-- Migration: Imagem em categorias + modo de exibição do cardápio
-- Data: 2026-02-22
-- Descrição: Adiciona image_url em categories e menu_display_mode em restaurants

-- 1. Imagem em categorias (mesmo padrão de products)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN categories.image_url IS 'URL da imagem da categoria (bucket product-images)';

-- 2. Modo de exibição do cardápio: default (pills + produtos) | categories_first (cards de categorias primeiro)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS menu_display_mode TEXT NOT NULL DEFAULT 'default'
  CHECK (menu_display_mode IN ('default', 'categories_first'));

COMMENT ON COLUMN restaurants.menu_display_mode IS 'Modo de exibição: default = pills + lista | categories_first = cards de categorias como primeira tela';
