import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from '@/locales/pt.json';
import es from '@/locales/es.json';

const STORAGE_KEY = 'menu_lang';
export type MenuLanguage = 'pt' | 'es';

function getStoredLanguage(): MenuLanguage {
  if (typeof window === 'undefined') return 'pt';
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === 'es' || stored === 'pt') return stored;
  return 'pt';
}

export function setStoredMenuLanguage(lang: MenuLanguage): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, lang);
}

export function getStoredMenuLanguage(): MenuLanguage {
  return getStoredLanguage();
}

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    es: { translation: es },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'pt',
  supportedLngs: ['pt', 'es'],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
