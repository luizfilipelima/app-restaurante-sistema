import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
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

/** URL pública do cardápio: em produção (quiero.food) usa subdomínio (slug.quiero.food), senão usa path (origin/slug). */
export function getCardapioPublicUrl(slug: string): string {
  if (!slug) return '';
  if (typeof window === 'undefined') return `https://${slug}.quiero.food`;
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  if (hostname.endsWith('quiero.food')) return `https://${slug}.quiero.food`;
  return `${origin}/${slug}`;
}

/** Gera link do WhatsApp. O número deve vir com código do país (ex: 5511999999999 ou 595981123456). */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/** Formata valor em Guaranies (Paraguai). */
export function formatGuarani(value: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' Gs.';
}

/** Normaliza telefone para número internacional (apenas dígitos). BR: +55, PY: +595. */
export function normalizePhoneWithCountryCode(phone: string, countryCode: 'BR' | 'PY'): string {
  const digits = phone.replace(/\D/g, '');
  if (countryCode === 'BR') {
    const br = digits.length <= 11 ? digits : digits.slice(-11);
    return '55' + (br.length === 11 ? br : br.padStart(11, '0'));
  }
  if (countryCode === 'PY') {
    const py = digits.length <= 9 ? digits : digits.slice(-9);
    return '595' + py.padStart(9, '0');
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
