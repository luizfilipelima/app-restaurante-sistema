/**
 * Admin panel language store
 *
 * Stores the current admin interface language, separate from the public
 * menu language (which uses sessionStorage and i18next for the store subdomain).
 *
 * Persists to localStorage so the language is remembered across sessions.
 */

import { create } from 'zustand';
import type { AdminLang } from '@/i18n/adminTranslations';

const LS_KEY = 'quiero_panel_language';

function getInitialLang(): AdminLang {
  try {
    const stored = localStorage.getItem(LS_KEY) as AdminLang | null;
    if (stored === 'pt' || stored === 'es' || stored === 'en') return stored;
  } catch {
    // localStorage may be unavailable (SSR / incognito edge-cases)
  }
  return 'pt';
}

interface AdminLanguageState {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
}

export const useAdminLanguageStore = create<AdminLanguageState>((set) => ({
  lang: getInitialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch { /* ignore */ }
    set({ lang });
  },
}));
