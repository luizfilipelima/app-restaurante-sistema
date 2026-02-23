import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { invalidatePublicMenuCache } from '@/lib/invalidatePublicCache';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { PrintPaperWidth, type BankAccountByCountry, type PrintSettingsBySector, type SectorPrintSettings } from '@/types';
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
  Save, Upload, Loader2, Printer,
  Phone, Globe, ImageIcon, AlarmClock, X, Wifi, Store,
  Users, ExternalLink, Link2,
  MessageCircle, AtSign, Repeat, CreditCard, Landmark, QrCode,
} from 'lucide-react';
import { useRestaurant } from '@/hooks/queries';
import { useCanAccess } from '@/hooks/useUserRole';
import RestaurantUsersPanel from '@/components/admin/RestaurantUsersPanel';

// ─── Constantes ───────────────────────────────────────────────────────────────

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
              { value: 'perfil',       icon: Store,   label: 'Perfil e Contato' },
              { value: 'pagamentos',   icon: CreditCard, label: 'PIX e Transferência'     },
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
        <TabsContent value="perfil" className="mt-0 space-y-7">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* ── Logo — drop zone ── */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col shadow-sm">

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
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
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

          {/* ── Regionalização (moeda, país, idiomas) ── */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                <Globe className="h-[18px] w-[18px] text-[#F87116]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('settings.regional.title')}</h2>
                <p className="text-[11px] text-muted-foreground">{t('settings.regional.subtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <FieldGroup>
                <SectionLabel>{t('settings.regional.currency')}</SectionLabel>
                <Select value={formData.currency} onValueChange={(v) => set('currency', v as CurrencyCode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span>{c.label}</span>
                        <span className="ml-1.5 text-[11px] text-muted-foreground">({c.sub})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{t('settings.regional.currencyDesc')}</p>
              </FieldGroup>
              <FieldGroup>
                <SectionLabel>{t('settings.regional.country')}</SectionLabel>
                <Select value={formData.phone_country} onValueChange={(v) => set('phone_country', v as PhoneCountry)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PHONE_COUNTRIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{t('settings.regional.countryDesc')}</p>
              </FieldGroup>
              <FieldGroup>
                <SectionLabel>{t('settings.regional.menuLang')}</SectionLabel>
                <Select value={formData.language} onValueChange={(v) => set('language', v as CardapioLanguage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARDAPIO_LANGS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{t('settings.regional.menuLangDesc')}</p>
              </FieldGroup>
              <FieldGroup>
                <SectionLabel>Primeira tela do cardápio</SectionLabel>
                <Select value={formData.menu_display_mode} onValueChange={(v) => set('menu_display_mode', v as 'default' | 'categories_first')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão</SelectItem>
                    <SelectItem value="categories_first">Categorias</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup>
                <SectionLabel>{t('settings.regional.panelLang')}</SectionLabel>
                <Select
                  value={panelLangLocal}
                  onValueChange={(v) => {
                    const lang = v as PanelLanguage;
                    setPanelLangLocal(lang);
                    setStoreLang(lang);
                    toast({ title: lang === 'pt' ? '🇧🇷 Idioma atualizado' : lang === 'es' ? '🇦🇷 Idioma actualizado' : '🇺🇸 Language updated' });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PANEL_LANGS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{t('settings.regional.panelLangDesc')}</p>
              </FieldGroup>
            </div>
            <div className="pt-3 border-t border-border/60">
              <p className="text-[10px] text-muted-foreground mb-2">{t('settings.regional.formatPreview')}</p>
              <div className="flex flex-wrap gap-2">
                {[1500, 9900, 25000].map(val => {
                  let display = '';
                  if (formData.currency === 'BRL') display = `R$ ${(val / 100).toFixed(2).replace('.', ',')}`;
                  else if (formData.currency === 'PYG') display = `Gs. ${val.toLocaleString('es-PY')}`;
                  else if (formData.currency === 'ARS') display = `$ ${(val / 100).toFixed(2).replace('.', ',')}`;
                  else display = `$ ${(val / 100).toFixed(2)}`;
                  return (
                    <span key={val} className="px-3 py-1.5 rounded-lg bg-muted/60 text-sm font-medium">{display}</span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Contato (telefone, WhatsApp, redes) ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Phone className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Contato</h2>
                <p className="text-[11px] text-muted-foreground">Telefone e WhatsApp exibidos no cardápio</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </FieldGroup>
                <FieldGroup>
                  <SectionLabel>WhatsApp</SectionLabel>
                  <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center gap-1 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs border-r border-border select-none font-semibold flex-shrink-0">
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
              <FieldGroup>
                <SectionLabel>Instagram</SectionLabel>
                <div className="flex items-stretch rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring max-w-md">
                  <span className="flex items-center px-3 bg-muted text-xs text-muted-foreground border-r border-border select-none flex-shrink-0">
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
                  <a href={formData.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-pink-600 hover:underline font-medium">
                    <ExternalLink className="h-3 w-3" />
                    {formData.instagram_url}
                  </a>
                )}
              </FieldGroup>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 p-3 flex items-start gap-2.5">
                <Wifi className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200/90">
                  O prefixo de país vem do campo &quot;País de origem&quot; na seção Regional acima. O WhatsApp precisa estar ativo no celular para receber mensagens.
                </p>
              </div>
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
          {/* Moeda nativa como padrão — destaque visual */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/80 to-card dark:from-emerald-950/20 dark:to-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Câmbio Inteligente</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Moeda base do restaurante: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{CURRENCIES.find(c => c.value === formData.currency)?.label ?? formData.currency}</span> — configure em &quot;Regional&quot; acima. As cotações são exibidas em relação à moeda nativa para facilitar o câmbio.
                </p>
              </div>
            </div>

            {/* Cotações — moeda nativa sempre como base: "Quantos [nativa] = 1 [outra]?" */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cotações de câmbio</h3>
              <p className="text-sm text-muted-foreground -mt-1">
                Quanto da moeda nativa equivale a 1 unidade de cada moeda estrangeira.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(['BRL', 'ARS', 'USD'] as const)
                  .filter((fc) => fc !== formData.currency)
                  .map((foreignCurr) => {
                    const native = formData.currency;
                    const r = formData.exchange_rates;
                    const pyg = r.pyg_per_brl ?? 3600;
                    const ars = r.ars_per_brl ?? 1150;
                    const usd = r.usd_per_brl ?? 0.18;

                    const NATIVE_LABELS: Record<string, string> = { BRL: 'Reais', PYG: 'Gs.', ARS: 'Pesos', USD: 'US$' };
                    const FOREIGN_LABELS: Record<string, string> = { BRL: 'Real', PYG: 'Gs.', ARS: 'Peso', USD: 'Dólar' };
                    const nativeUnit = NATIVE_LABELS[native] ?? native;
                    const foreignUnit = FOREIGN_LABELS[foreignCurr] ?? foreignCurr;

                    let displayVal: number;
                    let step: number;
                    let placeholder: string;
                    let min: number;

                    if (foreignCurr === 'BRL') {
                      displayVal = native === 'PYG' ? pyg : native === 'ARS' ? ars : 1 / usd;
                      step = native === 'PYG' ? 100 : native === 'USD' ? 0.01 : 10;
                      placeholder = native === 'PYG' ? '3600' : native === 'ARS' ? '1150' : '5.50';
                      min = native === 'USD' ? 0.01 : 1;
                    } else if (foreignCurr === 'ARS') {
                      displayVal = native === 'PYG' ? pyg / ars : native === 'BRL' ? 1 / ars : ars / usd;
                      step = displayVal < 10 ? 0.01 : 1;
                      placeholder = native === 'PYG' ? '0.96' : native === 'BRL' ? '0.0009' : '6.40';
                      min = 0.0001;
                    } else {
                      displayVal = native === 'PYG' ? pyg / usd : native === 'BRL' ? 1 / usd : ars / usd;
                      step = native === 'PYG' ? 100 : 0.01;
                      placeholder = native === 'PYG' ? '20000' : native === 'BRL' ? '5.50' : '6.40';
                      min = 0.01;
                    }

                    const onCurrChange = (raw: number) => {
                      const val = Math.max(min, raw);
                      if (foreignCurr === 'BRL') {
                        if (native === 'PYG') set('exchange_rates', { ...r, pyg_per_brl: Math.round(val) });
                        else if (native === 'ARS') set('exchange_rates', { ...r, ars_per_brl: Math.max(1, Math.round(val)) });
                        else set('exchange_rates', { ...r, usd_per_brl: Math.max(0.01, Math.min(100, 1 / val)) });
                      } else if (foreignCurr === 'ARS') {
                        if (native === 'PYG') set('exchange_rates', { ...r, ars_per_brl: pyg / val });
                        else if (native === 'BRL') set('exchange_rates', { ...r, ars_per_brl: 1 / val });
                        else set('exchange_rates', { ...r, usd_per_brl: ars / val });
                      } else {
                        if (native === 'PYG') set('exchange_rates', { ...r, usd_per_brl: pyg / val });
                        else if (native === 'BRL') set('exchange_rates', { ...r, usd_per_brl: 1 / val });
                        else set('exchange_rates', { ...r, usd_per_brl: ars / val });
                      }
                    };

                    return (
                      <div key={foreignCurr} className="rounded-xl border border-border bg-background/60 p-4 space-y-2">
                        <Label className="text-sm font-medium flex flex-wrap items-center gap-1">
                          <span className="text-muted-foreground">Quantos {nativeUnit}</span>
                          <span className="text-foreground">=</span>
                          <span className="text-foreground">1 {foreignUnit}?</span>
                        </Label>
                        <Input
                          type="number"
                          min={min}
                          step={step}
                          value={displayVal}
                          onChange={(e) => onCurrChange(Number(e.target.value) || min)}
                          placeholder={placeholder}
                          className="h-11 font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {nativeUnit} necessários para 1 {foreignUnit}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Moedas no alternador — nativa em destaque */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Moedas disponíveis no checkout</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione as moedas que o cliente poderá escolher no cardápio e na tela de pagamento. A moeda nativa é sempre exibida primeiro.
              </p>
              <div className="flex flex-wrap gap-3">
                {[...CURRENCIES]
                  .sort((a, b) => {
                    if (a.value === formData.currency) return -1;
                    if (b.value === formData.currency) return 1;
                    return 0;
                  })
                  .map(c => {
                    const checked = formData.payment_currencies.includes(c.value);
                    const isNative = c.value === formData.currency;
                    return (
                      <label
                        key={c.value}
                        className={`
                          flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-all
                          ${checked
                            ? isNative
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30'
                              : 'border-[#F87116] bg-orange-50 dark:bg-orange-950/30'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                          }
                        `}
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
                        {isNative && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                            Moeda nativa
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            </div>
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
