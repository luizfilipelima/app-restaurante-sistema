/**
 * Seletor de idioma para cardápios.
 * Exibe bandeiras e nomes nativos em um dropdown elegante e discreto.
 */
import { memo } from 'react';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MenuLanguage } from '@/lib/i18n';

const LANGUAGES: { code: MenuLanguage; flag: string; label: string }[] = [
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

interface MenuLanguageSelectorProps {
  value: MenuLanguage;
  onChange: (lang: MenuLanguage) => void;
  /** Idioma nativo do restaurante (destaca na lista) */
  nativeLanguage?: MenuLanguage;
  className?: string;
}

function MenuLanguageSelector({
  value,
  onChange,
  nativeLanguage,
  className = '',
}: MenuLanguageSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 rounded-lg"
      >
        <button
          type="button"
          aria-label="Trocar idioma do cardápio"
          title="Idioma"
          className={`
            flex items-center justify-center gap-1
            h-9 min-w-[36px] px-1.5 rounded-lg
            text-muted-foreground hover:text-foreground hover:bg-muted/80
            transition-colors touch-manipulation
            ${className}
          `}
        >
          <Languages className="h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0" />
          <span className="text-sm leading-none select-none" aria-hidden>
            {LANGUAGES.find((l) => l.code === value)?.flag}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[160px]">
        {LANGUAGES.map((lang) => {
          const isSelected = value === lang.code;
          const isNative = nativeLanguage === lang.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => onChange(lang.code)}
              className="flex items-center gap-3 cursor-pointer py-2.5"
            >
              <span className="text-lg flex-shrink-0">{lang.flag}</span>
              <span className="flex-1 font-medium text-foreground">{lang.label}</span>
              {isNative && (
                <span className="text-[10px] text-muted-foreground" title="Idioma do restaurante">
                  •
                </span>
              )}
              {isSelected && (
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(MenuLanguageSelector);
