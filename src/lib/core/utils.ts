import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPrice } from '../priceHelper';
import type { BankAccountByCountry, PaymentBankAccountSnapshot, PrintSettingsBySector } from '@/types';

export type WaiterTipSector = 'delivery' | 'table' | 'pickup' | 'buffet';

/**
 * Retorna o valor e dados da taxa de garçom para um setor, conforme config em print_settings_by_sector.
 * Quando enabled, aplica pct sobre o subtotal (antes de delivery/desconto).
 */
export function getWaiterTipForSector(
  subtotal: number,
  sector: WaiterTipSector,
  printSettings?: PrintSettingsBySector | null
): { amount: number; pct: number; enabled: boolean } {
  const cfg = printSettings?.[sector];
  const enabled = !!cfg?.waiter_tip_enabled;
  const pct = enabled ? Math.max(0, Math.min(100, Number(cfg?.waiter_tip_pct) || 10)) : 0;
  const amount = enabled ? Math.round(subtotal * (pct / 100)) : 0;
  return { amount, pct, enabled };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Re-export para compatibilidade; preferir import de @/lib/priceHelper */
export type CurrencyCode = 'BRL' | 'PYG' | 'ARS' | 'USD';

/** Formata valor em BRL já em reais (ex.: subscription_plans.price_brl). Não divide por 100. */
export function formatBRLReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPhone(phone: string): string {
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');
  
  // Formata como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * URL pública do cardápio.
 * - Produção (quiero.food): subdomínio slug.quiero.food
 * - Dev com subdomínio admin (app.localhost): abre localhost/slug para usar o layout path-based,
 *   pois o app subdomain não tem rota para o cardápio público
 * - Dev path-based (localhost): origin/slug
 */
export function getCardapioPublicUrl(slug: string): string {
  if (!slug) return '';
  if (typeof window === 'undefined') return `https://${slug}.quiero.food`;
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  const port = window.location.port ? `:${window.location.port}` : '';
  if (hostname.endsWith('quiero.food')) return `https://${slug}.quiero.food`;
  // Em dev com app/admin subdomain: abrir em localhost/slug para layout path-based correto
  if ((hostname.includes('localhost') || hostname.includes('127.0.0.1')) && ['app', 'admin', 'www'].some((s) => hostname.startsWith(s + '.'))) {
    return `${window.location.protocol}//localhost${port}/${slug}`;
  }
  return `${origin}/${slug}`;
}

/** URL pública da comanda digital: slug.quiero.food/comanda (subdomínio) ou origin/slug/comanda (dev). */
export function getComandaPublicUrl(slug: string): string {
  if (!slug) return '';
  const base = getCardapioPublicUrl(slug);
  return base ? `${base.replace(/\/$/, '')}/comanda` : '';
}

/** URL pública da página Links e Bio (ex.: slug.quiero.food/bio ou origin/slug/bio). Mesma página configurada na aba Links e Bio em /settings. */
export function getBioPublicUrl(slug: string): string {
  if (!slug) return '';
  const base = getCardapioPublicUrl(slug);
  return base ? `${base.replace(/\/$/, '')}/bio` : '';
}

/** Gera link do WhatsApp. O número deve vir com código do país (ex: 5511999999999 ou 595981123456). */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/** Formata valor em Guaranies (Paraguai). */
export function formatGuarani(value: number): string {
  return formatPrice(value, 'PYG');
}

/**
 * Infere o país do telefone a partir do prefixo internacional armazenado.
 * Útil quando o número foi salvo com código de país (ex: 595981234567).
 */
export function inferPhoneCountry(phone: string): 'BR' | 'PY' | 'AR' {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('595')) return 'PY';
  if (digits.startsWith('54')) return 'AR';
  if (digits.startsWith('55')) return 'BR';
  return 'BR';
}

/**
 * Retorna o telefone no formato correto para wa.me (dígitos com código de país).
 * Se o número já tiver prefixo internacional (55, 595, 54), usa como está.
 * Caso contrário, normaliza com o fallbackCountry (ex: pedidos antigos sem código).
 */
export function ensurePhoneForWhatsApp(phone: string, fallbackCountry: 'BR' | 'PY' | 'AR' = 'BR'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('595') && digits.length >= 12) return digits;
  if (digits.startsWith('54') && digits.length >= 10) return digits;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return normalizePhoneWithCountryCode(phone, fallbackCountry);
}

