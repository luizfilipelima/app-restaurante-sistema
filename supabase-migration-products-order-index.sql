-- ============================================================
-- Migração: order_index na tabela products para reordenação
-- ============================================================
-- Novos produtos recebem o próximo índice disponível dentro da categoria
-- (restaurant_id + category, não category_id - products usam category como texto)
-- ============================================================

-- 1. Adicionar coluna order_index
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.order_index IS 'Ordem de exibição dentro da categoria (0-based). Usado no admin e no cardápio público.';

-- 2. Inicializar order_index para produtos existentes (por restaurante + categoria)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY restaurant_id, category ORDER BY created_at, name) - 1 AS rn
  FROM public.products
)
UPDATE public.products p
SET order_index = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

-- 3. Função: retorna o próximo order_index para (restaurant_id, category)
CREATE OR REPLACE FUNCTION public.get_next_product_order_index(
  p_restaurant_id uuid,
  p_category text
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(order_index), -1) + 1
  FROM public.products
  WHERE restaurant_id = p_restaurant_id AND category = p_category;
$$;

COMMENT ON FUNCTION public.get_next_product_order_index(uuid, text) IS 'Retorna o próximo order_index disponível para um novo produto na categoria.';

-- 4. Índice para carregamento rápido por categoria e ordem
CREATE INDEX IF NOT EXISTS idx_products_restaurant_category_order
ON public.products (restaurant_id, category, order_index);
