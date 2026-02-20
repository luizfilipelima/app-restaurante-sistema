-- ============================================================
-- Expo Screen — Timestamps de ciclo de vida do pedido
-- Rastreia accepted_at, ready_at e delivered_at para:
--   • KDS: marca accepted_at ao iniciar preparo, ready_at ao concluir
--   • Expo Screen: marca delivered_at ao entregar na mesa
--   • BI: mede tempo de preparo, tempo no balcão e tempo de entrega
-- ============================================================

-- 1. Adiciona colunas (IF NOT EXISTS para idempotência)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Trigger: seta delivered_at automaticamente quando status muda
--    para 'completed' ou 'delivering' a partir de 'ready'
CREATE OR REPLACE FUNCTION public.fn_set_order_delivered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marca delivered_at quando o pedido sai de 'ready' para entregue
  IF NEW.status IN ('delivering', 'completed')
     AND OLD.status = 'ready'
     AND NEW.delivered_at IS NULL
  THEN
    NEW.delivered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trg_set_order_delivered_at ON public.orders;

CREATE TRIGGER trg_set_order_delivered_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_order_delivered_at();

-- 3. Índices para queries do Expo Screen (status + restaurant)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_ready
  ON public.orders (restaurant_id, status)
  WHERE status = 'ready';

CREATE INDEX IF NOT EXISTS idx_orders_ready_at
  ON public.orders (ready_at)
  WHERE ready_at IS NOT NULL;

-- 4. Revoga execução pública da função de trigger
REVOKE ALL ON FUNCTION public.fn_set_order_delivered_at() FROM PUBLIC;
