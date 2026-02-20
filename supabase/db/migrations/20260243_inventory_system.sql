-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema de Controle de Estoque
-- ─────────────────────────────────────────────────────────────────────────────
-- Inclui:
--   1. Coluna has_inventory na tabela categories
--   2. Tabela inventory_items (registro de estoque por produto)
--   3. Tabela inventory_movements (histórico de movimentações)
--   4. Trigger SECURITY DEFINER de auto-decremento ao inserir order_items
--   5. Políticas RLS (usando o padrão do projeto: tabela users + restaurant_user_roles)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Adiciona controle de estoque às categorias ─────────────────────────────

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS has_inventory BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Tabela de itens de estoque ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID          NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_quantity    NUMERIC(12,3) NOT NULL DEFAULT 5,
  unit            VARCHAR(20)   NOT NULL DEFAULT 'un',
  cost_price      INTEGER       DEFAULT 0,   -- centavos (BRL) ou inteiro (PYG), mesmo padrão de products
  sale_price      INTEGER       DEFAULT 0,   -- sobrepõe o preço do produto para fins de CMV
  expiry_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, product_id)
);

-- ── 3. Tabela de movimentações ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id   UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  order_id            UUID          REFERENCES public.orders(id) ON DELETE SET NULL,
  quantity_change     NUMERIC(12,3) NOT NULL,   -- negativo = saída, positivo = entrada
  movement_type       VARCHAR(20)   NOT NULL DEFAULT 'adjustment'
                        CHECK (movement_type IN ('sale','restock','adjustment','loss','return')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
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

-- ── 4. Trigger SECURITY DEFINER: decrementa estoque ao confirmar item ─────────
--
-- A função roda com SECURITY DEFINER para ter permissão de atualizar
-- inventory_items mesmo quando o chamador é o usuário anônimo público
-- (que insere order_items ao fazer um pedido pelo cardápio).

CREATE OR REPLACE FUNCTION public.fn_decrement_inventory_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Produto sem registro de estoque → não faz nada
  IF v_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Decrementa a quantidade (permite negativo — indica overselling)
  UPDATE public.inventory_items
     SET quantity   = quantity - NEW.quantity,
         updated_at = NOW()
   WHERE id = v_item_id;

  -- Registra a movimentação
  INSERT INTO public.inventory_movements
    (inventory_item_id, order_id, quantity_change, movement_type, notes)
  VALUES
    (v_item_id, NEW.order_id, -NEW.quantity, 'sale', NULL);

  RETURN NEW;
END;
$$;

-- Garante que apenas a função trigger (não usuários externos) executa isso
REVOKE ALL ON FUNCTION public.fn_decrement_inventory_on_sale() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_decrement_inventory ON public.order_items;

CREATE TRIGGER trg_decrement_inventory
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_decrement_inventory_on_sale();

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
--
-- Padrão do projeto:
--   - restaurant_admin  → acessa dados do seu restaurante via users.restaurant_id
--   - super_admin       → acessa todos os dados via users.role
--   - Equipe operacional → acessa via restaurant_user_roles (manager, waiter, etc.)
--
-- Helper: verifica se o usuário autenticado pertence ao restaurante
-- (dono via users.restaurant_id OU membro via restaurant_user_roles)

ALTER TABLE public.inventory_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- ── inventory_items ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
CREATE POLICY "inventory_items_select"
  ON public.inventory_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.restaurant_id = inventory_items.restaurant_id)
         )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
       WHERE r.user_id = auth.uid()
         AND r.restaurant_id = inventory_items.restaurant_id
         AND r.is_active = true
    )
  );

DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
CREATE POLICY "inventory_items_insert"
  ON public.inventory_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.restaurant_id = restaurant_id)
         )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
       WHERE r.user_id = auth.uid()
         AND r.restaurant_id = restaurant_id
         AND r.is_active = true
         AND r.role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
CREATE POLICY "inventory_items_update"
  ON public.inventory_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.restaurant_id = inventory_items.restaurant_id)
         )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
       WHERE r.user_id = auth.uid()
         AND r.restaurant_id = inventory_items.restaurant_id
         AND r.is_active = true
         AND r.role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_delete"
  ON public.inventory_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND (
           u.role = 'super_admin'
           OR (u.role = 'restaurant_admin' AND u.restaurant_id = inventory_items.restaurant_id)
         )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.restaurant_user_roles r
       WHERE r.user_id = auth.uid()
         AND r.restaurant_id = inventory_items.restaurant_id
         AND r.is_active = true
         AND r.role = 'owner'
    )
  );

-- ── inventory_movements ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "inventory_movements_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select"
  ON public.inventory_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.inventory_items ii
        JOIN public.users u ON u.id = auth.uid()
       WHERE ii.id = inventory_movements.inventory_item_id
         AND (
           u.role = 'super_admin'
           OR u.restaurant_id = ii.restaurant_id
         )
    )
    OR
    EXISTS (
      SELECT 1
        FROM public.inventory_items ii
        JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
       WHERE ii.id = inventory_movements.inventory_item_id
         AND r.restaurant_id = ii.restaurant_id
         AND r.is_active = true
    )
  );

DROP POLICY IF EXISTS "inventory_movements_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_insert"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.inventory_items ii
        JOIN public.users u ON u.id = auth.uid()
       WHERE ii.id = inventory_item_id
         AND (
           u.role = 'super_admin'
           OR u.restaurant_id = ii.restaurant_id
         )
    )
    OR
    EXISTS (
      SELECT 1
        FROM public.inventory_items ii
        JOIN public.restaurant_user_roles r ON r.user_id = auth.uid()
       WHERE ii.id = inventory_item_id
         AND r.restaurant_id = ii.restaurant_id
         AND r.is_active = true
    )
  );

COMMENT ON FUNCTION public.fn_decrement_inventory_on_sale() IS
  'SECURITY DEFINER — decrementa inventory_items e registra movimento quando um order_item é inserido. Roda com permissões elevadas para funcionar mesmo quando o pedido vem do cardápio público (usuário anônimo).';
