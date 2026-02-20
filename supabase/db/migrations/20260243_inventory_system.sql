-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema de Controle de Estoque
-- ─────────────────────────────────────────────────────────────────────────────
-- Inclui:
--   1. Coluna has_inventory na tabela categories
--   2. Tabela inventory_items (registro de estoque por produto)
--   3. Tabela inventory_movements (histórico de movimentações)
--   4. Trigger de auto-decremento ao inserir order_items
--   5. Políticas RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Adiciona controle de estoque às categorias ─────────────────────────────

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS has_inventory BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Tabela de itens de estoque ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID         NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id      UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_quantity    NUMERIC(12,3) NOT NULL DEFAULT 5,
  unit            VARCHAR(20)  NOT NULL DEFAULT 'un',
  cost_price      INTEGER      DEFAULT 0,   -- mesmo padrão dos produtos: centavos (BRL) ou inteiro (PYG)
  sale_price      INTEGER      DEFAULT 0,   -- substitui o preço do produto para fins de CMV
  expiry_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, product_id)
);

-- ── 3. Tabela de movimentações ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id   UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  order_id            UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  quantity_change     NUMERIC(12,3) NOT NULL,   -- negativo = saída, positivo = entrada
  movement_type       VARCHAR(20) NOT NULL DEFAULT 'adjustment'
                        CHECK (movement_type IN ('sale','restock','adjustment','loss','return')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant
  ON public.inventory_items(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_product
  ON public.inventory_items(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON public.inventory_movements(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_order
  ON public.inventory_movements(order_id);

-- ── 4. Trigger: decrementa estoque ao confirmar item de pedido ────────────────

CREATE OR REPLACE FUNCTION public.fn_decrement_inventory_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_restaurant_id UUID;
  v_item_id       UUID;
BEGIN
  -- Só age se o item de pedido tiver product_id preenchido
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Descobre o restaurant_id a partir do pedido
  SELECT restaurant_id INTO v_restaurant_id
    FROM public.orders
   WHERE id = NEW.order_id;

  IF v_restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta encontrar o item de estoque correspondente
  SELECT id INTO v_item_id
    FROM public.inventory_items
   WHERE product_id    = NEW.product_id
     AND restaurant_id = v_restaurant_id;

  IF v_item_id IS NULL THEN
    -- Produto sem registro de estoque — não faz nada
    RETURN NEW;
  END IF;

  -- Decrementa a quantidade
  UPDATE public.inventory_items
     SET quantity   = quantity - NEW.quantity,
         updated_at = NOW()
   WHERE id = v_item_id;

  -- Registra a movimentação
  INSERT INTO public.inventory_movements
    (inventory_item_id, order_id, quantity_change, movement_type)
  VALUES
    (v_item_id, NEW.order_id, -NEW.quantity, 'sale');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_inventory ON public.order_items;

CREATE TRIGGER trg_decrement_inventory
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_decrement_inventory_on_sale();

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.inventory_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- inventory_items: staff do restaurante lê e escreve seus próprios dados
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
CREATE POLICY "inventory_items_select"
  ON public.inventory_items FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_users
       WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
CREATE POLICY "inventory_items_insert"
  ON public.inventory_items FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_users
       WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
CREATE POLICY "inventory_items_update"
  ON public.inventory_items FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_users
       WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_delete"
  ON public.inventory_items FOR DELETE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_users
       WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Trigger também precisa escrever em inventory_items e inventory_movements
-- Permissões para a função de trigger executar com permissões necessárias
-- (a função roda como SECURITY DEFINER implicitamente via trigger de admin)

DROP POLICY IF EXISTS "inventory_movements_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select"
  ON public.inventory_movements FOR SELECT
  USING (
    inventory_item_id IN (
      SELECT id FROM public.inventory_items
       WHERE restaurant_id IN (
         SELECT restaurant_id FROM public.restaurant_users
          WHERE user_id = auth.uid()
       )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "inventory_movements_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_insert"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    inventory_item_id IN (
      SELECT id FROM public.inventory_items
       WHERE restaurant_id IN (
         SELECT restaurant_id FROM public.restaurant_users
          WHERE user_id = auth.uid()
       )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
