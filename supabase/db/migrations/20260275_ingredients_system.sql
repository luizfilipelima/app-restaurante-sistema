-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema de Ingredientes e Receitas
-- ─────────────────────────────────────────────────────────────────────────────
-- Permite cadastrar ingredientes com custos e vincular aos produtos (receitas).
-- Custo por unidade de ingrediente → CMV real baseado no consumo.
-- Compatível com o estoque por produto existente (inventory_items).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela ingredients (matérias-primas do restaurante) ────────────────────

CREATE TABLE IF NOT EXISTS public.ingredients (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(255)  NOT NULL,
  unit            VARCHAR(20)   NOT NULL DEFAULT 'un',
  cost_per_unit   INTEGER       DEFAULT 0,
  cost_currency   VARCHAR(3)    DEFAULT NULL,
  sku             VARCHAR(80)   DEFAULT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant ON public.ingredients(restaurant_id);

-- ── 2. Tabela ingredient_stock (estoque por ingrediente) ──────────────────────

CREATE TABLE IF NOT EXISTS public.ingredient_stock (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id   UUID          NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_quantity    NUMERIC(12,3) NOT NULL DEFAULT 0,
  expiry_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_stock_ingredient ON public.ingredient_stock(ingredient_id);

-- ── 3. Tabela ingredient_movements (histórico de movimentações) ───────────────

CREATE TABLE IF NOT EXISTS public.ingredient_movements (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_stock_id UUID          NOT NULL REFERENCES public.ingredient_stock(id) ON DELETE CASCADE,
  order_id            UUID          REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id          UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  quantity_change     NUMERIC(12,3) NOT NULL,
  movement_type       VARCHAR(20)   NOT NULL DEFAULT 'adjustment'
                        CHECK (movement_type IN ('sale','restock','adjustment','loss','return')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_movements_stock ON public.ingredient_movements(ingredient_stock_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_movements_order ON public.ingredient_movements(order_id);

-- ── 4. Tabela product_ingredients (receita: produto → ingredientes) ───────────

CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id      UUID          NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_per_unit  NUMERIC(12,4) NOT NULL,
  unit               VARCHAR(20)   NOT NULL DEFAULT 'un',
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON public.product_ingredients(ingredient_id);

-- ── 5. Função: decrementar estoque de ingredientes ao vender (via receita) ─────
-- Roda junto com fn_decrement_inventory_on_sale: se o produto tem product_ingredients,
-- consome ingredientes; senão, mantém o decremento em inventory_items (comportamento atual).

CREATE OR REPLACE FUNCTION public.fn_decrement_ingredients_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_ingredient_id UUID;
  v_stock_id      UUID;
  v_qty           NUMERIC(12,4);
  v_rec           RECORD;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
    FROM public.orders WHERE id = NEW.order_id;
  IF v_restaurant_id IS NULL THEN RETURN NEW; END IF;

  -- Para cada ingrediente na receita do produto
  FOR v_rec IN
    SELECT pi.ingredient_id, (pi.quantity_per_unit * NEW.quantity) AS total_qty
      FROM public.product_ingredients pi
      JOIN public.ingredients i ON i.id = pi.ingredient_id
     WHERE pi.product_id = NEW.product_id
       AND i.restaurant_id = v_restaurant_id
  LOOP
    v_ingredient_id := v_rec.ingredient_id;
    v_qty := v_rec.total_qty;

    SELECT id INTO v_stock_id
      FROM public.ingredient_stock
     WHERE ingredient_id = v_ingredient_id;

    IF v_stock_id IS NULL THEN
      -- Cria registro de estoque se não existir (permite overselling)
      INSERT INTO public.ingredient_stock (ingredient_id, quantity, min_quantity, updated_at)
      VALUES (v_ingredient_id, -v_qty, 0, NOW())
      RETURNING id INTO v_stock_id;
      INSERT INTO public.ingredient_movements (ingredient_stock_id, order_id, product_id, quantity_change, movement_type)
      VALUES (v_stock_id, NEW.order_id, NEW.product_id, -v_qty, 'sale');
    ELSE
      UPDATE public.ingredient_stock
         SET quantity = quantity - v_qty,
             updated_at = NOW()
       WHERE id = v_stock_id;
      INSERT INTO public.ingredient_movements (ingredient_stock_id, order_id, product_id, quantity_change, movement_type)
      VALUES (v_stock_id, NEW.order_id, NEW.product_id, -v_qty, 'sale');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Quando o produto tem product_ingredients, NÃO decrementar inventory_items
-- (para evitar contagem dupla). Alteramos a função original para verificar isso.

CREATE OR REPLACE FUNCTION public.fn_decrement_inventory_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
  v_item_id       UUID;
  v_has_recipe    BOOLEAN;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o produto usa receita (ingredientes), o decremento é feito por fn_decrement_ingredients_on_sale
  SELECT EXISTS (
    SELECT 1 FROM public.product_ingredients
     WHERE product_id = NEW.product_id
     LIMIT 1
  ) INTO v_has_recipe;

  IF v_has_recipe THEN
    RETURN NEW;
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
    FROM public.orders WHERE id = NEW.order_id;
  IF v_restaurant_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_item_id
    FROM public.inventory_items
   WHERE product_id = NEW.product_id AND restaurant_id = v_restaurant_id;

  IF v_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.inventory_items
     SET quantity = quantity - NEW.quantity, updated_at = NOW()
   WHERE id = v_item_id;

  INSERT INTO public.inventory_movements (inventory_item_id, order_id, quantity_change, movement_type, notes)
  VALUES (v_item_id, NEW.order_id, -NEW.quantity, 'sale', NULL);

  RETURN NEW;
END;
$$;

-- Trigger para ingredientes (roda APÓS inventory para poder usar NEW)
DROP TRIGGER IF EXISTS trg_decrement_ingredients ON public.order_items;
CREATE TRIGGER trg_decrement_ingredients
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_decrement_ingredients_on_sale();

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_stock   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- ingredients
DROP POLICY IF EXISTS "ingredients_select" ON public.ingredients;
CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = auth.uid() AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true)
  );
DROP POLICY IF EXISTS "ingredients_insert" ON public.ingredients;
CREATE POLICY "ingredients_insert" ON public.ingredients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = auth.uid() AND r.restaurant_id = restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredients_update" ON public.ingredients;
CREATE POLICY "ingredients_update" ON public.ingredients FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = auth.uid() AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "ingredients_delete" ON public.ingredients;
CREATE POLICY "ingredients_delete" ON public.ingredients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'super_admin' OR u.restaurant_id = ingredients.restaurant_id))
    OR EXISTS (SELECT 1 FROM public.restaurant_user_roles r WHERE r.user_id = auth.uid() AND r.restaurant_id = ingredients.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );

-- ingredient_stock (via ingredients)
DROP POLICY IF EXISTS "ingredient_stock_select" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_select" ON public.ingredient_stock FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.users u ON u.id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id
        AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true
    )
  );
