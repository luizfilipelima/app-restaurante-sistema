-- =============================================================================
-- Migration: Receita mensal manual por restaurante (override para Dashboard BI)
-- Data: 2026-02-22
--
-- Permite que o super admin defina manualmente quanto recebe por mês (BRL)
-- de cada restaurante. Se NULL, o Dashboard usa o preço do plano.
-- =============================================================================

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS manual_monthly_revenue_brl NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN restaurants.manual_monthly_revenue_brl IS
  'Override manual da receita mensal em BRL para o Dashboard BI. Quando NULL, usa o preço do plano de assinatura.';
