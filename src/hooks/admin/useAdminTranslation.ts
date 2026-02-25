/**
 * useAdminTranslation
 *
 * Lightweight translation hook for the admin panel.
 * Reads the current language from Zustand (adminLanguageStore) and
 * returns a `t(key)` function that resolves dot-notated translation keys.
 *
 * Example:
 *   const { t, lang } = useAdminTranslation();
 *   t('nav.items.orders')           // "Pedidos" | "Pedidos" | "Orders"
 *   t('dashboard.kpis.revenue')     // "Faturamento" | "Facturación" | "Revenue"
 *   t('common.save')               // "Salvar alterações" | "Guardar cambios" | "Save changes"
 */

import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { adminTranslations } from '@/i18n/adminTranslations';
import type { AdminLang } from '@/i18n/adminTranslations';

export function useAdminTranslation() {
  const { lang, setLang } = useAdminLanguageStore();

  /**
   * Translates a dot-notated key.
   * Falls back to pt, then to the raw key if not found.
   * Supports {{variable}} interpolation.
   */
  function t(key: string, vars?: Record<string, string | number>): string {
    const keys = key.split('.');
    const dict = adminTranslations[lang] ?? adminTranslations.pt;

    let result: Record<string, unknown> | string | undefined = dict as Record<string, unknown>;
    for (const k of keys) {
      result = typeof result === 'object' && result !== null ? (result as Record<string, unknown>)[k] as Record<string, unknown> | string | undefined : undefined;
      if (result === undefined) break;
    }

    // Fall back to 'pt' if translation missing
    if (result === undefined) {
      let ptResult: Record<string, unknown> | string | undefined = adminTranslations.pt as Record<string, unknown>;
      for (const k of keys) {
        ptResult = typeof ptResult === 'object' && ptResult !== null ? (ptResult as Record<string, unknown>)[k] as Record<string, unknown> | string | undefined : undefined;
        if (ptResult === undefined) break;
      }
      result = ptResult;
    }

    let str = typeof result === 'string' ? result : key;

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }

    return str;
  }

  return { t, lang, setLang };
}

export type { AdminLang };