DROP POLICY IF EXISTS "ingredient_stock_insert" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_insert" ON public.ingredient_stock FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.users u ON u.id = auth.uid()
      WHERE i.id = ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE i.id = ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager')
    )
  );
DROP POLICY IF EXISTS "ingredient_stock_update" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_update" ON public.ingredient_stock FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.users u ON u.id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager')
    )
  );
DROP POLICY IF EXISTS "ingredient_stock_delete" ON public.ingredient_stock;
CREATE POLICY "ingredient_stock_delete" ON public.ingredient_stock FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.users u ON u.id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredients i
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE i.id = ingredient_stock.ingredient_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true AND r.role = 'owner'
    )
  );

-- ingredient_movements
DROP POLICY IF EXISTS "ingredient_movements_select" ON public.ingredient_movements;
CREATE POLICY "ingredient_movements_select" ON public.ingredient_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ingredient_stock ist
      JOIN public.ingredients i ON i.id = ist.ingredient_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE ist.id = ingredient_movements.ingredient_stock_id
        AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredient_stock ist
      JOIN public.ingredients i ON i.id = ist.ingredient_id
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE ist.id = ingredient_movements.ingredient_stock_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true
    )
  );
DROP POLICY IF EXISTS "ingredient_movements_insert" ON public.ingredient_movements;
CREATE POLICY "ingredient_movements_insert" ON public.ingredient_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ingredient_stock ist
      JOIN public.ingredients i ON i.id = ist.ingredient_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE ist.id = ingredient_stock_id AND (u.role = 'super_admin' OR u.restaurant_id = i.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.ingredient_stock ist
      JOIN public.ingredients i ON i.id = ist.ingredient_id
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE ist.id = ingredient_stock_id AND r.restaurant_id = i.restaurant_id AND r.is_active = true
    )
  );

-- product_ingredients
DROP POLICY IF EXISTS "product_ingredients_select" ON public.product_ingredients;
CREATE POLICY "product_ingredients_select" ON public.product_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true
    )
  );
DROP POLICY IF EXISTS "product_ingredients_insert" ON public.product_ingredients;
CREATE POLICY "product_ingredients_insert" ON public.product_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid()
      WHERE p.id = product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE p.id = product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "product_ingredients_update" ON public.product_ingredients;
CREATE POLICY "product_ingredients_update" ON public.product_ingredients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
DROP POLICY IF EXISTS "product_ingredients_delete" ON public.product_ingredients;
CREATE POLICY "product_ingredients_delete" ON public.product_ingredients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.users u ON u.id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND (u.role = 'super_admin' OR u.restaurant_id = p.restaurant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
      WHERE p.id = product_ingredients.product_id AND r.restaurant_id = p.restaurant_id AND r.is_active = true AND r.role IN ('owner', 'manager'))
  );
