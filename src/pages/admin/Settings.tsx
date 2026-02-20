import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { DayKey, PrintPaperWidth, type PrintSettingsBySector, type SectorPrintSettings } from '@/types';
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
  Sun, AlarmClock, X, Wifi, MapPin, Languages, Store,
  Gift, Star, Trophy, Users,
} from 'lucide-react';
import { useLoyaltyProgram, useSaveLoyaltyProgram, useLoyaltyMetrics } from '@/hooks/queries';

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
    <button
      type="button"
      disabled={saving}
      onClick={onClick}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F87116] to-orange-500 text-white font-semibold text-sm shadow-md shadow-orange-200/40 hover:brightness-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminSettings() {
  const restaurantId = useAdminRestaurantId();
  const { t }        = useAdminTranslation();
  const { lang: panelLanguage, setLang: setStoreLang } = useAdminLanguageStore();
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fidelidade ──
  const { data: loyaltyProgram } = useLoyaltyProgram(restaurantId);
  const { data: loyaltyMetrics } = useLoyaltyMetrics(restaurantId);
  const saveLoyaltyMutation = useSaveLoyaltyProgram();
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltyForm, setLoyaltyForm] = useState<{ enabled: boolean; orders_required: number; reward_description: string }>({
    enabled: false,
    orders_required: 10,
    reward_description: '',
  });
  const setLoyalty = <K extends keyof typeof loyaltyForm>(k: K, v: (typeof loyaltyForm)[K]) =>
    setLoyaltyForm(f => ({ ...f, [k]: v }));

  // Local state mirrors the store so the Select shows correctly
  const [panelLangLocal, setPanelLangLocal] = useState<PanelLanguage>(panelLanguage);

  const [formData, setFormData] = useState({
    name:                    '',
    phone:                   '',
    whatsapp:                '',
    phone_country:           'BR' as PhoneCountry,
    currency:                'BRL' as CurrencyCode,
    language:                'pt' as CardapioLanguage,
    instagram_url:           '',
    logo:                    '',
    is_manually_closed:      false,
    always_open:             false,
    opening_hours:           {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width:       '80mm' as PrintPaperWidth,
    print_settings_by_sector: defaultSectorSettings(),
  });

  const set = <K extends keyof typeof formData>(k: K, v: (typeof formData)[K]) =>
    setFormData(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  useEffect(() => {
    if (loyaltyProgram) {
      setLoyaltyForm({
        enabled: loyaltyProgram.enabled,
        orders_required: loyaltyProgram.orders_required,
        reward_description: loyaltyProgram.reward_description,
      });
    }
  }, [loyaltyProgram]);

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

      const rawCountry = data.phone_country as string;
      const validCountries: PhoneCountry[] = ['BR', 'PY', 'AR'];
      const phone_country: PhoneCountry = validCountries.includes(rawCountry as PhoneCountry)
        ? (rawCountry as PhoneCountry) : 'BR';

      setFormData({
        name:                    data.name              || '',
        phone:                   data.phone             || '',
        whatsapp:                data.whatsapp          || '',
        phone_country,
        currency,
        language,
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
      const { error } = await supabase.from('restaurants').update({
        name:                    formData.name,
        phone:                   formData.phone,
        whatsapp:                formData.whatsapp,
        phone_country:           formData.phone_country,
        currency:                formData.currency,
        language:                formData.language,
        instagram_url:           formData.instagram_url || null,
        logo:                    formData.logo,
        is_manually_closed:      formData.is_manually_closed,
        always_open:             formData.always_open,
        opening_hours:           formData.opening_hours,
        print_auto_on_new_order: formData.print_auto_on_new_order,
        print_paper_width:       formData.print_paper_width,
        print_settings_by_sector: formData.print_settings_by_sector,
        updated_at:              new Date().toISOString(),
      }).eq('id', restaurantId);
      if (error) throw error;
      // Persiste o idioma do painel via store (localStorage + Zustand → reatividade imediata)
      setStoreLang(panelLangLocal);
      toast({ title: '✅ ' + t('settings.title') + ' — ' + t('common.success') });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
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
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 h-auto gap-0 p-0 mb-6 rounded-xl bg-muted/60 border border-border w-full overflow-hidden">
          {(
            [
              { value: 'perfil',         icon: Store,     label: t('settings.tabs.profile')   },
              { value: 'regionalizacao', icon: Globe,     label: t('settings.tabs.regional')  },
              { value: 'contato',        icon: Phone,     label: t('settings.tabs.contact')   },
              { value: 'operacao',       icon: Clock,     label: t('settings.tabs.operation') },
              { value: 'fidelidade',     icon: Gift,      label: t('loyalty.tabLabel')        },
            ] as const
          ).map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={`
                flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2.5 px-2 rounded-none border-b-2 border-transparent
                font-medium text-muted-foreground transition-all
                data-[state=active]:bg-background
                data-[state=active]:text-[#F87116]
                data-[state=active]:border-b-[#F87116]
                data-[state=active]:shadow-sm
                hover:text-foreground hover:bg-background/60
              `}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 1 — Perfil do Negócio
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="perfil" className="mt-0 space-y-5">

          {/* Logo + Nome lado a lado em md+ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Logo */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-[18px] w-[18px] text-[#F87116]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Logo</h2>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG ou WebP — 80%</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                {formData.logo ? (
                  <div className="relative">
                    <img
                      src={formData.logo}
                      alt="Logo"
                      className="h-24 w-24 rounded-2xl object-cover border-2 border-border shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => set('logo', '')}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                      title="Remover logo"
                    >
                      <X style={{ height: 10, width: 10 }} />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                    <ImageIcon style={{ height: 28, width: 28 }} />
                    <span className="text-[10px] font-medium">Sem logo</span>
                  </div>
                )}

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
                      toast({ title: 'Logo enviada!', description: 'Otimizada em WebP (80%).' });
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
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-[#F87116] hover:text-[#F87116] hover:bg-orange-50 transition-all disabled:opacity-50"
                >
                  {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUploading ? 'Enviando…' : 'Fazer upload'}
                </button>

                <FieldGroup>
                  <SectionLabel>Ou cole uma URL</SectionLabel>
                  <Input
                    type="url"
                    value={formData.logo}
                    onChange={(e) => set('logo', e.target.value)}
                    placeholder="https://..."
                    className="text-xs h-8"
                  />
                </FieldGroup>
              </div>
            </div>

            {/* Informações do negócio */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Store className="h-[18px] w-[18px] text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Perfil do Negócio</h2>
                  <p className="text-[11px] text-muted-foreground">Nome exibido no cardápio e pedidos</p>
                </div>
              </div>

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

              {/* Status rápido */}
              <div className="space-y-2">
                <SectionLabel>Status de Funcionamento</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ToggleRow
                    label="Sempre aberto (24h)"
                    description="Ignora os horários abaixo."
                    checked={formData.always_open}
                    onChange={(v) => set('always_open', v)}
                    icon={Sun}
                    activeColor="bg-emerald-50 border-emerald-200"
                  />
                  <ToggleRow
                    label="Fechado agora (manual)"
                    description="Força status fechado."
                    checked={formData.is_manually_closed}
                    onChange={(v) => set('is_manually_closed', v)}
                    icon={XCircle}
                    activeColor="bg-red-50 border-red-200"
                  />
                </div>
              </div>
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
        <TabsContent value="regionalizacao" className="mt-0 space-y-5">

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
        <TabsContent value="contato" className="mt-0 space-y-5">

          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Phone className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Canais e Contato</h2>
                <p className="text-[11px] text-muted-foreground">
                  Exibidos no cardápio e usados para comunicação com clientes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* País */}
              <div className="sm:col-span-2">
                <FieldGroup>
                  <SectionLabel>País</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {PHONE_COUNTRIES.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => set('phone_country', c.value)}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                          formData.phone_country === c.value
                            ? 'border-[#F87116] bg-orange-50 text-[#F87116]'
                            : 'border-border bg-background text-muted-foreground hover:border-slate-300'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {c.label.split(' ')[0]} {/* emoji */}
                        <span className="text-[10px]">{c.label.split('(')[1]?.replace(')', '')}</span>
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              </div>

              {/* Telefone */}
              <FieldGroup>
                <SectionLabel>Telefone</SectionLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder={phonePlaceholder}
                    className="pl-9"
                    required
                  />
                </div>
              </FieldGroup>

              {/* WhatsApp */}
              <FieldGroup>
                <SectionLabel>WhatsApp</SectionLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground font-bold select-none">
                    W
                  </span>
                  <Input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => set('whatsapp', e.target.value)}
                    placeholder={phonePlaceholder}
                    className="pl-9"
                    required
                  />
                </div>
              </FieldGroup>

              {/* Instagram */}
              <FieldGroup>
                <SectionLabel>
                  <span className="inline-flex items-center gap-1">
                    <Instagram style={{ height: 11, width: 11, display: 'inline' }} />
                    Instagram
                  </span>
                </SectionLabel>
                <Input
                  type="url"
                  value={formData.instagram_url}
                  onChange={(e) => set('instagram_url', e.target.value)}
                  placeholder="https://instagram.com/seurestaurante"
                />
              </FieldGroup>

              {/* Dica WhatsApp */}
              <div className="sm:col-span-2">
                <div className="rounded-xl bg-muted/50 border border-border p-3.5 text-[11px] text-muted-foreground flex items-start gap-2.5">
                  <Wifi className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                  <p>
                    O número do WhatsApp é usado para gerar links de contato direto no cardápio.
                    Certifique-se de que ele está ativo e com o aplicativo instalado.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA 4 — Operação
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="operacao" className="mt-0 space-y-5">

          {/* Horários */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Horários de Funcionamento</h2>
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
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors ${
                      isClosed ? 'bg-muted/40 border-border' : 'bg-card border-border'
                    }`}
                  >
                    <div className="w-14 flex-shrink-0">
                      <span className={`text-xs font-semibold hidden sm:block ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
                      <span className={`text-xs font-semibold sm:hidden ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>{short}</span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 w-24">
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

          {/* Impressão */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Printer className="h-[18px] w-[18px] text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Impressão</h2>
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
              <div className="grid grid-cols-2 gap-2">
                {(['58mm', '80mm'] as PrintPaperWidth[]).map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set('print_paper_width', w)}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      formData.print_paper_width === w
                        ? 'border-[#F87116] bg-orange-50 text-[#F87116]'
                        : 'border-border bg-background text-muted-foreground hover:border-slate-300'
                    }`}
                  >
                    <Printer className="h-4 w-4" />
                    {w}
                    <span className="text-[10px] font-normal">
                      {w === '58mm' ? t('settings.operation.narrow') : t('settings.operation.standard')}
                    </span>
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
            ABA 5 — Fidelidade
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="fidelidade" className="mt-0 space-y-5">

          {/* Config do programa */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                <Gift className="h-[18px] w-[18px] text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('loyalty.sectionTitle')}</h2>
                <p className="text-[11px] text-muted-foreground">{t('loyalty.sectionDesc')}</p>
              </div>
            </div>

            {/* Toggle ativar */}
            <ToggleRow
              label={t('loyalty.toggleLabel')}
              description={t('loyalty.toggleDesc')}
              checked={loyaltyForm.enabled}
              onChange={(v) => setLoyalty('enabled', v)}
              icon={Star}
              activeColor="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800"
            />

            {/* Campos de configuração */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup>
                <SectionLabel>{t('loyalty.ordersRequired')}</SectionLabel>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={loyaltyForm.orders_required}
                  onChange={(e) => setLoyalty('orders_required', Math.max(2, Math.min(100, parseInt(e.target.value) || 10)))}
                />
                <p className="text-[10px] text-muted-foreground">{t('loyalty.ordersRequiredHint')}</p>
              </FieldGroup>

              <FieldGroup>
                <SectionLabel>{t('loyalty.rewardLabel')}</SectionLabel>
                <Input
                  value={loyaltyForm.reward_description}
                  onChange={(e) => setLoyalty('reward_description', e.target.value)}
                  placeholder={t('loyalty.rewardPlaceholder')}
                  maxLength={120}
                />
                <p className="text-[10px] text-muted-foreground">{t('loyalty.rewardHint')}</p>
              </FieldGroup>
            </div>

            {/* Preview dos selos */}
            {loyaltyForm.orders_required >= 2 && (
              <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preview do cartão</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(loyaltyForm.orders_required, 10) }).map((_, i) => (
                    <div key={i} className={`h-6 w-6 rounded-full flex items-center justify-center ${i < 3 ? 'bg-violet-500' : 'bg-muted border border-border'}`}>
                      <Star className={`h-3 w-3 ${i < 3 ? 'text-white' : 'text-muted-foreground/30'}`} />
                    </div>
                  ))}
                  {loyaltyForm.orders_required > 10 && (
                    <span className="text-[10px] text-muted-foreground self-center">+{loyaltyForm.orders_required - 10}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  3 de {loyaltyForm.orders_required} pedidos — faltam {loyaltyForm.orders_required - 3} para ganhar: {loyaltyForm.reward_description || '—'}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <SaveButton
                saving={loyaltySaving}
                label={t('loyalty.saveBtn')}
                savingLabel={t('common.saving')}
                onClick={async () => {
                  if (!restaurantId) return;
                  setLoyaltySaving(true);
                  try {
                    await saveLoyaltyMutation.mutateAsync({ restaurant_id: restaurantId, ...loyaltyForm });
                    toast({ title: t('common.success'), description: t('loyalty.sectionTitle') });
                  } catch {
                    toast({ title: t('common.error'), variant: 'destructive' });
                  } finally {
                    setLoyaltySaving(false);
                  }
                }}
              />
            </div>
          </div>

          {/* Métricas de Fidelidade */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-[18px] w-[18px] text-amber-600" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">{t('loyalty.metricsTitle')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{loyaltyMetrics?.totalRedeemed ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('loyalty.totalRedeemed')}</p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{loyaltyMetrics?.activeClients ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><Users className="h-3 w-3" />{t('loyalty.activeClients')}</p>
              </div>
            </div>

            {/* Top clientes */}
            {(loyaltyMetrics?.topClients ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t('loyalty.topClientsTitle')}</p>
                <div className="space-y-1.5">
                  {loyaltyMetrics!.topClients.map((c, i) => (
                    <div key={c.customer_phone} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </span>
                        <span className="text-xs font-mono text-foreground truncate">{c.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11px] text-violet-600 font-semibold">{c.points} pts</span>
                        {c.redeemed_count > 0 && (
                          <span className="text-[11px] text-amber-600 font-semibold">{c.redeemed_count}x 🎁</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}
