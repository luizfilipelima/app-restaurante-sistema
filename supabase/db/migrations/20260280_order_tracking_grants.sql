-- =============================================================================
-- Migration: Garante permissões para get_order_tracking
-- Clientes anônimos (não logados) precisam chamar esta RPC para acompanhar pedidos.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_order_tracking(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(UUID) TO authenticated;
