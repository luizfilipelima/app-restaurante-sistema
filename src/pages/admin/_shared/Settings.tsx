import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { useAdminRestaurantId, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { useAdminLanguageStore } from '@/store/adminLanguageStore';
import { PrintPaperWidth, type BankAccountByCountry, type PrintSettingsBySector, type SectorPrintSettings, type LinkBioButton, type LinkBioButtonType } from '@/types';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { getBioPublicUrl, getCardapioPublicUrl, generateWhatsAppLink } from '@/lib/core/utils';
import { toast } from '@/hooks/shared/use-toast';
import {
  Save, Upload, Loader2, Printer,
  Phone, Globe, ImageIcon, AlarmClock, X, Wifi, Store,
  Users, ExternalLink, Link2, FileText,
  MessageCircle, AtSign, Repeat, CreditCard, Landmark, QrCode, Settings as SettingsIcon,
  Pencil, Trash2, Plus, ChevronUp, ChevronDown, Lock,
  Bike, Banknote,
} from 'lucide-react';
import { useRestaurant } from '@/hooks/queries';
import { useLinkBioButtons, useLinkBioButtonsMutations, type CreateLinkBioButtonPayload } from '@/hooks/queries/useLinkBioButtons';
import { useCanAccess } from '@/hooks/auth/useUserRole';
import { AdminPageHeader, AdminPageLayout } from '@/components/admin/_shared';
import RestaurantUsersPanel from '@/components/admin/_shared/RestaurantUsersPanel';
import { FeatureGuard } from '@/components/auth/FeatureGuard';

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

/** Formas de pagamento selecionáveis no checkout (exceto 'table' que é automático para mesa) */
const CHECKOUT_PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', icon: 'PIX' },
  { id: 'bank_transfer', label: 'Transferência bancária', icon: 'Landmark' },
  { id: 'cash', label: 'Dinheiro', icon: 'Banknote' },
  { id: 'card', label: 'Cartão (na retirada)', icon: 'CreditCard' },
  { id: 'qrcode', label: 'QR Code (na retirada)', icon: 'QrCode' },
] as const;

function isPaymentMethodEnabled(method: string, enabledList: string[] | null): boolean {
  if (!enabledList) return true;
  return enabledList.includes(method);
}

function togglePaymentMethod(
  method: string,
  mode: 'delivery' | 'local',
  current: { delivery: string[] | null; local: string[] | null }
): { delivery: string[] | null; local: string[] | null } {
  const all = CHECKOUT_PAYMENT_METHODS.map((m) => m.id);
  const list = mode === 'delivery' ? current.delivery : current.local;
  const base = list ?? all;
  const enabled = base.includes(method)
    ? base.filter((m) => m !== method)
    : [...base, method];
  const next = enabled.length === all.length ? null : enabled;
  return mode === 'delivery'
    ? { ...current, delivery: next }
    : { ...current, local: next };
}

const LINK_BIO_BUTTON_TYPE_LABELS: Record<LinkBioButtonType, string> = {
  url: 'Link externo',
  menu: 'Cardápio',
  whatsapp: 'WhatsApp',
  reserve: 'Reservar',
  about: 'Página Sobre',
};

/** Botões padrão exibidos na /bio quando não há botões customizados. PT e ES. */
const DEFAULT_LINK_BIO_BUTTONS: Record<'pt' | 'es', { button_type: LinkBioButtonType; label: string; description: string; icon: string }[]> = {
  pt: [
    { button_type: 'menu', label: 'Ver Cardápio de Delivery', description: 'Peça online agora', icon: '🍽️' },
    { button_type: 'reserve', label: 'Reservar', description: 'Garanta sua mesa', icon: '📅' },
    { button_type: 'whatsapp', label: 'Fazer Pedido pelo WhatsApp', description: 'Fale diretamente conosco', icon: '📱' },
  ],
  es: [
    { button_type: 'menu', label: 'Ver Menú de Delivery', description: 'Pide online ahora', icon: '🍽️' },
    { button_type: 'reserve', label: 'Reservar', description: 'Asegurá tu mesa', icon: '📅' },
    { button_type: 'whatsapp', label: 'Hacer Pedido por WhatsApp', description: 'Hablá directamente con nosotros', icon: '📱' },
  ],
};

