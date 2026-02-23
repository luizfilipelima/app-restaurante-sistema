/**
 * Popover compacto que combina seletor de moeda e idioma.
 * Reduz o ruído visual no header do cardápio.
 */
import { memo } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
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
}

function MenuSettingsPopover({
  currency,
  currencyOptions,
  onCurrencyChange,
  language,
  onLanguageChange,
  className = '',
}: MenuSettingsPopoverProps) {
  const hasMultipleCurrencies = currencyOptions.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 rounded-lg"
      >
        <button
          type="button"
          aria-label="Configurações (moeda e idioma)"
          title="Moeda e idioma"
          className={`
            flex items-center justify-center
            h-9 w-9 rounded-lg
            text-slate-500 hover:text-slate-700 hover:bg-slate-100/80
            transition-colors touch-manipulation flex-shrink-0
            ${className}
          `}
        >
          <SlidersHorizontal className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
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
