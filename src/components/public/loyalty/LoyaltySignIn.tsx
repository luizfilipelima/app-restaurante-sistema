/**
 * Formulário para vincular nome e WhatsApp ao programa de fidelidade.
 * Exibido no cardápio quando o programa está ativo e o usuário ainda não informou os dados.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, User, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { normalizePhoneWithCountryCode } from '@/lib/core/utils';

export type PhoneCountry = 'BR' | 'PY' | 'AR';

interface LoyaltySignInProps {
  restaurantId: string;
  /** País padrão (ex: do restaurante) */
  defaultCountry?: PhoneCountry;
  onLinked: (name: string, phone: string, country: PhoneCountry) => void;
}

const COUNTRY_OPTIONS: { value: PhoneCountry; flag: string; label: string }[] = [
  { value: 'BR', flag: '🇧🇷', label: '+55 (Brasil)' },
  { value: 'PY', flag: '🇵🇾', label: '+595 (Paraguay)' },
  { value: 'AR', flag: '🇦🇷', label: '+54 (Argentina)' },
];

export default function LoyaltySignIn({
  restaurantId,
  defaultCountry = 'BR',
  onLinked,
}: LoyaltySignInProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(defaultCountry);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (!nameTrim) {
      setError(t('menu.loyalty.errorName'));
      return;
    }
    if (phoneDigits.length < 8) {
      setError(t('menu.loyalty.errorPhone'));
      return;
    }
    const normalizedPhone = normalizePhoneWithCountryCode(phone, phoneCountry);
    try {
      localStorage.setItem(`checkout_name_${restaurantId}`, nameTrim);
      localStorage.setItem(`checkout_phone_${restaurantId}`, normalizedPhone);
      localStorage.setItem(`checkout_phone_country_${restaurantId}`, phoneCountry);
    } catch { /* ignore */ }
    onLinked(nameTrim, normalizedPhone, phoneCountry);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-primary">
            {t('menu.loyalty.title')}
          </h3>
          <p className="text-xs text-primary/90 mt-0.5">
            {t('menu.loyalty.subtitle')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="loyalty-name" className="text-xs font-semibold text-muted-foreground">
          {t('checkout.yourName')}
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="loyalty-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder={t('checkout.namePlaceholder')}
            className="pl-10 h-11 bg-card border-border rounded-xl"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="loyalty-phone" className="text-xs font-semibold text-muted-foreground">
          {t('checkout.phoneLabel')}
        </Label>
        <div className="flex gap-2">
          <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as PhoneCountry)}>
            <SelectTrigger className="w-[72px] h-11 shrink-0 bg-card border-border rounded-xl px-2">
              <span className="text-lg">
                {COUNTRY_OPTIONS.find((c) => c.value === phoneCountry)?.flag ?? '🇧🇷'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.flag} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="loyalty-phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              placeholder={
                phoneCountry === 'BR' ? '(11) 99999-9999'
                : phoneCountry === 'PY' ? '981 123 456'
                : '11 1234-5678'
              }
              className="pl-10 h-11 bg-card border-border rounded-xl"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
      >
        {t('menu.loyalty.cta')}
      </Button>
    </form>
  );
}
