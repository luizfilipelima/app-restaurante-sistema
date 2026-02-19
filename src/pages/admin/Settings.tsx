import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { DayKey, PrintPaperWidth } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { toast } from '@/hooks/use-toast';
import {
  Save, Upload, Loader2, Clock, Instagram, Printer,
  Phone, Globe, ImageIcon, CheckCircle2, XCircle,
  Sun, AlarmClock, X, Wifi,
} from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tue', label: 'Terça-feira',   short: 'Ter' },
  { key: 'wed', label: 'Quarta-feira',  short: 'Qua' },
  { key: 'thu', label: 'Quinta-feira',  short: 'Qui' },
  { key: 'fri', label: 'Sexta-feira',   short: 'Sex' },
  { key: 'sat', label: 'Sábado',        short: 'Sáb' },
  { key: 'sun', label: 'Domingo',       short: 'Dom' },
];

// ─── Subcomponente: Toggle Switch estilizado ──────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 ${
        checked ? 'bg-[#F87116]' : 'bg-slate-200'
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

// ─── Subcomponente: Card Bento ────────────────────────────────────────────────

function BentoCard({
  icon: Icon,
  title,
  description,
  children,
  className = '',
  accent = false,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent ? 'bg-[#F87116]/10' : 'bg-slate-100'
        }`}>
          <Icon className={`h-4.5 w-4.5 ${accent ? 'text-[#F87116]' : 'text-slate-500'}`} style={{ height: '18px', width: '18px' }} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Subcomponente: ToggleRow ──────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
  activeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200',
  inactiveColor = 'text-slate-600 bg-slate-50 border-slate-200',
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
    <div className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${checked ? activeColor : inactiveColor}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${checked ? 'text-emerald-600' : 'text-slate-400'}`} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminSettings() {
  const restaurantId = useAdminRestaurantId();
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name:               '',
    phone:              '',
    whatsapp:           '',
    phone_country:      'BR' as 'BR' | 'PY',
    currency:           'BRL' as 'BRL' | 'PYG',
    language:           'pt' as 'pt' | 'es',
    instagram_url:      '',
    logo:               '',
    is_manually_closed: false,
    always_open:        false,
    opening_hours:      {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width:  '80mm' as PrintPaperWidth,
  });

  useEffect(() => {
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  const loadRestaurant = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      if (error) throw error;
      const hours = (data.opening_hours || {}) as Record<DayKey, { open: string; close: string } | null>;
      setFormData({
        name:               data.name              || '',
        phone:              data.phone             || '',
        whatsapp:           data.whatsapp          || '',
        phone_country:      (data.phone_country === 'PY' ? 'PY' : 'BR'),
        currency:           (data.currency       === 'PYG' ? 'PYG' : 'BRL'),
        language:           (data.language       === 'es'  ? 'es'  : 'pt'),
        instagram_url:      data.instagram_url    || '',
        logo:               data.logo             || '',
        is_manually_closed: !!data.is_manually_closed,
        always_open:        !!data.always_open,
        opening_hours:      DAYS.reduce(
          (acc, d) => ({ ...acc, [d.key]: hours[d.key] || null }),
          {} as Record<DayKey, { open: string; close: string } | null>
        ),
        print_auto_on_new_order: !!data.print_auto_on_new_order,
        print_paper_width:  (data.print_paper_width === '58mm' ? '58mm' : '80mm'),
      });
    } catch (err) {
      console.error('Erro ao carregar restaurante:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('restaurants')
        .update({
          name:               formData.name,
          phone:              formData.phone,
          whatsapp:           formData.whatsapp,
          phone_country:      formData.phone_country,
          currency:           formData.currency,
          language:           formData.language,
          instagram_url:      formData.instagram_url || null,
          logo:               formData.logo,
          is_manually_closed: formData.is_manually_closed,
          always_open:        formData.always_open,
          opening_hours:      formData.opening_hours,
          print_auto_on_new_order: formData.print_auto_on_new_order,
          print_paper_width:  formData.print_paper_width,
          updated_at:         new Date().toISOString(),
        })
        .eq('id', restaurantId);
      if (error) throw error;
      toast({ title: 'Configurações salvas!', variant: 'default' });
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

  const phonePlaceholder = formData.phone_country === 'BR' ? '(11) 99999-9999' : '981 123 456';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Cabeçalho ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure as informações e preferências do seu restaurante
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit as any}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F87116] to-orange-500 text-white font-semibold text-sm shadow-md shadow-orange-200/50 hover:brightness-105 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ════ ROW 1: Logo + Informações Básicas ════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Logo ── */}
          <BentoCard
            icon={ImageIcon}
            title="Logo do Restaurante"
            description="PNG, JPG ou WebP. Convertida para WebP (80%)."
            accent
          >
            <div className="flex flex-col items-center gap-4">
              {/* Preview */}
              <div className="relative">
                {formData.logo ? (
                  <div className="relative">
                    <img
                      src={formData.logo}
                      alt="Logo"
                      className="h-28 w-28 rounded-2xl object-cover border-2 border-slate-200 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, logo: '' }))}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                      title="Remover logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-28 w-28 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-[10px] font-medium">Sem logo</span>
                  </div>
                )}
              </div>

              {/* Upload */}
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
                    setFormData(f => ({ ...f, logo: url }));
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
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-[#F87116] hover:text-[#F87116] hover:bg-orange-50 transition-all disabled:opacity-50"
              >
                {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logoUploading ? 'Enviando…' : 'Fazer upload'}
              </button>

              {/* URL manual */}
              <div className="w-full space-y-1">
                <Label className="text-xs text-muted-foreground">Ou cole uma URL</Label>
                <Input
                  type="url"
                  value={formData.logo}
                  onChange={(e) => setFormData(f => ({ ...f, logo: e.target.value }))}
                  placeholder="https://..."
                  className="text-xs"
                />
              </div>
            </div>
          </BentoCard>

          {/* ── Identidade ── */}
          <BentoCard
            icon={Globe}
            title="Identidade"
            description="Nome, idioma e moeda do cardápio."
            className="lg:col-span-2"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome do Restaurante</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  required
                  className="font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Moeda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => setFormData(f => ({ ...f, currency: v as 'BRL' | 'PYG' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">🇧🇷 Real (R$)</SelectItem>
                      <SelectItem value="PYG">🇵🇾 Guaraní (Gs.)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Exibido no cardápio e pedidos</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Idioma</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(v) => setFormData(f => ({ ...f, language: v as 'pt' | 'es' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">🇧🇷 Português</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Interface do cliente no cardápio</p>
                </div>
              </div>
            </div>
          </BentoCard>
        </div>

        {/* ════ ROW 2: Contato ════ */}
        <BentoCard
          icon={Phone}
          title="Contato"
          description="Telefone, WhatsApp e redes sociais exibidos no cardápio."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">País</Label>
              <Select
                value={formData.phone_country}
                onValueChange={(v) => setFormData(f => ({ ...f, phone_country: v as 'BR' | 'PY' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">🇧🇷 Brasil (+55)</SelectItem>
                  <SelectItem value="PY">🇵🇾 Paraguai (+595)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                placeholder={phonePlaceholder}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder={phonePlaceholder}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instagram_url" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </Label>
              <Input
                id="instagram_url"
                type="url"
                value={formData.instagram_url}
                onChange={(e) => setFormData(f => ({ ...f, instagram_url: e.target.value }))}
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>
        </BentoCard>

        {/* ════ ROW 3: Horário + Status ════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Status de funcionamento ── */}
          <BentoCard
            icon={Wifi}
            title="Status do estabelecimento"
            description="Controle quando seu restaurante aparece aberto ou fechado."
          >
            <div className="space-y-3">
              <ToggleRow
                label="Sempre aberto (24h)"
                description="Ignora os horários configurados."
                checked={formData.always_open}
                onChange={(v) => setFormData(f => ({ ...f, always_open: v }))}
                icon={Sun}
                activeColor="text-emerald-700 bg-emerald-50 border-emerald-200"
                inactiveColor="text-slate-600 bg-slate-50 border-slate-200"
              />
              <ToggleRow
                label="Fechado agora (manual)"
                description="Força status fechado, independente do horário."
                checked={formData.is_manually_closed}
                onChange={(v) => setFormData(f => ({ ...f, is_manually_closed: v }))}
                icon={XCircle}
                activeColor="text-red-700 bg-red-50 border-red-200"
                inactiveColor="text-slate-600 bg-slate-50 border-slate-200"
              />
            </div>
          </BentoCard>

          {/* ── Horários por dia ── */}
          <BentoCard
            icon={Clock}
            title="Horários por dia"
            description={formData.always_open ? 'Ignorados — estabelecimento sempre aberto.' : undefined}
            className="lg:col-span-2"
          >
            <div className={`space-y-2 ${formData.always_open ? 'opacity-40 pointer-events-none select-none' : ''}`}>
              {DAYS.map(({ key, label, short }) => {
                const slot = formData.opening_hours[key];
                const isClosed = !slot;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                      isClosed ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="w-12 flex-shrink-0">
                      <span className={`text-xs font-bold hidden sm:block ${isClosed ? 'text-slate-400' : 'text-foreground'}`}>{label.split('-')[0]}</span>
                      <span className={`text-xs font-bold sm:hidden ${isClosed ? 'text-slate-400' : 'text-foreground'}`}>{short}</span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isClosed}
                        onChange={(e) => {
                          const next = { ...formData.opening_hours };
                          next[key] = e.target.checked ? null : { open: '11:00', close: '23:00' };
                          setFormData(f => ({ ...f, opening_hours: next }));
                        }}
                        className="h-3.5 w-3.5 rounded accent-slate-400"
                      />
                      <span className={`text-[11px] font-medium flex items-center gap-0.5 ${isClosed ? 'text-slate-400' : 'text-muted-foreground'}`}>
                        {isClosed
                          ? <><XCircle className="h-3 w-3" /> Fechado</>
                          : <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Aberto</>
                        }
                      </span>
                    </label>

                    {!isClosed && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Input
                          type="time"
                          value={slot?.open || '11:00'}
                          onChange={(e) => {
                            const next = { ...formData.opening_hours };
                            next[key] = { open: e.target.value, close: next[key]?.close || '23:00' };
                            setFormData(f => ({ ...f, opening_hours: next }));
                          }}
                          className="h-8 w-24 text-xs text-center"
                        />
                        <span className="text-xs text-slate-400 flex-shrink-0">–</span>
                        <Input
                          type="time"
                          value={slot?.close || '23:00'}
                          onChange={(e) => {
                            const next = { ...formData.opening_hours };
                            next[key] = { open: next[key]?.open || '11:00', close: e.target.value };
                            setFormData(f => ({ ...f, opening_hours: next }));
                          }}
                          className="h-8 w-24 text-xs text-center"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </BentoCard>
        </div>

        {/* ════ ROW 4: Impressão ════ */}
        <BentoCard
          icon={Printer}
          title="Impressão de pedidos"
          description="Cupom não fiscal para impressoras térmicas. O navegador abrirá o diálogo de impressão ao receber novos pedidos."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <ToggleRow
              label="Impressão automática"
              description="Abre janela de impressão ao chegar um novo pedido."
              checked={formData.print_auto_on_new_order}
              onChange={(v) => setFormData(f => ({ ...f, print_auto_on_new_order: v }))}
              icon={AlarmClock}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Largura do papel</Label>
              <Select
                value={formData.print_paper_width}
                onValueChange={(v) => setFormData(f => ({ ...f, print_paper_width: v as PrintPaperWidth }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58 mm — bobina estreita</SelectItem>
                  <SelectItem value="80mm">80 mm — bobina padrão</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Ajuste conforme sua impressora térmica.</p>
            </div>
          </div>
        </BentoCard>

        {/* ── Botão salvar (bottom) ── */}
        <div className="flex justify-end pt-2 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#F87116] to-orange-500 text-white font-semibold text-sm shadow-md shadow-orange-200/50 hover:brightness-105 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>

      </form>
    </div>
  );
}
