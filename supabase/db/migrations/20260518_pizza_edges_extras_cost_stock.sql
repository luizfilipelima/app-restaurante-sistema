-- ─────────────────────────────────────────────────────────────────────────────
-- pizza_edges: adicionar custo, controle de estoque e vínculo com ingrediente
-- pizza_extras: nova tabela para adicionais do modo Custom (Extras)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pizza_edges: novos campos
ALTER TABLE pizza_edges ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0;
ALTER TABLE pizza_edges ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(3) DEFAULT 'BRL';
ALTER TABLE pizza_edges ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pizza_edges ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pizza_edges_ingredient ON pizza_edges(ingredient_id);

-- 2. pizza_extras: adicionais do modo Custom
CREATE TABLE IF NOT EXISTS public.pizza_extras (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(120)  NOT NULL,
  price           INTEGER       NOT NULL DEFAULT 0,
  cost            INTEGER       DEFAULT 0,
  cost_currency   VARCHAR(3)    DEFAULT 'BRL',
  in_stock        BOOLEAN       NOT NULL DEFAULT FALSE,
  ingredient_id   UUID          REFERENCES public.ingredients(id) ON DELETE SET NULL,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  order_index     INTEGER       DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pizza_extras_restaurant ON pizza_extras(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pizza_extras_ingredient ON pizza_extras(ingredient_id);

-- RLS
ALTER TABLE public.pizza_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_extras_select" ON public.pizza_extras FOR SELECT
  USING (
    (SELECT current_user_can_admin_restaurant(pizza_extras.restaurant_id))
    OR true
  );
CREATE POLICY "pizza_extras_insert" ON public.pizza_extras FOR INSERT
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_extras.restaurant_id)));
CREATE POLICY "pizza_extras_update" ON public.pizza_extras FOR UPDATE
  USING ((SELECT current_user_can_admin_restaurant(pizza_extras.restaurant_id)))
  WITH CHECK ((SELECT current_user_can_admin_restaurant(pizza_extras.restaurant_id)));
CREATE POLICY "pizza_extras_delete" ON public.pizza_extras FOR DELETE
  USING ((SELECT current_user_can_admin_restaurant(pizza_extras.restaurant_id)));
