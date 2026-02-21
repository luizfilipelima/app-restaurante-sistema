-- Migration: products.card_layout — escolha de como o produto aparece no cardápio
-- Data: 2026-02-21
--
-- Valores: 'grid' = ProductCard padrão (vertical), 'beverage' = ProductCardBeverage (horizontal)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS card_layout text NOT NULL DEFAULT 'grid'
  CHECK (card_layout IN ('grid', 'beverage'));

COMMENT ON COLUMN public.products.card_layout IS 'Como o produto é exibido no cardápio público: grid = card vertical padrão, beverage = card horizontal (lista)';
