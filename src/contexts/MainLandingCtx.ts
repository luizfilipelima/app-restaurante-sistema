/**
 * Contexto da Landing Page principal (quiero.food / rota "/").
 * Fornece o conteúdo do banco e as cores da marca para todos os
 * componentes da landing sem prop-drilling.
 */

import { createContext, useContext } from 'react';
import type { LandingContent } from '@/hooks/queries/useLandingPageContent';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MainLandingCtxValue {
  c: LandingContent;
  /** Cor primária da marca em hex — default #ea580c (orange-600) */
  primaryColor: string;
  /** URL do logo */
  logoUrl: string;
  /** Link WhatsApp */
  waLink: string;
  /** Link da plataforma */
  appLink: string;
}

// ─── Valores padrão ───────────────────────────────────────────────────────────

export const MAIN_DEFAULTS: Omit<MainLandingCtxValue, 'c'> = {
  primaryColor: '#ea580c',
  logoUrl:      '/quierofood-logo-f.svg',
  waLink:       'https://wa.me/5575992776610?text=Hola%20Filipe%2C%20me%20gustaria%20testar%20gratis%20el%20sistema%20Quiero%20Food',
  appLink:      'https://app.quiero.food',
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const MainLandingCtx = createContext<MainLandingCtxValue>({
  c: {},
  ...MAIN_DEFAULTS,
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMainLanding() {
  return useContext(MainLandingCtx);
}

// ─── Helper para ler valor de uma seção main_* ────────────────────────────────

export function mlc(
  c: LandingContent,
  section: `main_${string}`,
  key: string,
  fallback = '',
): string {
  return c[section]?.[key] ?? fallback;
}

// ─── Helper para fazer parse de JSON com fallback ─────────────────────────────

export function mlcJson<T>(
  c: LandingContent,
  section: `main_${string}`,
  key: string,
  fallback: T,
): T {
  try {
    const raw = c[section]?.[key];
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
