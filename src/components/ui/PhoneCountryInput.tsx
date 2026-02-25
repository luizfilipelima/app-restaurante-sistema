/**
 * Input de telefone/WhatsApp com seletor de país (BR, PY, AR).
 * Exibe apenas a bandeira no trigger; dropdown permite trocar o código.
 */
import { MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/core/utils';

export type PhoneCountry = 'BR' | 'PY' | 'AR';

const COUNTRY_OPTIONS: { value: PhoneCountry; flag: string; label: string }[] = [
  { value: 'BR', flag: '🇧🇷', label: '+55 (Brasil)' },
  { value: 'PY', flag: '🇵🇾', label: '+595 (Paraguai)' },
  { value: 'AR', flag: '🇦🇷', label: '+54 (Argentina)' },
];

const PLACEHOLDERS: Record<PhoneCountry, string> = {
  BR: '(11) 99999-9999',
  PY: '981 123 456',
  AR: '11 15 1234-5678',
};

export interface PhoneCountryInputProps {
  value: string;
  country: PhoneCountry;
  onValueChange: (phone: string, country: PhoneCountry) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
  /** Se true, adiciona ícone WhatsApp no input */
  showWhatsAppIcon?: boolean;
  disabled?: boolean;
}

export function PhoneCountryInput({
  value,
  country,
  onValueChange,
  placeholder,
  id,
  className,
  inputClassName,
  showWhatsAppIcon = false,
  disabled = false,
}: PhoneCountryInputProps) {
  const placeholderToUse = placeholder ?? PLACEHOLDERS[country];
  const flag = COUNTRY_OPTIONS.find((c) => c.value === country)?.flag ?? '🇧🇷';

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={country}
        onValueChange={(v) => onValueChange(value, v as PhoneCountry)}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-[52px] h-10 shrink-0 px-2 justify-center border-input bg-background"
          title="Código do país"
        >
          <span className="text-lg leading-none">{flag}</span>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.flag} {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1 min-w-0">
        {showWhatsAppIcon && (
          <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value, country)}
          placeholder={placeholderToUse}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          className={cn(showWhatsAppIcon && 'pl-10', inputClassName)}
        />
      </div>
    </div>
  );
}
