-- Adiciona print_destination por produto (Cozinha / Bar)
-- Os produtos passam a ter destino de impressão individual,
-- independente da categoria.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS print_destination text
    DEFAULT 'kitchen'
    CHECK (print_destination IN ('kitchen', 'bar'));

-- Herda o destino da categoria para produtos existentes
UPDATE public.products p
SET print_destination = COALESCE(
  (SELECT c.print_destination
   FROM public.categories c
   WHERE c.restaurant_id = p.restaurant_id
     AND c.name = p.category
   LIMIT 1),
  'kitchen'
)
WHERE print_destination IS NULL OR print_destination = 'kitchen';

COMMENT ON COLUMN public.products.print_destination IS
  'Destino de impressão do cupom: kitchen = Cozinha Central, bar = Garçom/Bar';
