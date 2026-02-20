-- ─────────────────────────────────────────────────────────────────────────────
-- Adicionais de Produto (Product Add-ons)
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite configurar grupos de adicionais por produto (ex: Borda, Extra).
-- Cada item tem nome, preço, custo, e opção de vincular ao estoque/ingredientes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela product_addon_groups (nome do grupo: ex. "Borda", "Adicionais")
CREATE TABLE IF NOT EXISTS public.product_addon_groups (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name            VARCHAR(100)  NOT NULL,
  order_index     INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_addon_groups_product ON public.product_addon_groups(product_id);

-- ── 2. Tabela product_addon_items (itens do grupo)
CREATE TABLE IF NOT EXISTS public.product_addon_items (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  addon_group_id    UUID          NOT NULL REFERENCES public.product_addon_groups(id) ON DELETE CASCADE,
  name              VARCHAR(120)  NOT NULL,
  price             INTEGER       NOT NULL DEFAULT 0,
  cost              INTEGER       DEFAULT 0,
  cost_currency     VARCHAR(3)    DEFAULT 'BRL',
  in_stock          BOOLEAN       NOT NULL DEFAULT FALSE,
  ingredient_id     UUID          REFERENCES public.ingredients(id) ON DELETE SET NULL,
  order_index       INTEGER       NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_addon_items_group ON public.product_addon_items(addon_group_id);
CREATE INDEX IF NOT EXISTS idx_product_addon_items_ingredient ON public.product_addon_items(ingredient_id);

-- ── 3. RLS (usa restaurant_user_roles + super_admin)
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage addon groups" ON public.product_addon_groups;
CREATE POLICY "Users can manage addon groups"
  ON public.product_addon_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active
      WHERE p.id = product_addon_groups.product_id
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Users can manage addon items" ON public.product_addon_items;
CREATE POLICY "Users can manage addon items"
  ON public.product_addon_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.product_addon_groups g
      JOIN public.products p ON p.id = g.product_id
      JOIN public.restaurant_user_roles rur ON rur.restaurant_id = p.restaurant_id AND rur.user_id = auth.uid() AND rur.is_active
      WHERE g.id = product_addon_items.addon_group_id
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Public can read addon groups" ON public.product_addon_groups;
CREATE POLICY "Public can read addon groups"
  ON public.product_addon_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true
      WHERE p.id = product_addon_groups.product_id
    )
  );

DROP POLICY IF EXISTS "Public can read addon items" ON public.product_addon_items;
CREATE POLICY "Public can read addon items"
  ON public.product_addon_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_addon_groups g
      JOIN public.products p ON p.id = g.product_id
      JOIN public.restaurants r ON r.id = p.restaurant_id AND r.is_active = true
      WHERE g.id = product_addon_items.addon_group_id
    )
  );
