import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPrice } from './priceHelper';
import type { BankAccountByCountry, PaymentBankAccountSnapshot } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CurrencyCode = 'BRL' | 'PYG' | 'ARS' | 'USD';

/** 
 * Formata valor na moeda informada usando a estratégia de armazenamento:
 * - BRL: valor vem em centavos do banco, divide por 100
 * - PYG: valor vem inteiro do banco, usa direto
 * 
 * @deprecated Use formatPrice de priceHelper.ts diretamente para melhor performance
 * Mantido para compatibilidade durante migração
 */
export function formatCurrency(value: number, currency: CurrencyCode = 'BRL'): string {
  return formatPrice(value, currency);
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

/** Gera link do WhatsApp. O número deve vir com código do país (ex: 5511999999999 ou 595981123456). */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/** Formata valor em Guaranies (Paraguai). Prefira formatCurrency(value, 'PYG'). */
export function formatGuarani(value: number): string {
  return formatCurrency(value, 'PYG');
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
