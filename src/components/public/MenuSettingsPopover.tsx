/**
 * Popover compacto que combina seletor de moeda e idioma.
 * Reduz o ruído visual no header do cardápio.
 */
import { memo } from 'react';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MenuLanguage } from '@/lib/i18n';
import type { CurrencyCode } from '@/lib/priceHelper';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: 'BRL',
  PYG: 'PYG',
  ARS: 'ARS',
  USD: 'USD',
};

const LANGUAGES: { code: MenuLanguage; flag: string; label: string }[] = [
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

interface MenuSettingsPopoverProps {
  /** Moeda atual */
  currency: CurrencyCode;
  /** Moedas disponíveis (só exibe seção se > 1) */
  currencyOptions: CurrencyCode[];
  baseCurrency?: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  /** Idioma atual */
  language: MenuLanguage;
  onLanguageChange: (lang: MenuLanguage) => void;
  nativeLanguage?: MenuLanguage;
  className?: string;
  /** Variante visual do trigger: white = fundo branco com sombra (padrão header cardápio) */
  variant?: 'default' | 'white';
}

function MenuSettingsPopover({
  currency,
  currencyOptions,
  onCurrencyChange,
  language,
  onLanguageChange,
  className = '',
  variant = 'default',
}: MenuSettingsPopoverProps) {
  const hasMultipleCurrencies = currencyOptions.length > 1;

  const triggerClass = variant === 'white'
    ? `flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all touch-manipulation flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] ${className}`
    : `flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 transition-colors touch-manipulation flex-shrink-0 ${className}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 rounded-xl"
      >
        <button
          type="button"
          aria-label="Idioma e moeda"
          title="Idioma e moeda"
          className={triggerClass}
        >
          <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[200px]">
        {hasMultipleCurrencies && (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-slate-500">Moeda</DropdownMenuLabel>
            <div className="flex flex-wrap gap-1 p-2">
              {currencyOptions.map((c) => {
                const isSelected = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCurrencyChange(c)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                      isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {CURRENCY_LABELS[c]}
                  </button>
                );
              })}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs font-medium text-slate-500">Idioma</DropdownMenuLabel>
        <div className="p-1">
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onLanguageChange(lang.code)}
                className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-slate-50 text-left"
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="flex-1 font-medium text-slate-800 text-sm">{lang.label}</span>
                {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(MenuSettingsPopover);
