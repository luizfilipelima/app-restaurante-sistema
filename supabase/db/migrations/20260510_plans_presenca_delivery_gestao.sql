-- Migration: Atualiza labels, descrições e preços dos planos conforme FEATURES_E_PLANOS.md
-- Ciudad del Este (Paraguai): Presença, Delivery, Gestão Total
--
-- Os identificadores técnicos (name: core, standard, enterprise) permanecem para
-- compatibilidade com feature flags e plan_features.

UPDATE public.subscription_plans
SET
  label       = 'Presença',
  description = 'Menu Digital (QR), Link na Bio, Cotação Automática de Moedas e BI/Analytics. Ideal para começar.',
  price_brl   = 29.00,   -- referência USD
  price_pyg   = 180000
WHERE name = 'core';

UPDATE public.subscription_plans
SET
  label       = 'Delivery',
  description = 'Tudo do Presença + Gestão de Pedidos (Delivery), Entregadores, Zonas e KDS/Expo.',
  price_brl   = 59.00,   -- referência USD
  price_pyg   = 350000
WHERE name = 'standard';

UPDATE public.subscription_plans
SET
  label       = 'Gestão Total',
  description = 'Tudo do Delivery + Mesas (QR), Reservas, Caixa, Comanda Digital, Buffet e Inventário/CMV.',
  price_brl   = 89.00,   -- referência USD
  price_pyg   = 559000
WHERE name = 'enterprise';

DO $$
BEGIN
  RAISE NOTICE '=== Migration 20260510_plans_presenca_delivery_gestao concluída ===';
  RAISE NOTICE '  Planos atualizados: Presença ($29), Delivery ($59), Gestão Total ($89)';
  RAISE NOTICE '  PYG: 180.000, 350.000, 559.000';
END $$;