const LINK_BIO_ICONS = ['🔗', '🍽️', '📅', '📱', 'ℹ️', '📍', '🌐', '📞', '✉️', '🎉', '📷', '🏠', '⭐', '❤️'];
type SectorKey = typeof SECTOR_KEYS[number];

function defaultSectorSettings(): PrintSettingsBySector {
  const empty: SectorPrintSettings = { auto_print_enabled: true, waiter_tip_enabled: false, waiter_tip_pct: 10 };
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
      const s = v as { auto_print_enabled?: boolean; waiter_tip_enabled: boolean; waiter_tip_pct: number };
      out[k] = {
        auto_print_enabled: s.auto_print_enabled !== false,
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
  const basePath = useAdminBasePath();
  const { data: restaurant } = useRestaurant(restaurantId);
  const { data: linkBioButtons = [], isLoading: linkBioLoading } = useLinkBioButtons(restaurantId);
  const linkBioMutations = useLinkBioButtonsMutations(restaurantId, restaurant?.slug ?? null);
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
    payment_methods_enabled_delivery: null as string[] | null,
    payment_methods_enabled_local:    null as string[] | null,
    bank_account:            { pyg: {}, ars: {} } as BankAccountByCountry,
    description:             '',
    custom_domain:           '',
  });

  const [bankCountry, setBankCountry] = useState<'pyg' | 'ars'>('pyg');

  const [linksBioModalOpen, setLinksBioModalOpen] = useState(false);
  const [linksBioEditing, setLinksBioEditing] = useState<LinkBioButton | null>(null);
  /** Quando não há botões customizados, editar um botão padrão (menu/reserve/whatsapp) cria o primeiro botão customizado */
  const [linksBioEditingDefault, setLinksBioEditingDefault] = useState<LinkBioButtonType | null>(null);
  const [linksBioForm, setLinksBioForm] = useState({ label: '', description: '', url: '', icon: '🔗', button_type: 'url' as LinkBioButtonType });

  /** Retorna o link exibido para um botão (para mostrar na lista em Settings). */
  const getLinkBioButtonDisplayLink = (btn: { button_type: LinkBioButtonType; url?: string | null }) => {
    if (btn.button_type === 'url' && btn.url) return btn.url;
    const slug = restaurant?.slug;
    if (!slug) return '';
    const base = getCardapioPublicUrl(slug);
    if (btn.button_type === 'menu') return base;
    if (btn.button_type === 'reserve') return `${base.replace(/\/$/, '')}/reservar`;
    if (btn.button_type === 'about') return `${getBioPublicUrl(slug)}/sobre`;
    if (btn.button_type === 'whatsapp') {
      const phone = (restaurant as { whatsapp?: string; phone?: string })?.whatsapp || (restaurant as { phone?: string })?.phone;
      if (phone) return generateWhatsAppLink(phone, 'Olá! Quero fazer um pedido 🍽️');
      return 'WhatsApp';
    }
    return '';
  };

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
        payment_methods_enabled_delivery: Array.isArray(data.payment_methods_enabled_delivery) ? data.payment_methods_enabled_delivery : null,
        payment_methods_enabled_local:    Array.isArray(data.payment_methods_enabled_local) ? data.payment_methods_enabled_local : null,
        bank_account:            parseBankAccount(data.bank_account),
        description:             data.description ?? '',
        custom_domain:           data.custom_domain ?? '',
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
        payment_methods_enabled_delivery: formData.payment_methods_enabled_delivery,
        payment_methods_enabled_local:    formData.payment_methods_enabled_local,
        description:             formData.description?.trim() || null,
        bank_account:            (() => {
          const { pyg, ars } = formData.bank_account;
          const hasPyg = !!(pyg?.bank_name || pyg?.holder || pyg?.alias);
          const hasArs = !!(ars?.bank_name || ars?.agency || ars?.account || ars?.holder);
          if (!hasPyg && !hasArs) return null;
          return { pyg: hasPyg ? pyg : undefined, ars: hasArs ? ars : undefined };
        })(),
        custom_domain:           (() => {
          const v = formData.custom_domain?.trim().toLowerCase();
          if (!v) return null;
          return v;
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
    <AdminPageLayout className="pb-10">
      <AdminPageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
        icon={SettingsIcon}
        actions={<SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />}
      />

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
              { value: 'perfil',       icon: Store,      label: 'Perfil e Contato' },
              { value: 'dominios',     icon: Globe,      label: 'Domínios' },
              { value: 'pagamentos',   icon: CreditCard, label: 'Formas de Pagamento' },
              { value: 'impressao',    icon: Printer,    label: 'Impressão' },
              { value: 'cambio',       icon: Repeat,     label: 'Câmbio' },
              { value: 'links-bio',    icon: Link2,      label: 'Links e Bio' },
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
            <div className="admin-card-border bg-card overflow-hidden flex flex-col shadow-sm">

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
            <div className="md:col-span-2 admin-card-border bg-card p-6 space-y-5 shadow-sm">
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
          <div className="admin-card-border bg-card p-6 space-y-5 shadow-sm">
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
          <div className="admin-card-border bg-card overflow-hidden shadow-sm">
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

          {/* ── Descrição da loja (exibida no cardápio) ── */}
          <div className="admin-card-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <FileText className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Descrição da loja</h2>
                <p className="text-[11px] text-muted-foreground">
                  Breve texto sobre o estabelecimento. Será exibido no cardápio para o cliente.
                </p>
              </div>
            </div>
            <div className="p-5">
              <FieldGroup>
                <Label htmlFor="description" className="sr-only">Descrição da loja</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Ex.: Pizzaria artesanal desde 2010. Massa fermentada 48h, ingredientes selecionados e atendimento especial."
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Esta descrição aparece para o cliente ao acessar o cardápio online.
                </p>
              </FieldGroup>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA — Domínios (domínio personalizado — Enterprise)
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dominios" className="mt-0 space-y-5">
          <FeatureGuard
            feature="feature_custom_domain"
            fallback={
              <div className="admin-card-border bg-card p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Domínio Personalizado</h2>
                    <p className="text-xs text-muted-foreground">Disponível no plano Enterprise</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Use seu próprio domínio (ex: cardapio.seudominio.com.br) para o cardápio e ganhe mais profissionalismo.
                </p>
                <Link
                  to={`${basePath}/upgrade`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#F87116] hover:underline"
                >
                  Fazer upgrade para Enterprise
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            }
          >
            <div className="admin-card-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
                <div className="h-9 w-9 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-[18px] w-[18px] text-[#F87116]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Domínio personalizado</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Seu cardápio acessível pelo seu próprio domínio (ex: cardapio.minhapizzaria.com.br)
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-6">
                <FieldGroup>
                  <SectionLabel>Domínio</SectionLabel>
                  <Input
                    type="text"
                    value={formData.custom_domain}
                    onChange={(e) => {
                      const v = e.target.value
                        .toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .replace(/\/.*$/, '')
                        .trim();
                      set('custom_domain', v);
                    }}
                    placeholder="cardapio.minhapizzaria.com.br"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Digite apenas o domínio, sem https:// ou barras no final. Use um subdomínio como cardapio, pedidos ou menu.
                  </p>
                  {formData.custom_domain && (
                    <a
                      href={`https://${formData.custom_domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#F87116] hover:underline font-medium"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Acessar {formData.custom_domain}
                    </a>
                  )}
                </FieldGroup>

                {/* Configuração exata do DNS */}
                <div className="rounded-xl border-2 border-[#F87116]/30 bg-[#F87116]/5 p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F87116]/20 text-[#F87116] text-xs font-bold">✓</span>
                    Configuração exata do DNS
                  </h3>
                  <p className="text-xs text-foreground font-medium">
                    Você precisa criar <strong>apenas 1 registro</strong>. Não são necessários registros A, AAAA, TXT ou outros.
                  </p>
                  <div className="rounded-lg border border-border bg-background overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="text-left py-2.5 px-3 font-semibold text-foreground">Campo</th>
                          <th className="text-left py-2.5 px-3 font-semibold text-foreground">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/60">
                          <td className="py-2.5 px-3 text-muted-foreground">Tipo</td>
                          <td className="py-2.5 px-3 font-mono font-medium">CNAME</td>
                        </tr>
                        <tr className="border-b border-border/60">
                          <td className="py-2.5 px-3 text-muted-foreground">Nome / Host / Apontar</td>
                          <td className="py-2.5 px-3 font-mono">
                            {formData.custom_domain
                              ? formData.custom_domain.split('.')[0]
                              : 'cardapio'}
                            <span className="text-[10px] text-muted-foreground ml-1">
                              (a parte antes do primeiro ponto)
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-muted-foreground">Destino / Valor / Conteúdo</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-[#F87116]">cname.vercel-dns.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Em provedores como Registro.br, Hostinger ou Cloudflare, os nomes dos campos podem variar (Host, Apontar, Conteúdo). Use os valores da tabela acima.
                  </p>
                </div>

                {/* Passo a passo */}
                <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Passo a passo</h3>
                  <ol className="space-y-3 list-none">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F87116]/20 text-[#F87116] text-xs font-bold">1</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Cadastre o domínio acima e salve</p>
                        <p className="text-[11px] text-muted-foreground">Preencha o campo de domínio e clique em &quot;Salvar alterações&quot;.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">2</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Acesse o painel do seu provedor de DNS</p>
                        <p className="text-[11px] text-muted-foreground">Registro.br, GoDaddy, Hostinger, Cloudflare ou onde seu domínio está registrado.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">3</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Crie o registro CNAME com os valores exatos da tabela acima</p>
                        <p className="text-[11px] text-muted-foreground">Adicione um novo registro do tipo CNAME. Copie os valores da tabela &quot;Configuração exata do DNS&quot;.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">4</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Aguarde a propagação (até 48h)</p>
                        <p className="text-[11px] text-muted-foreground">Depois, acesse https://{formData.custom_domain || 'seu-dominio.com.br'} no navegador. Seu cardápio deve aparecer.</p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="flex justify-end">
                  <SaveButton saving={saving} onClick={handleSubmit} label={t('common.save')} savingLabel={t('common.saving')} />
                </div>
              </div>
            </div>
          </FeatureGuard>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA — Formas de Pagamento (PIX, transferência e ativação por modo)
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="pagamentos" className="mt-0 space-y-5">
          {/* Ativar/Desativar formas de pagamento por modo */}
          <div className="admin-card-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-[18px] w-[18px] text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Formas de pagamento no checkout</h2>
                <p className="text-[11px] text-muted-foreground">
                  Ative ou desative cada forma de pagamento para Delivery (entrega) e Local (retirada). Desativadas não aparecem no checkout do cliente.
                </p>
              </div>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 font-medium text-muted-foreground">Forma de pagamento</th>
                    <th className="text-center py-3 font-medium text-muted-foreground w-32">
                      <span className="flex items-center justify-center gap-1.5">
                        <Bike className="h-3.5 w-3.5" /> Delivery
                      </span>
                    </th>
                    <th className="text-center py-3 font-medium text-muted-foreground w-32">
                      <span className="flex items-center justify-center gap-1.5">
                        <Store className="h-3.5 w-3.5" /> Local
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CHECKOUT_PAYMENT_METHODS.map(({ id, label }) => (
                    <tr key={id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-medium">{label}</td>
                      <td className="py-3 text-center">
                        <Switch
                          checked={isPaymentMethodEnabled(id, formData.payment_methods_enabled_delivery)}
                          onCheckedChange={() => {
                            const next = togglePaymentMethod(id, 'delivery', {
                              delivery: formData.payment_methods_enabled_delivery,
                              local: formData.payment_methods_enabled_local,
                            });
                            setFormData((f) => ({ ...f, payment_methods_enabled_delivery: next.delivery }));
                          }}
                        />
                      </td>
                      <td className="py-3 text-center">
                        <Switch
                          checked={isPaymentMethodEnabled(id, formData.payment_methods_enabled_local)}
                          onCheckedChange={() => {
                            const next = togglePaymentMethod(id, 'local', {
                              delivery: formData.payment_methods_enabled_delivery,
                              local: formData.payment_methods_enabled_local,
                            });
                            setFormData((f) => ({ ...f, payment_methods_enabled_local: next.local }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card-border bg-card overflow-hidden">
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

          <div className="admin-card-border bg-card overflow-hidden">
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
                <div className="flex admin-card-border overflow-hidden bg-muted/30">
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
        <TabsContent value="impressao" className="mt-0 space-y-6">

          {/* Card 1: Configurações gerais */}
          <div className="admin-card-border bg-card shadow-sm overflow-hidden">
            <div className="p-5 pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <Printer className="h-5 w-5 text-[#F87116]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t('settings.operation.print')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('settings.operation.printDesc')}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <ToggleRow
                label={t('settings.operation.autoPrint')}
                description={t('settings.operation.autoPrintDesc')}
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
                          ? 'border-[#F87116] bg-orange-50 dark:bg-orange-950/30 text-[#F87116]'
                          : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <Printer className="h-4 w-4 flex-shrink-0" />
                      <div className="text-left">
                        <div>{w}</div>
                        <div className="text-[10px] font-normal mt-0.5 text-muted-foreground">
                          {w === '58mm' ? t('settings.operation.narrow') : t('settings.operation.standard')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </FieldGroup>
            </div>
          </div>

          {/* Card 2: Impressão e taxa por setor */}
          <div className="admin-card-border bg-card shadow-sm overflow-hidden">
            <div className="p-5 pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <Printer className="h-5 w-5 text-[#F87116]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t('settings.operation.printBySector')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('settings.operation.printBySectorDesc')}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SECTOR_KEYS.map((sector) => {
                  const sectorLabels: Record<SectorKey, string> = {
                    delivery: t('settings.operation.sectorDelivery'),
                    table:    t('settings.operation.sectorTable'),
                    pickup:   t('settings.operation.sectorPickup'),
                    buffet:   t('settings.operation.sectorBuffet'),
                  };
                  const sectorLabel = sectorLabels[sector];
                  const cfg = formData.print_settings_by_sector[sector] ?? { auto_print_enabled: true, waiter_tip_enabled: false, waiter_tip_pct: 10 };
                  const autoPrint = cfg.auto_print_enabled !== false;
                  const waiterEnabled = cfg.waiter_tip_enabled;
                  const pct = cfg.waiter_tip_pct;
                  return (
                    <div
                      key={sector}
                      className="admin-card-border bg-background/50 p-4 space-y-4 transition-colors hover:border-muted-foreground/20"
                    >
                      <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                        <span className="text-sm font-semibold text-foreground">{sectorLabel}</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{t('settings.operation.sectorAutoPrint')}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.operation.sectorAutoPrintDesc')}</p>
                          </div>
                          <Toggle
                            checked={autoPrint}
                            onChange={(v) => {
                              const next = { ...formData.print_settings_by_sector };
                              next[sector] = { ...cfg, auto_print_enabled: v };
                              set('print_settings_by_sector', next);
                            }}
                          />
                        </div>
                        <div className={`rounded-lg border p-3 transition-colors ${waiterEnabled ? 'border-orange-200/60 bg-orange-50/30 dark:bg-orange-950/20' : 'border-border/60 bg-muted/20'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{t('settings.operation.waiterTipToggle')}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.operation.waiterTipPct')}</p>
                            </div>
                            <Toggle
                              checked={waiterEnabled}
                              onChange={(v) => {
                                const next = { ...formData.print_settings_by_sector };
                                next[sector] = { ...cfg, waiter_tip_enabled: v };
                                set('print_settings_by_sector', next);
                              }}
                            />
                          </div>
                          {waiterEnabled && (
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
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
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
                      <div key={foreignCurr} className="admin-card-border bg-background/60 p-4 space-y-2">
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
            ABA — Links e Bio (botões da página pública /bio)
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="links-bio" className="mt-0 space-y-5">
          {/* Relação direta com a página pública /bio do restaurante */}
          {restaurant?.slug && (
            <div className="admin-card-border bg-card p-4 rounded-xl border-primary/20 bg-primary/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Esta aba configura a página pública <strong>Link da Bio</strong> do seu restaurante.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={getBioPublicUrl(restaurant.slug)}>
                    {getBioPublicUrl(restaurant.slug)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => window.open(getBioPublicUrl(restaurant.slug), '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver página
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getBioPublicUrl(restaurant.slug));
                      toast({ title: 'Link copiado!' });
                    }}
                  >
                    Copiar link
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="admin-card-border bg-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#F87116]/10 flex items-center justify-center flex-shrink-0">
                  <Link2 className="h-5 w-5 text-[#F87116]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Links e Bio</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Botões exibidos na sua página de Links e Bio (Instagram, etc.). Se não configurar nenhum, serão exibidos Cardápio, Reservar e WhatsApp por padrão.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setLinksBioEditing(null);
                  setLinksBioEditingDefault(null);
                  setLinksBioForm({ label: '', description: '', url: '', icon: '🔗', button_type: 'url' });
                  setLinksBioModalOpen(true);
                }}
                className="gap-2 bg-[#F87116] hover:bg-[#F87116]/90"
              >
                <Plus className="h-4 w-4" />
                Adicionar botão
              </Button>
            </div>

            {linkBioLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {(linkBioButtons.length > 0 ? linkBioButtons : []).map((btn, index) => (
                  <li
                    key={btn.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/60 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-xl flex-shrink-0" aria-hidden>{btn.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{btn.label}</p>
                      {(btn.description ?? '').trim() && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{btn.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5" title={getLinkBioButtonDisplayLink(btn)}>
                        {getLinkBioButtonDisplayLink(btn)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => {
                          const ordered = [...linkBioButtons];
                          const prev = ordered[index - 1];
                          ordered[index - 1] = ordered[index];
                          ordered[index] = prev;
                          linkBioMutations.reorder.mutate(ordered.map((b) => b.id));
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === linkBioButtons.length - 1}
                        onClick={() => {
                          const ordered = [...linkBioButtons];
                          const next = ordered[index + 1];
                          ordered[index + 1] = ordered[index];
                          ordered[index] = next;
                          linkBioMutations.reorder.mutate(ordered.map((b) => b.id));
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setLinksBioEditing(btn);
                          setLinksBioEditingDefault(null);
                          setLinksBioForm({
                            label: btn.label,
                            description: btn.description ?? '',
                            url: btn.url ?? '',
                            icon: btn.icon,
                            button_type: btn.button_type,
                          });
                          setLinksBioModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm('Remover este botão?')) linkBioMutations.remove.mutate(btn.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
                {linkBioButtons.length === 0 && restaurant?.slug && (
                  <>
                    {(DEFAULT_LINK_BIO_BUTTONS[(restaurant as { language?: string })?.language === 'es' ? 'es' : 'pt'] ?? DEFAULT_LINK_BIO_BUTTONS.pt).map((def) => (
                      <li
                        key={`default-${def.button_type}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-xl flex-shrink-0" aria-hidden>{def.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{def.label}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{def.description}</p>
                          <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5" title={getLinkBioButtonDisplayLink(def)}>
                            {getLinkBioButtonDisplayLink(def)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setLinksBioEditing(null);
                            setLinksBioEditingDefault(def.button_type);
                            setLinksBioForm({
                              label: def.label,
                              description: def.description,
                              url: '',
                              icon: def.icon,
                              button_type: def.button_type,
                            });
                            setLinksBioModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA — Gestão de Usuários (visível apenas para super-admin e proprietário)
        ══════════════════════════════════════════════════════════════════════ */}
        {canAccessUsers && (
          <TabsContent value="usuarios" className="mt-0 space-y-5">
            <div className="admin-card-border bg-card p-6">
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

      {/* Modal Adicionar/Editar botão Links e Bio */}
      <Dialog
        open={linksBioModalOpen}
        onOpenChange={(open) => {
          setLinksBioModalOpen(open);
          if (!open) { setLinksBioEditing(null); setLinksBioEditingDefault(null); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{linksBioEditing ? 'Editar botão' : linksBioEditingDefault ? 'Personalizar botão padrão' : 'Adicionar botão'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="link-bio-label">Título</Label>
              <Input
                id="link-bio-label"
                value={linksBioForm.label}
                onChange={(e) => setLinksBioForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Ver cardápio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-bio-description">Descrição (subtítulo)</Label>
              <Input
                id="link-bio-description"
                value={linksBioForm.description}
                onChange={(e) => setLinksBioForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Peça online agora"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={linksBioForm.button_type}
                onValueChange={(v) => setLinksBioForm((f) => ({ ...f, button_type: v as LinkBioButtonType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LINK_BIO_BUTTON_TYPE_LABELS) as [LinkBioButtonType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {linksBioForm.button_type === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="link-bio-url">URL</Label>
                <Input
                  id="link-bio-url"
                  type="url"
                  value={linksBioForm.url}
                  onChange={(e) => setLinksBioForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {LINK_BIO_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setLinksBioForm((f) => ({ ...f, icon: emoji }))}
                    className={`w-10 h-10 rounded-xl border-2 text-xl flex items-center justify-center transition-colors ${
                      linksBioForm.icon === emoji
                        ? 'border-[#F87116] bg-[#F87116]/10'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setLinksBioModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#F87116] hover:bg-[#F87116]/90"
              disabled={
                !linksBioForm.label.trim() ||
                (linksBioForm.button_type === 'url' && !linksBioForm.url.trim()) ||
                linkBioMutations.create.isPending ||
                linkBioMutations.update.isPending
              }
              onClick={() => {
                if (linksBioEditing) {
                  linkBioMutations.update.mutate(
                    {
                      id: linksBioEditing.id,
                      label: linksBioForm.label.trim(),
                      description: linksBioForm.description.trim() || null,
                      button_type: linksBioForm.button_type,
                      url: linksBioForm.button_type === 'url' ? linksBioForm.url.trim() || null : null,
                      icon: linksBioForm.icon,
                    },
                    {
                      onSuccess: () => {
                        toast({ title: 'Botão atualizado' });
                        setLinksBioModalOpen(false);
                        setLinksBioEditing(null);
                      },
                      onError: (err) => toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' }),
                    }
                  );
                } else if (restaurantId) {
                  const payload: CreateLinkBioButtonPayload = {
                    restaurant_id: restaurantId,
                    sort_order: linkBioButtons.length,
                    label: linksBioForm.label.trim(),
                    description: linksBioForm.description.trim() || null,
                    url: linksBioForm.button_type === 'url' ? linksBioForm.url.trim() || null : null,
                    icon: linksBioForm.icon,
                    button_type: linksBioForm.button_type,
                  };
                  linkBioMutations.create.mutate(payload, {
                    onSuccess: () => {
                      toast({ title: linksBioEditingDefault ? 'Botão personalizado' : 'Botão adicionado' });
                      setLinksBioModalOpen(false);
                      setLinksBioEditingDefault(null);
                      setLinksBioForm({ label: '', description: '', url: '', icon: '🔗', button_type: 'url' });
                    },
                    onError: (err) => toast({ title: 'Erro ao adicionar', description: err.message, variant: 'destructive' }),
                  });
                }
              }}
            >
              {(linkBioMutations.create.isPending || linkBioMutations.update.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : linksBioEditing ? (
                'Salvar'
              ) : (
                'Adicionar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel de Gestão de Usuários (mesmo componente usado pelo super-admin) */}
      {canAccessUsers && restaurantId && (
        <RestaurantUsersPanel
          open={usersPanelOpen}
          onClose={() => setUsersPanelOpen(false)}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
        />
      )}
    </AdminPageLayout>
  );
}
