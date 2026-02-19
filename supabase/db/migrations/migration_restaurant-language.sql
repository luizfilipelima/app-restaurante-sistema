-- Idioma da interface do cardápio (cliente final). Apenas UI; nomes de produtos/categorias não são traduzidos.
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt'
  CHECK (language IN ('pt', 'es'));

COMMENT ON COLUMN public.restaurants.language IS 'Idioma da interface do cardápio: pt (Português) ou es (Español).';
