import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { invalidatePublicMenuCache } from '@/lib/invalidatePublicCache';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { DayKey, PrintPaperWidth, type BankAccountByCountry, type PrintSettingsBySector, type SectorPrintSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { toast } from '@/hooks/use-toast';
import {
  Save, Upload, Loader2, Clock, Instagram, Printer,
  Phone, Globe, ImageIcon, CheckCircle2, XCircle,
  Sun, AlarmClock, X, Wifi, Languages, Store,
  Users, ExternalLink, Link2,
  MessageCircle, AtSign, Repeat, CreditCard, Landmark, QrCode,
} from 'lucide-react';
import { useRestaurant } from '@/hooks/queries';
import { useCanAccess } from '@/hooks/useUserRole';
import RestaurantUsersPanel from '@/components/admin/RestaurantUsersPanel';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda',  short: 'Seg' },
  { key: 'tue', label: 'Terça',    short: 'Ter' },
  { key: 'wed', label: 'Quarta',   short: 'Qua' },
  { key: 'thu', label: 'Quinta',   short: 'Qui' },
  { key: 'fri', label: 'Sexta',    short: 'Sex' },
  { key: 'sat', label: 'Sábado',   short: 'Sáb' },
  { key: 'sun', label: 'Domingo',  short: 'Dom' },
];

type PhoneCountry = 'BR' | 'PY' | 'AR';
type CurrencyCode = 'BRL' | 'PYG' | 'ARS' | 'USD';
type CardapioLanguage = 'pt' | 'es' | 'en';
type PanelLanguage = 'pt' | 'es' | 'en';

const PHONE_COUNTRIES: { value: PhoneCountry; label: string; placeholder: string }[] = [
  { value: 'BR', label: '🇧🇷 Brasil (+55)',      placeholder: '(11) 99999-9999' },
  { value: 'PY', label: '🇵🇾 Paraguai (+595)',   placeholder: '981 123 456' },
  { value: 'AR', label: '🇦🇷 Argentina (+54)',   placeholder: '011 15 1234-5678' },
];

const CURRENCIES: { value: CurrencyCode; label: string; sub: string }[] = [
  { value: 'BRL', label: '🇧🇷 Real',          sub: 'R$' },
  { value: 'PYG', label: '🇵🇾 Guaraní',       sub: 'Gs.' },
  { value: 'ARS', label: '🇦🇷 Peso Argentino', sub: 'ARS $' },
  { value: 'USD', label: '🌎 Dólar',           sub: 'US$' },
];

const CARDAPIO_LANGS: { value: CardapioLanguage; label: string }[] = [
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'es', label: '🇦🇷 Español' },
  { value: 'en', label: '🇺🇸 English' },
];

const PANEL_LANGS: { value: PanelLanguage; label: string }[] = [
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'es', label: '🇦🇷 Español' },
  { value: 'en', label: '🇺🇸 English' },
];

const SECTOR_KEYS = ['delivery', 'table', 'pickup', 'buffet'] as const;
type SectorKey = typeof SECTOR_KEYS[number];

function defaultSectorSettings(): PrintSettingsBySector {
  const empty: SectorPrintSettings = { waiter_tip_enabled: false, waiter_tip_pct: 10 };
  return SECTOR_KEYS.reduce((acc, k) => ({ ...acc, [k]: { ...empty } }), {} as PrintSettingsBySector);
}

function parseExchangeRates(raw: unknown): { pyg_per_brl: number; ars_per_brl: number; usd_per_brl: number } {
  if (!raw || typeof raw !== 'object') return { pyg_per_brl: 3600, ars_per_brl: 1150, usd_per_brl: 0.18 };
  const o = raw as Record<string, unknown>;
  return {
    pyg_per_brl: Math.max(1, Number(o.pyg_per_brl) || 3600),
    ars_per_brl: Math.max(1, Number(o.ars_per_brl) || 1150),
    usd_per_brl: Math.max(0.01, Number(o.usd_per_brl) || 0.18),
  };
}

function parseBankAccount(raw: unknown): BankAccountByCountry {
  if (!raw || typeof raw !== 'object') return { pyg: {}, ars: {} };
  const o = raw as Record<string, unknown>;
  const hasLegacy = 'bank_name' in o || 'agency' in o || 'account' in o || 'holder' in o;
  if (hasLegacy) {
    return {
      pyg: {},
      ars: {
        bank_name: String(o.bank_name ?? ''),
        agency: String(o.agency ?? ''),
        account: String(o.account ?? ''),
        holder: String(o.holder ?? ''),
      },
    };
  }
  const pygRaw = o.pyg;
  const arsRaw = o.ars;
  const pyg = pygRaw && typeof pygRaw === 'object' && !Array.isArray(pygRaw)
    ? {
        bank_name: String((pygRaw as Record<string, unknown>).bank_name ?? ''),
        holder: String((pygRaw as Record<string, unknown>).holder ?? ''),
        alias: String((pygRaw as Record<string, unknown>).alias ?? ''),
      }
    : {};
  const ars = arsRaw && typeof arsRaw === 'object' && !Array.isArray(arsRaw)
    ? {
        bank_name: String((arsRaw as Record<string, unknown>).bank_name ?? ''),
        agency: String((arsRaw as Record<string, unknown>).agency ?? ''),
        account: String((arsRaw as Record<string, unknown>).account ?? ''),
        holder: String((arsRaw as Record<string, unknown>).holder ?? ''),
      }
    : {};
  return { pyg, ars };
}

