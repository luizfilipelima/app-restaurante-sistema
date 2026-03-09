-- Migration: Permitir que clientes públicos (cardápio da mesa) insiram waiter_calls
--
-- O cliente no cardápio (halals.quiero.food/cardapio/1) é anônimo. A policy atual
-- exige current_user_can_admin_restaurant, o que bloqueia o INSERT.
-- Esta migration ajusta a policy para permitir INSERT quando o restaurante existe
-- e está ativo (fluxo original do cardápio por mesa).

DROP POLICY IF EXISTS "waiter_calls_insert" ON public.waiter_calls;

CREATE POLICY "waiter_calls_insert" ON public.waiter_calls FOR INSERT
  WITH CHECK (
    (SELECT current_user_can_admin_restaurant(waiter_calls.restaurant_id))
    OR
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = waiter_calls.restaurant_id AND r.is_active = true
    )
  );

COMMENT ON POLICY "waiter_calls_insert" ON public.waiter_calls IS
  'Admins do restaurante ou clientes públicos (cardápio da mesa) podem inserir chamados quando o restaurante existe e está ativo.';