/** Normaliza telefone para número internacional (apenas dígitos). BR: +55, PY: +595, AR: +54. */
export function normalizePhoneWithCountryCode(phone: string, countryCode: 'BR' | 'PY' | 'AR'): string {
  const digits = phone.replace(/\D/g, '');
  if (countryCode === 'BR') {
    const br = digits.length <= 11 ? digits : digits.slice(-11);
    return '55' + (br.length === 11 ? br : br.padStart(11, '0'));
  }
  if (countryCode === 'PY') {
    const py = digits.length <= 9 ? digits : digits.slice(-9);
    return '595' + py.padStart(9, '0');
  }
  if (countryCode === 'AR') {
    // Argentina: DDD (até 4 dígitos) + número (6-8 dígitos), total até 12 dígitos
    const ar = digits.length <= 12 ? digits : digits.slice(-12);
    return '54' + ar;
  }
  return digits;
}

const DAY_ORDER: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Verifica se, no horário local atual, o estabelecimento está dentro do horário de funcionamento. */
export function isWithinOpeningHours(openingHours?: Record<string, { open: string; close: string } | null>): boolean {
  if (!openingHours || typeof openingHours !== 'object') return true;
  const now = new Date();
  const dayIndex = now.getDay();
  const dayKey = DAY_ORDER[dayIndex];
  const slot = openingHours[dayKey];
  if (!slot || !slot.open || !slot.close) return false;
  const [openH, openM] = slot.open.split(':').map(Number);
  const [closeH, closeM] = slot.close.split(':').map(Number);
  let currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;
  if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;
  if (currentMinutes < openMinutes) currentMinutes += 24 * 60;
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/** Restaurante com campos usados para verificação de horário de delivery */
type RestaurantDeliveryHours = {
  always_open?: boolean;
  is_manually_closed?: boolean;
  opening_hours?: Record<string, { open: string; close: string } | null>;
  delivery_until_time?: string | null;
};

/**
 * Verifica se o restaurante aceita pedidos de delivery no momento.
 * Considera: always_open, is_manually_closed, opening_hours e delivery_until_time.
 * Se always_open estiver ativo, retorna true. Caso contrário, verifica horário
 * de funcionamento e, se delivery_until_time estiver definido, se o horário
 * atual não passou desse limite.
 */
export function isWithinDeliveryHours(restaurant: RestaurantDeliveryHours | null | undefined): boolean {
  if (!restaurant) return false;
  if (restaurant.is_manually_closed) return false;
  if (restaurant.always_open) return true;
  const hasHours = restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0;
  if (hasHours && !isWithinOpeningHours(restaurant.opening_hours)) return false;
  const until = restaurant.delivery_until_time?.trim();
  if (!until || until.length < 5) return true;
  const now = new Date();
  const [untilH, untilM] = until.split(':').map(Number);
  const untilMinutes = (untilH ?? 0) * 60 + (untilM ?? 0);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes < untilMinutes;
}

/** Extrai dados bancários conforme moeda: PYG → pyg (Banco, Titular, Alias), ARS → ars (Banco, Agência, Conta, Titular). */
export function getBankAccountForCurrency(
  bankAccount: BankAccountByCountry | null | undefined,
  currency: string
): PaymentBankAccountSnapshot | null {
  if (!bankAccount || typeof bankAccount !== 'object') return null;
  const asAny = bankAccount as Record<string, unknown>;
  const hasLegacy = 'bank_name' in asAny || 'agency' in asAny || 'account' in asAny || 'holder' in asAny;
  if (hasLegacy && currency === 'ARS') {
    const leg = asAny as { bank_name?: string; agency?: string; account?: string; holder?: string };
    if (leg.bank_name || leg.agency || leg.account || leg.holder) return leg;
    return null;
  }
  const ba = currency === 'PYG' ? (bankAccount as BankAccountByCountry).pyg : (bankAccount as BankAccountByCountry).ars;
  if (!ba) return null;
  const b = ba as Record<string, unknown>;
  const hasData = !!(b.bank_name || b.holder || b.alias || b.agency || b.account);
  if (!hasData) return null;
  return ba as PaymentBankAccountSnapshot;
}

/** Verifica se o snapshot tem dados (pyg ou ars). */
export function hasBankAccountData(ba: PaymentBankAccountSnapshot | null | undefined): boolean {
  if (!ba || typeof ba !== 'object') return false;
  const b = ba as Record<string, unknown>;
  return !!(b.bank_name || b.holder || b.alias || b.agency || b.account);
}

/** Linhas para exibição/cópia do snapshot bancário. */
export function formatBankAccountLines(ba: PaymentBankAccountSnapshot | null | undefined): string[] {
  if (!ba || typeof ba !== 'object') return [];
  const b = ba as Record<string, unknown>;
  const lines: string[] = [];
  if (b.bank_name) lines.push(`Banco: ${b.bank_name}`);
  if (b.agency) lines.push(`Agência: ${b.agency}`);
  if (b.account) lines.push(`Conta: ${b.account}`);
  if (b.holder) lines.push(`Titular: ${b.holder}`);
  if (b.alias) lines.push(`Alias: ${b.alias}`);
  return lines;
}
