-- =============================================================================
-- Migration: Corrigir pedidos mesa/comanda existentes em pending → preparing
-- Data: 2026-06-17
--
-- Objetivo: Pedidos de mesa ou comanda que ainda estão com status 'pending'
-- (criados antes da migration 20260616 ou por outro fluxo) devem ser movidos
-- para 'preparing' para aparecer na coluna "Em preparo" do KDS.
-- =============================================================================

UPDATE orders
SET status      = 'preparing',
    accepted_at = COALESCE(accepted_at, now()),
    updated_at  = now()
WHERE status = 'pending'
  AND (
    order_source IN ('table', 'comanda', 'buffet')
    OR table_id IS NOT NULL
  );