function parseSectorSettings(raw: unknown): PrintSettingsBySector {
  if (!raw || typeof raw !== 'object') return defaultSectorSettings();
  const obj = raw as Record<string, unknown>;
  const out = defaultSectorSettings();
  for (const k of SECTOR_KEYS) {
    const v = obj[k];
    if (v && typeof v === 'object' && 'waiter_tip_enabled' in v && 'waiter_tip_pct' in v) {
      const s = v as { waiter_tip_enabled: boolean; waiter_tip_pct: number };
      out[k] = {
        waiter_tip_enabled: !!s.waiter_tip_enabled,
        waiter_tip_pct: Math.max(0, Math.min(100, Number(s.waiter_tip_pct) || 10)),
      };
    }
  }
  return out;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function getPhonePlaceholder(country: PhoneCountry): string {
  return PHONE_COUNTRIES.find(c => c.value === country)?.placeholder ?? '';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

const COUNTRY_CODES: Record<PhoneCountry, string> = { BR: '+55', PY: '+595', AR: '+54' };

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 ${
        checked ? 'bg-[#F87116]' : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label, description, checked, onChange, icon: Icon,
  activeColor = 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  inactiveColor = 'bg-muted/50 border-border',
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ElementType;
  activeColor?: string;
  inactiveColor?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${checked ? activeColor : inactiveColor}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <Icon
            className={`flex-shrink-0 mt-0.5 ${checked ? 'text-emerald-600' : 'text-muted-foreground'}`}
            style={{ height: 15, width: 15 }}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
      {children}
    </Label>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

// ─── SaveButton ───────────────────────────────────────────────────────────────

function SaveButton({ saving, onClick, label, savingLabel }: {
  saving: boolean;
  onClick: () => void;
  label?: string;
  savingLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="brand"
      disabled={saving}
      onClick={onClick}
      className="gap-2 px-5 py-2.5 rounded-xl font-semibold"
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {savingLabel ?? 'Salvando…'}
        </>
      ) : (
        <>
          <Save className="h-4 w-4" />
          {label ?? 'Salvar alterações'}
        </>
      )}
    </Button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/** Roles que podem ver a gestão de usuários: proprietário e super-admin */
const ROLES_USERS_MANAGEMENT = ['owner', 'restaurant_admin', 'super_admin'] as const;

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const restaurantId = useAdminRestaurantId();
  const { t }        = useAdminTranslation();
  const canAccessUsers = useCanAccess([...ROLES_USERS_MANAGEMENT]);
  const { data: restaurant } = useRestaurant(restaurantId);
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  const { lang: panelLanguage, setLang: setStoreLang } = useAdminLanguageStore();
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state mirrors the store so the Select shows correctly
  const [panelLangLocal, setPanelLangLocal] = useState<PanelLanguage>(panelLanguage);

  const [formData, setFormData] = useState({
    name:                    '',
    slug:                    '',
    phone:                   '',
    whatsapp:                '',
    phone_country:           'BR' as PhoneCountry,
    currency:                'BRL' as CurrencyCode,
    language:                'pt' as CardapioLanguage,
    menu_display_mode:       'default' as 'default' | 'categories_first',
    instagram_url:           '',
    logo:                    '',
    is_manually_closed:      false,
    always_open:             false,
    opening_hours:           {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width:       '80mm' as PrintPaperWidth,
    print_settings_by_sector: defaultSectorSettings(),
    exchange_rates:          { pyg_per_brl: 3600, ars_per_brl: 1150, usd_per_brl: 0.18 },
    payment_currencies:      ['BRL', 'PYG'] as string[],
    pix_key:                 '',
    pix_key_type:            'random' as 'cpf' | 'email' | 'random',
    bank_account:            { pyg: {}, ars: {} } as BankAccountByCountry,
  });

  const [bankCountry, setBankCountry] = useState<'pyg' | 'ars'>('pyg');

  const set = <K extends keyof typeof formData>(k: K, v: (typeof formData)[K]) =>
    setFormData(f => ({ ...f, [k]: v }));

  const hashTab = location.hash === '#cambio' ? 'cambio' : null;
  const [activeTab, setActiveTab] = useState<string>(hashTab || 'perfil');
  useEffect(() => {
    if (hashTab) setActiveTab(hashTab);
  }, [hashTab]);

  useEffect(() => {
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  const loadRestaurant = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants').select('*').eq('id', restaurantId).single();
      if (error) throw error;
      const hours = (data.opening_hours || {}) as Record<DayKey, { open: string; close: string } | null>;

      const rawCurrency = data.currency as string;
      const validCurrencies: CurrencyCode[] = ['BRL', 'PYG', 'ARS', 'USD'];
      const currency: CurrencyCode = validCurrencies.includes(rawCurrency as CurrencyCode)
        ? (rawCurrency as CurrencyCode) : 'BRL';

      const rawLanguage = data.language as string;
      const validLanguages: CardapioLanguage[] = ['pt', 'es', 'en'];
      const language: CardapioLanguage = validLanguages.includes(rawLanguage as CardapioLanguage)
        ? (rawLanguage as CardapioLanguage) : 'pt';

      const rawMenuMode = data.menu_display_mode as string;
      const menu_display_mode: 'default' | 'categories_first' = (rawMenuMode === 'categories_first' || rawMenuMode === 'default')
        ? rawMenuMode : 'default';

      const rawCountry = data.phone_country as string;
      const validCountries: PhoneCountry[] = ['BR', 'PY', 'AR'];
      const phone_country: PhoneCountry = validCountries.includes(rawCountry as PhoneCountry)
        ? (rawCountry as PhoneCountry) : 'BR';

      setFormData({
        name:                    data.name              || '',
        slug:                    data.slug              || '',
        phone:                   data.phone             || '',
        whatsapp:                data.whatsapp          || '',
        phone_country,
        currency,
        language,
        menu_display_mode,
        instagram_url:           data.instagram_url    || '',
        logo:                    data.logo             || '',
        is_manually_closed:      !!data.is_manually_closed,
        always_open:             !!data.always_open,
        opening_hours:           DAYS.reduce(
          (acc, d) => ({ ...acc, [d.key]: hours[d.key] || null }),
          {} as Record<DayKey, { open: string; close: string } | null>
        ),
        print_auto_on_new_order: !!data.print_auto_on_new_order,
        print_paper_width:       data.print_paper_width === '58mm' ? '58mm' : '80mm',
        print_settings_by_sector: parseSectorSettings(data.print_settings_by_sector),
        exchange_rates:          parseExchangeRates(data.exchange_rates),
        payment_currencies:      Array.isArray(data.payment_currencies) && data.payment_currencies.length > 0
          ? data.payment_currencies
          : ['BRL', 'PYG'],
        pix_key:                 data.pix_key ?? '',
        pix_key_type:            (['cpf', 'email', 'random'].includes(data.pix_key_type) ? data.pix_key_type : 'random') as 'cpf' | 'email' | 'random',
        bank_account:            parseBankAccount(data.bank_account),
      });
    } catch (err) {
      console.error('Erro ao carregar restaurante:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!restaurantId) return;
    try {
      setSaving(true);
      const updatePayload: Record<string, unknown> = {
        name:                    formData.name,
        slug:                    formData.slug || undefined,
        phone:                   formData.phone,
        whatsapp:                formData.whatsapp,
        phone_country:           formData.phone_country,
        currency:                formData.currency,
        language:                formData.language,
        menu_display_mode:       formData.menu_display_mode,
        instagram_url:           formData.instagram_url || null,
        logo:                    formData.logo,
        is_manually_closed:      formData.is_manually_closed,
        always_open:             formData.always_open,
        opening_hours:           formData.opening_hours,
        print_auto_on_new_order: formData.print_auto_on_new_order,
        print_paper_width:       formData.print_paper_width,
        print_settings_by_sector: formData.print_settings_by_sector,
        exchange_rates:          formData.exchange_rates,
        payment_currencies:      formData.payment_currencies,
        pix_key:                 formData.pix_key?.trim() || null,
        bank_account:            (() => {
          const { pyg, ars } = formData.bank_account;
          const hasPyg = !!(pyg?.bank_name || pyg?.holder || pyg?.alias);
          const hasArs = !!(ars?.bank_name || ars?.agency || ars?.account || ars?.holder);
          if (!hasPyg && !hasArs) return null;
          return { pyg: hasPyg ? pyg : undefined, ars: hasArs ? ars : undefined };
        })(),
        updated_at:              new Date().toISOString(),
      };
      const { error } = await supabase.from('restaurants').update(updatePayload).eq('id', restaurantId);
      if (error) throw error;
      invalidatePublicMenuCache(queryClient, formData.slug || undefined);
      // Persiste o idioma do painel via store (localStorage + Zustand → reatividade imediata)
      setStoreLang(panelLangLocal);
      toast({ title: '✅ ' + t('settings.title') + ' — ' + t('common.success') });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      const msg = err instanceof Error ? err.message : '';
      toast({
        title: 'Erro ao salvar configurações',
        description: msg || undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#F87116]" />
      </div>
    );
  }

  const phonePlaceholder = getPhonePlaceholder(formData.phone_country);

  return (
    <div className="w-full space-y-6 pb-10">

      {/* ── Cabeçalho ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('settings.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('settings.subtitle')}
          </p>
        </div>
        <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab bar — scroll horizontal em mobile, row único em desktop */}
        <div className="relative mb-6">
          <TabsList className="
            flex w-full h-auto p-0 bg-transparent
            overflow-x-auto scrollbar-hide
            border-b border-border rounded-none gap-0
          ">
            {[
              { value: 'perfil',       icon: Store,   label: t('settings.tabs.profile')   },
              { value: 'regional',     icon: Globe,   label: t('settings.tabs.regional')  },
              { value: 'contato',      icon: Phone,   label: t('settings.tabs.contact')   },
              { value: 'pagamentos',   icon: CreditCard, label: 'PIX e Transferência'     },
              { value: 'horarios',     icon: Clock,   label: 'Horários'                   },
              { value: 'impressao',    icon: Printer, label: 'Impressão'                  },
              { value: 'cambio',       icon: Repeat,  label: 'Câmbio'                     },
              ...(canAccessUsers ? [{ value: 'usuarios', icon: Users, label: t('settings.tabs.users') }] : []),
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="
                  flex-shrink-0 flex items-center gap-1.5
                  px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap
                  bg-transparent rounded-none border-b-2 border-transparent -mb-px
                  text-muted-foreground
                  hover:text-foreground hover:bg-muted/40
                  data-[state=active]:bg-transparent
                  data-[state=active]:text-[#F87116]
                  data-[state=active]:border-b-[#F87116]
                  transition-all
                "
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 1 — Perfil do Negócio
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="perfil" className="mt-0 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* ── Logo — drop zone ── */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">

              {/* Cabeçalho */}
              <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-border/60">
                <div className="h-8 w-8 rounded-lg bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-4 w-4 text-[#F87116]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Logo</p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG ou WebP</p>
                </div>
              </div>

              {/* Zona de drop / preview */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="sr-only"
                disabled={logoUploading || !restaurantId}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !restaurantId) return;
                  setLogoUploading(true);
                  try {
                    const url = await uploadRestaurantLogo(restaurantId, file);
                    set('logo', url);
                    toast({ title: 'Logo enviada!', description: 'Upload concluído.' });
                  } catch (err) {
                    toast({ title: 'Erro ao enviar logo', description: err instanceof Error ? err.message : 'Tente outro arquivo.', variant: 'destructive' });
                  } finally {
                    setLogoUploading(false);
                    e.target.value = '';
                  }
                }}
              />

              <button
                type="button"
                disabled={logoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 p-6 group hover:bg-muted/30 transition-colors disabled:pointer-events-none text-center"
              >
                {formData.logo ? (
                  <>
                    <div className="relative">
                      <img
                        src={formData.logo}
                        alt="Logo"
                        className="h-20 w-20 rounded-2xl object-cover border-2 border-border shadow-md group-hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Upload className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground group-hover:text-[#F87116] transition-colors">
                      Clique para trocar
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-border group-hover:border-[#F87116] bg-muted/50 flex flex-col items-center justify-center gap-1.5 transition-colors">
                      {logoUploading
                        ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        : <Upload className="h-6 w-6 text-muted-foreground group-hover:text-[#F87116] transition-colors" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-[#F87116] transition-colors">
                        {logoUploading ? 'Enviando…' : 'Clique para fazer upload'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Recomendado: 512 × 512 px</p>
                    </div>
                  </>
                )}
              </button>

              {/* Footer — URL ou remover */}
              <div className="border-t border-border/60 bg-muted/20 px-3 py-2.5 flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="url"
                  value={formData.logo}
                  onChange={(e) => set('logo', e.target.value)}
                  placeholder="Ou cole uma URL de imagem…"
                  className="flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
                />
                {formData.logo && (
                  <button
                    type="button"
                    onClick={() => set('logo', '')}
                    className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Informações do negócio ── */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Store className="h-[18px] w-[18px] text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Perfil do Negócio</h2>
                  <p className="text-[11px] text-muted-foreground">Identidade pública do restaurante</p>
                </div>
              </div>

              {/* Nome */}
              <FieldGroup>
                <SectionLabel>Nome do Restaurante</SectionLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex.: Pizzaria do João"
                  required
                  className="font-medium text-base"
                />
              </FieldGroup>

              {/* Slug */}
              <FieldGroup>
                <SectionLabel>Link público (slug)</SectionLabel>
                <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                  <span className="flex items-center px-3 bg-muted text-[11px] text-muted-foreground whitespace-nowrap border-r border-border select-none font-mono">
                    quiero.food/
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => set('slug', slugify(e.target.value))}
                    placeholder="meu-restaurante"
                    className="flex-1 px-3 py-2 text-sm font-mono bg-background outline-none min-w-0 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <span>⚠</span> Alterar o slug muda o link público do cardápio. Comunique clientes antes de mudar.
                </p>
                {formData.slug && (
                  <a
                    href={`https://quiero.food/${formData.slug}/cardapio`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-[#F87116] hover:underline font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    quiero.food/{formData.slug}/cardapio
                  </a>
                )}
              </FieldGroup>
            </div>
          </div>

          {/* Rodapé salvar */}
          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 2 — Regionalização
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="regional" className="mt-0 space-y-5">

          {/* Seletores principais — 2 colunas em desktop */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Globe className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('settings.regional.title')}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {t('settings.regional.subtitle')}
                </p>
              </div>
            </div>

            {/* Grid 2 cols em sm e 4 em xl, para telas largas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-5">

              {/* Moeda */}
              <FieldGroup>
                <SectionLabel>{t('settings.regional.currency')}</SectionLabel>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => set('currency', v as CurrencyCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span>{c.label}</span>
                        <span className="ml-1.5 text-[11px] text-muted-foreground">({c.sub})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t('settings.regional.currencyDesc')}
                </p>
              </FieldGroup>

              {/* País de origem */}
              <FieldGroup>
                <SectionLabel>{t('settings.regional.country')}</SectionLabel>
                <Select
                  value={formData.phone_country}
                  onValueChange={(v) => set('phone_country', v as PhoneCountry)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_COUNTRIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t('settings.regional.countryDesc')}
                </p>
              </FieldGroup>

              {/* Idioma do cardápio */}
              <FieldGroup>
                <SectionLabel>{t('settings.regional.menuLang')}</SectionLabel>
                <Select
                  value={formData.language}
                  onValueChange={(v) => set('language', v as CardapioLanguage)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARDAPIO_LANGS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t('settings.regional.menuLangDesc')}
                </p>
              </FieldGroup>

              {/* Modo de exibição do cardápio */}
              <FieldGroup>
                <SectionLabel>Primeira tela do cardápio</SectionLabel>
                <Select
                  value={formData.menu_display_mode}
                  onValueChange={(v) => set('menu_display_mode', v as 'default' | 'categories_first')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão (categorias em pills + produtos)</SelectItem>
                    <SelectItem value="categories_first">Categorias expandidas (cards com imagens primeiro)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Se &quot;Categorias expandidas&quot;, o cliente vê os cards de categorias primeiro; ao clicar, abre a página com os produtos.
                </p>
              </FieldGroup>

              {/* Idioma do painel — atualiza o painel instantaneamente */}
              <FieldGroup>
                <SectionLabel>{t('settings.regional.panelLang')}</SectionLabel>
                <Select
                  value={panelLangLocal}
                  onValueChange={(v) => {
                    const lang = v as PanelLanguage;
                    setPanelLangLocal(lang);
                    // Atualiza o Zustand → todo o painel re-renderiza imediatamente
                    setStoreLang(lang);
                    toast({
                      title: lang === 'pt' ? '🇧🇷 Idioma do painel atualizado'
                           : lang === 'es' ? '🇦🇷 Idioma del panel actualizado'
                           : '🇺🇸 Panel language updated',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PANEL_LANGS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {t('settings.regional.panelLangDesc')}
                </p>
              </FieldGroup>
            </div>
          </div>

          {/* Preview de formatação de preços */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Languages className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('settings.regional.formatPreview')}</h2>
                <p className="text-[11px] text-muted-foreground">{t('settings.regional.formatPreviewDesc')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1500, 9900, 25000, 100000].map(val => {
                let display = '';
                if (formData.currency === 'BRL') display = `R$ ${(val / 100).toFixed(2).replace('.', ',')}`;
                else if (formData.currency === 'PYG') display = `Gs. ${val.toLocaleString('es-PY')}`;
                else if (formData.currency === 'ARS') display = `$ ${(val / 100).toFixed(2).replace('.', ',')}`;
                else display = `$ ${(val / 100).toFixed(2)}`;
                return (
                  <div key={val} className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{t('settings.regional.bankValue')}: {val}</p>
                    <p className="text-sm font-bold text-foreground">{display}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 3 — Canais e Contato
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="contato" className="mt-0 space-y-4">

          {/* ── Telefone & WhatsApp ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Phone className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Números de Contato</h2>
                <p className="text-[11px] text-muted-foreground">
                  Usados para receber pedidos e comunicação com clientes
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Telefone */}
                <FieldGroup>
                  <SectionLabel>Telefone</SectionLabel>
                  <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center px-3 bg-muted text-xs text-muted-foreground border-r border-border select-none font-mono flex-shrink-0">
                      {COUNTRY_CODES[formData.phone_country]}
                    </span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder={phonePlaceholder}
                      className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0 text-foreground placeholder:text-muted-foreground/50"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Exibido no cardápio para clientes</p>
                </FieldGroup>

                {/* WhatsApp */}
                <FieldGroup>
                  <SectionLabel>WhatsApp</SectionLabel>
                  <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center gap-1 px-3 bg-emerald-50 text-emerald-700 text-xs border-r border-border select-none font-semibold flex-shrink-0">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {COUNTRY_CODES[formData.phone_country]}
                    </span>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => set('whatsapp', e.target.value)}
                      placeholder={phonePlaceholder}
                      className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0 text-foreground placeholder:text-muted-foreground/50"
                      required
                    />
                  </div>
                  {formData.whatsapp && (
                    <a
                      href={`https://wa.me/${COUNTRY_CODES[formData.phone_country].replace('+', '')}${formData.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 hover:underline font-medium"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Testar link do WhatsApp
                    </a>
                  )}
                </FieldGroup>
              </div>

              {/* Info */}
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground flex items-start gap-2.5">
                <Wifi className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                <p>
                  O WhatsApp precisa estar ativo no celular. O prefixo de país é definido na aba <strong>Regional</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* ── Redes Sociais ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Instagram className="h-[18px] w-[18px] text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Redes Sociais</h2>
                <p className="text-[11px] text-muted-foreground">Link exibido no rodapé do cardápio</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <FieldGroup>
                <SectionLabel>Instagram</SectionLabel>
                <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex items-center px-3 bg-muted text-xs text-muted-foreground border-r border-border select-none font-mono flex-shrink-0">
                    <AtSign className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    value={formData.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '').replace(/\/$/, '')}
                    onChange={(e) => {
                      const handle = e.target.value.replace(/^@/, '').trim();
                      set('instagram_url', handle ? `https://instagram.com/${handle}` : '');
                    }}
                    placeholder="seurestaurante"
                    className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                {formData.instagram_url && (
                  <a
                    href={formData.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-pink-600 hover:underline font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {formData.instagram_url}
                  </a>
                )}
              </FieldGroup>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 3b — PIX e Transferência (dados para o cliente enviar o pagamento)
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="pagamentos" className="mt-0 space-y-5">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <QrCode className="h-[18px] w-[18px] text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Chave PIX do restaurante</h2>
                <p className="text-[11px] text-muted-foreground">
                  Onde o cliente envia o pagamento quando escolhe PIX. Exibido no checkout e rastreamento do pedido.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <FieldGroup>
                <SectionLabel>Tipo da chave PIX</SectionLabel>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Selecione o tipo da chave que você usa para receber pagamentos.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'cpf' as const, label: 'CPF/CNPJ' },
                    { value: 'email' as const, label: 'E-mail' },
                    { value: 'random' as const, label: 'Chave aleatória' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('pix_key_type', value)}
                      className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        formData.pix_key_type === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:border-primary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FieldGroup>
              <FieldGroup>
                <SectionLabel>Chave PIX</SectionLabel>
                <Input
                  value={formData.pix_key}
                  onChange={(e) => set('pix_key', e.target.value)}
                  placeholder={
                    formData.pix_key_type === 'cpf'
                      ? 'Ex: 123.456.789-00 ou 12.345.678/0001-00'
                      : formData.pix_key_type === 'email'
                        ? 'Ex: contato@restaurante.com'
                        : 'Ex: chave aleatória (36 caracteres)'
                  }
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  A chave será exibida ao cliente no checkout e no rastreamento do pedido.
                </p>
              </FieldGroup>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Landmark className="h-[18px] w-[18px] text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Dados para transferência bancária</h2>
                <p className="text-[11px] text-muted-foreground">
                  Configure os dados por país. Guaraní (PYG) usa Banco, Titular e Alias; Peso Argentino (ARS) usa Banco, Agência, Conta e Titular.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">País</Label>
                <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setBankCountry('pyg')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      bankCountry === 'pyg'
                        ? 'bg-[#F87116] text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title="Paraguai (Guaraní)"
                  >
                    <span className="text-lg" aria-hidden>🇵🇾</span>
                    <span className="sr-only">Paraguai (Guaraní)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankCountry('ars')}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      bankCountry === 'ars'
                        ? 'bg-[#F87116] text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title="Argentina (Peso)"
                  >
                    <span className="text-lg" aria-hidden>🇦🇷</span>
                    <span className="sr-only">Argentina (Peso Argentino)</span>
                  </button>
                </div>
              </div>
              {bankCountry === 'pyg' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldGroup>
                    <SectionLabel>Banco</SectionLabel>
                    <Input
                      value={formData.bank_account.pyg?.bank_name ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        pyg: { ...formData.bank_account.pyg, bank_name: e.target.value },
                      })}
                      placeholder="Ex: Banco Continental"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <SectionLabel>Titular</SectionLabel>
                    <Input
                      value={formData.bank_account.pyg?.holder ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        pyg: { ...formData.bank_account.pyg, holder: e.target.value },
                      })}
                      placeholder="Nome do titular"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <SectionLabel>Alias</SectionLabel>
                    <Input
                      value={formData.bank_account.pyg?.alias ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        pyg: { ...formData.bank_account.pyg, alias: e.target.value },
                      })}
                      placeholder="Ex: MEU.ALIAS.CBU"
                    />
                  </FieldGroup>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup>
                    <SectionLabel>Banco</SectionLabel>
                    <Input
                      value={formData.bank_account.ars?.bank_name ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        ars: { ...formData.bank_account.ars, bank_name: e.target.value },
                      })}
                      placeholder="Ex: Banco Galicia"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <SectionLabel>Agência</SectionLabel>
                    <Input
                      value={formData.bank_account.ars?.agency ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        ars: { ...formData.bank_account.ars, agency: e.target.value },
                      })}
                      placeholder="Ex: 1234"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <SectionLabel>Conta</SectionLabel>
                    <Input
                      value={formData.bank_account.ars?.account ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        ars: { ...formData.bank_account.ars, account: e.target.value },
                      })}
                      placeholder="Ex: 12345-6"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <SectionLabel>Titular</SectionLabel>
                    <Input
                      value={formData.bank_account.ars?.holder ?? ''}
                      onChange={(e) => set('bank_account', {
                        ...formData.bank_account,
                        ars: { ...formData.bank_account.ars, holder: e.target.value },
                      })}
                      placeholder="Nome do titular da conta"
                    />
                  </FieldGroup>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 4 — Horários de Funcionamento
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="horarios" className="mt-0 space-y-5">

          {/* Status rápido — toggles no topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              label="Sempre aberto (24h)"
              description="Ignora os horários abaixo por dia."
              checked={formData.always_open}
              onChange={(v) => set('always_open', v)}
              icon={Sun}
              activeColor="bg-emerald-50 border-emerald-200"
            />
            <ToggleRow
              label="Fechado agora (manual)"
              description="Força status fechado independente do horário."
              checked={formData.is_manually_closed}
              onChange={(v) => set('is_manually_closed', v)}
              icon={XCircle}
              activeColor="bg-red-50 border-red-200"
            />
          </div>

          {/* Grade de horários */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Horários por dia da semana</h2>
                <p className="text-[11px] text-muted-foreground">
                  {formData.always_open
                    ? 'Ignorados — estabelecimento definido como sempre aberto.'
                    : 'Defina abertura e fechamento por dia da semana.'}
                </p>
              </div>
            </div>

            <div className={`space-y-1.5 ${formData.always_open ? 'opacity-40 pointer-events-none select-none' : ''}`}>
              {DAYS.map(({ key, label, short }) => {
                const slot = formData.opening_hours[key];
                const isClosed = !slot;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-colors ${
                      isClosed ? 'bg-muted/40 border-border' : 'bg-card border-border'
                    }`}
                  >
                    <div className="w-16 flex-shrink-0">
                      <span className={`text-xs font-semibold hidden sm:block ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
                      <span className={`text-xs font-semibold sm:hidden ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>{short}</span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 w-24 select-none">
                      <input
                        type="checkbox"
                        checked={isClosed}
                        onChange={(e) => {
                          const next = { ...formData.opening_hours };
                          next[key] = e.target.checked ? null : { open: '11:00', close: '23:00' };
                          set('opening_hours', next);
                        }}
                        className="h-3 w-3 rounded accent-slate-400"
                      />
                      <span className={`text-[10px] font-semibold uppercase tracking-wide flex items-center gap-0.5 ${
                        isClosed ? 'text-muted-foreground' : 'text-emerald-600'
                      }`}>
                        {isClosed
                          ? <><XCircle style={{ height: 11, width: 11 }} /> Fechado</>
                          : <><CheckCircle2 style={{ height: 11, width: 11 }} /> Aberto</>
                        }
                      </span>
                    </label>

                    {!isClosed ? (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Input
                          type="time"
                          value={slot?.open || '11:00'}
                          onChange={(e) => {
                            const next = { ...formData.opening_hours };
                            next[key] = { open: e.target.value, close: next[key]?.close || '23:00' };
                            set('opening_hours', next);
                          }}
                          className="h-8 w-[7rem] text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground flex-shrink-0">–</span>
                        <Input
                          type="time"
                          value={slot?.close || '23:00'}
                          onChange={(e) => {
                            const next = { ...formData.opening_hours };
                            next[key] = { open: next[key]?.open || '11:00', close: e.target.value };
                            set('opening_hours', next);
                          }}
                          className="h-8 w-[7rem] text-xs text-center"
                        />
                      </div>
                    ) : (
                      <div className="ml-auto">
                        <span className="text-[10px] text-muted-foreground italic">Sem atendimento</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 5 — Impressão
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="impressao" className="mt-0 space-y-5">

          {/* Config geral de impressão */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Printer className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Configurações de Impressão</h2>
                <p className="text-[11px] text-muted-foreground">
                  Cupom não fiscal para impressoras térmicas via navegador
                </p>
              </div>
            </div>

            <ToggleRow
              label="Impressão automática"
              description="Abre janela de impressão ao receber novo pedido."
              checked={formData.print_auto_on_new_order}
              onChange={(v) => set('print_auto_on_new_order', v)}
              icon={AlarmClock}
            />

            <FieldGroup>
              <SectionLabel>{t('settings.operation.paperWidth')}</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {(['58mm', '80mm'] as PrintPaperWidth[]).map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set('print_paper_width', w)}
                    className={`flex items-center gap-3 py-3.5 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      formData.print_paper_width === w
                        ? 'border-[#F87116] bg-orange-50 text-[#F87116]'
                        : 'border-border bg-background text-muted-foreground hover:border-slate-300'
                    }`}
                  >
                    <Printer className="h-4 w-4 flex-shrink-0" />
                    <div className="text-left">
                      <div>{w}</div>
                      <div className="text-[10px] font-normal mt-0.5">
                        {w === '58mm' ? t('settings.operation.narrow') : t('settings.operation.standard')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </FieldGroup>
          </div>

          {/* Impressão por setor — taxa de garçom por canal */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Printer className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('settings.operation.printBySector')}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {t('settings.operation.printBySectorDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECTOR_KEYS.map((sector) => {
                const sectorLabels: Record<SectorKey, string> = {
                  delivery: t('settings.operation.sectorDelivery'),
                  table:    t('settings.operation.sectorTable'),
                  pickup:   t('settings.operation.sectorPickup'),
                  buffet:   t('settings.operation.sectorBuffet'),
                };
                const sectorLabel = sectorLabels[sector];
                const cfg = formData.print_settings_by_sector[sector] ?? { waiter_tip_enabled: false, waiter_tip_pct: 10 };
                const enabled = cfg.waiter_tip_enabled;
                const pct = cfg.waiter_tip_pct;
                return (
                  <div
                    key={sector}
                    className={`rounded-xl border p-4 transition-colors ${
                      enabled ? 'bg-orange-50/50 border-orange-200' : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-foreground">{sectorLabel}</span>
                      <Toggle
                        checked={enabled}
                        onChange={(v) => {
                          const next = { ...formData.print_settings_by_sector };
                          next[sector] = { ...cfg, waiter_tip_enabled: v };
                          set('print_settings_by_sector', next);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground shrink-0">{t('settings.operation.waiterTipPct')}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          const next = { ...formData.print_settings_by_sector };
                          next[sector] = { ...cfg, waiter_tip_pct: v };
                          set('print_settings_by_sector', next);
                        }}
                        className="h-8 w-16 text-xs"
                        disabled={!enabled}
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 5b — Câmbio
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="cambio" className="mt-0 space-y-5" id="cambio">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Repeat className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Câmbio Inteligente</h2>
                <p className="text-[11px] text-muted-foreground">
                  Configure as cotações e moedas exibidas no alternador de pagamento do checkout. Os preços do cardápio serão convertidos automaticamente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FieldGroup>
                <Label className="text-xs font-medium">1 BRL = quantos Guaraníes?</Label>
                <Input
                  type="number"
                  min={1}
                  step={100}
                  value={formData.exchange_rates.pyg_per_brl}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 3600);
                    set('exchange_rates', { ...formData.exchange_rates, pyg_per_brl: v });
                  }}
                  placeholder="3600"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Gs. por 1 Real</p>
              </FieldGroup>
              <FieldGroup>
                <Label className="text-xs font-medium">1 BRL = quantos Pesos Argentinos?</Label>
                <Input
                  type="number"
                  min={1}
                  step={10}
                  value={formData.exchange_rates.ars_per_brl}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1150);
                    set('exchange_rates', { ...formData.exchange_rates, ars_per_brl: v });
                  }}
                  placeholder="1150"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">ARS $ por 1 Real</p>
              </FieldGroup>
              <FieldGroup>
                <Label className="text-xs font-medium">1 BRL = quantos Dólares?</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={formData.exchange_rates.usd_per_brl}
                  onChange={(e) => {
                    const v = Math.max(0.01, Number(e.target.value) || 0.18);
                    set('exchange_rates', { ...formData.exchange_rates, usd_per_brl: v });
                  }}
                  placeholder="0.18"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">US$ por 1 Real</p>
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label className="text-xs font-medium">Moedas no alternador do checkout</Label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Selecione quais moedas o cliente poderá escolher ao pagar
              </p>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map(c => {
                  const checked = formData.payment_currencies.includes(c.value);
                  return (
                    <label
                      key={c.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        checked ? 'border-[#F87116] bg-orange-50' : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.payment_currencies, c.value]
                            : formData.payment_currencies.filter(x => x !== c.value);
                          if (next.length >= 1) set('payment_currencies', next);
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-medium">{c.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                O cliente verá um alternador no cardápio e checkout para escolher pagar em Real, Guaraní, Peso Argentino ou Dólar conforme configurado.
              </p>
            </FieldGroup>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA — Gestão de Usuários (visível apenas para super-admin e proprietário)
        ══════════════════════════════════════════════════════════════════════ */}
        {canAccessUsers && (
          <TabsContent value="usuarios" className="mt-0 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{t('settings.tabs.users')}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t('settings.usersDescription')}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setUsersPanelOpen(true)}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Users className="h-4 w-4" />
                  {t('settings.usersOpenPanel')}
                </Button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Painel de Gestão de Usuários (mesmo componente usado pelo super-admin) */}
      {canAccessUsers && restaurantId && (
        <RestaurantUsersPanel
          open={usersPanelOpen}
          onClose={() => setUsersPanelOpen(false)}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
        />
      )}
    </div>
  );
}
