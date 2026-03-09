/**
 * Mapeamento de planos técnicos (core, standard, enterprise) para a
 * nomenclatura comercial do Quiero.food em Ciudad del Este (Paraguai).
 *
 * Ref: FEATURES_E_PLANOS.md
 */

export const PLAN_DISPLAY: Record<string, {
  label: string;
  description: string;
  priceUsd: number;
  pricePyg: number;
  border: string;
  header: string;
  cardBg: string;
  badge: string;
  accent: string;
  ring: string;
}> = {
  core: {
    label: 'Presença',
    description: 'Menu Digital (QR), Link na Bio, Cotação Automática de Moedas e BI/Analytics.',
    priceUsd: 29,
    pricePyg: 180000,
    border: 'border-slate-200',
    header: 'bg-slate-50 border-b border-slate-200',
    cardBg: 'bg-slate-50',
    badge: 'bg-slate-100 text-slate-600',
    accent: 'text-slate-600',
    ring: 'focus-visible:ring-slate-400',
  },
  standard: {
    label: 'Delivery',
    description: 'Tudo do Presença + Gestão de Pedidos (Delivery), Entregadores, Zonas, KDS/Expo.',
    priceUsd: 59,
    pricePyg: 350000,
    border: 'border-orange-200',
    header: 'bg-orange-50 border-b border-orange-200',
    cardBg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    accent: 'text-orange-700',
    ring: 'focus-visible:ring-orange-400',
  },
  enterprise: {
    label: 'Gestão Total',
    description: 'Tudo do Delivery + Mesas (QR), Reservas, Caixa, Comanda Digital, Buffet, Inventário/CMV.',
    priceUsd: 89,
    pricePyg: 559000,
    border: 'border-violet-200',
    header: 'bg-violet-50 border-b border-violet-200',
    cardBg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    accent: 'text-violet-700',
    ring: 'focus-visible:ring-violet-400',
  },
};

/** Nomes técnicos dos planos no banco */
export const PLAN_NAMES = ['core', 'standard', 'enterprise'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

/** Retorna o label comercial do plano a partir do nome técnico */
export function getPlanDisplayLabel(planName: string): string {
  return PLAN_DISPLAY[planName]?.label ?? planName;
}
