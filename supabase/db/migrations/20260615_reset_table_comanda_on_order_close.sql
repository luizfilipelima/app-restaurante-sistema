-- =============================================================================
-- Migration: Reset mesa e comanda ao cancelar ou concluir pedido
-- Data: 2026-06-15
--
-- Sempre que um pedido vinculado à mesa ou comanda for cancelado ou concluído,
-- a mesa e a comanda são completamente resetadas (limpeza de dados, liberação
-- para próximo cliente).
--
-- Trigger em orders: AFTER UPDATE OF status
-- Quando status → 'cancelled' ou 'completed', executa reset da mesa e/ou comanda.
-- Usa OLD.table_id e OLD.virtual_comanda_id (o UPDATE pode ter limpado table_id).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_table_and_comanda_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id          UUID;
  v_virtual_comanda_id UUID;
  v_restaurant_id     UUID;
  v_comanda_ids       UUID[];
  v_table_id_to_reset UUID;
BEGIN
  -- Só age quando status muda para cancelled ou completed
  IF NEW.status NOT IN ('cancelled', 'completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_table_id          := OLD.table_id;  -- pode ter sido limpo pelo UPDATE
  v_virtual_comanda_id := OLD.virtual_comanda_id;
  v_restaurant_id     := NEW.restaurant_id;

  -- 1. RESET MESA — se o pedido tinha table_id
  IF v_table_id IS NOT NULL THEN
    v_table_id_to_reset := v_table_id;

    -- Limpar nome do cliente na mesa
    UPDATE tables
       SET current_customer_name = NULL,
           updated_at = NOW()
     WHERE id = v_table_id_to_reset;

    -- Resetar chamados de garçom pendentes
    UPDATE waiter_calls
       SET status = 'attended', attended_at = NOW()
     WHERE table_id = v_table_id_to_reset
       AND status = 'pending';

    -- Remover vínculos de comandas físicas (buffet)
    DELETE FROM table_comanda_links
     WHERE table_id = v_table_id_to_reset
       AND restaurant_id = v_restaurant_id;

    -- Se havia reserva ativa com comanda vinculada, resetar comandas digitais
    SELECT ARRAY_AGG(r.virtual_comanda_id)
      INTO v_comanda_ids
      FROM reservations r
     WHERE r.table_id = v_table_id_to_reset
       AND r.status IN ('pending', 'confirmed', 'activated');

    IF v_comanda_ids IS NOT NULL AND array_length(v_comanda_ids, 1) > 0 THEN
      DELETE FROM virtual_comanda_items
       WHERE comanda_id = ANY(v_comanda_ids);

      UPDATE virtual_comandas
         SET customer_name = NULL,
             notes         = NULL,
             table_number  = NULL,
             updated_at    = NOW()
       WHERE id = ANY(v_comanda_ids)
         AND status = 'open';
    END IF;
  END IF;

  -- 2. RESET COMANDA DIGITAL — se o pedido tinha virtual_comanda_id e status = 'cancelled'
  --    (para 'completed', o RPC cashier_complete_comanda ou complete_reservation já tratou)
  IF v_virtual_comanda_id IS NOT NULL AND NEW.status = 'cancelled' THEN
    -- Resetar comanda digital (aberta): limpar itens e dados
    DELETE FROM virtual_comanda_items
     WHERE comanda_id = v_virtual_comanda_id;

    UPDATE virtual_comandas
       SET customer_name = NULL,
           notes         = NULL,
           table_number  = NULL,
           total_amount  = 0,
           updated_at    = NOW()
     WHERE id = v_virtual_comanda_id
       AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reset_table_and_comanda_on_order_status_change() IS
  'Trigger: ao cancelar ou concluir pedido, reseta mesa e comanda vinculadas.';

DROP TRIGGER IF EXISTS trg_orders_reset_table_comanda_on_close ON orders;
CREATE TRIGGER trg_orders_reset_table_comanda_on_close
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reset_table_and_comanda_on_order_status_change();
