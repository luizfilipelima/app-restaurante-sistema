-- Migration: order_items.bar_ready_at — rastreia quando itens de bar foram concluídos
-- Usado pela Central do Bar: ao marcar PRONTO, define bar_ready_at.
-- A Central da Cozinha oculta itens de bar que já têm bar_ready_at.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS bar_ready_at TIMESTAMPTZ;

COMMENT ON COLUMN public.order_items.bar_ready_at IS 'Momento em que o bar marcou o item como pronto. Usado para ocultar da cozinha.';

-- RPC: marca todos os itens de bar de um pedido como prontos.
-- Se o pedido tiver APENAS itens de bar, define order.status = 'ready' e ready_at.
CREATE OR REPLACE FUNCTION public.mark_order_bar_items_ready(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_kitchen_items BOOLEAN;
BEGIN
  UPDATE public.order_items oi
  SET bar_ready_at = COALESCE(oi.bar_ready_at, now())
  FROM public.products p
  WHERE oi.order_id = p_order_id
    AND oi.product_id = p.id
    AND p.print_destination = 'bar';

  -- Pedidos só de bar: marcar order como pronto
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi2
    JOIN public.products p2 ON p2.id = oi2.product_id
    WHERE oi2.order_id = p_order_id
      AND (p2.print_destination IS NULL OR p2.print_destination = 'kitchen')
  ) INTO v_has_kitchen_items;

  IF NOT v_has_kitchen_items THEN
    UPDATE public.orders
    SET status = 'ready', ready_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.mark_order_bar_items_ready(UUID) IS 'Marca itens de bar de um pedido como prontos (bar_ready_at).';
