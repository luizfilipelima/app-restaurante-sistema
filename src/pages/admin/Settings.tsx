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
  { key: 'mon', label: 'Segunda',  short: 'Seg' },
  { key: 'tue', label: 'Terça',    short: 'Ter' },
  { key: 'wed', label: 'Quarta',   short: 'Qua' },
  { key: 'thu', label: 'Quinta',   short: 'Qui' },
  { key: 'fri', label: 'Sexta',    short: 'Sex' },
  { key: 'sat', label: 'Sábado',   short: 'Sáb' },
  { key: 'sun', label: 'Domingo',  short: 'Dom' },
];

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 ${
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

// ─── BentoCard ─────────────────────────────────────────────────────────────────

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
    <div className={`rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent ? 'bg-[#F87116]/10' : 'bg-muted'
        }`}>
          <Icon
            className={accent ? 'text-[#F87116]' : 'text-muted-foreground'}
            style={{ height: 18, width: 18 }}
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground leading-tight">{title}</h2>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── ToggleRow ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
  activeColor  = 'bg-emerald-50 border-emerald-200',
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

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
      {children}
    </Label>
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
    name:                    '',
    phone:                   '',
    whatsapp:                '',
    phone_country:           'BR' as 'BR' | 'PY',
    currency:                'BRL' as 'BRL' | 'PYG',
    language:                'pt' as 'pt' | 'es',
    instagram_url:           '',
    logo:                    '',
    is_manually_closed:      false,
    always_open:             false,
    opening_hours:           {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width:       '80mm' as PrintPaperWidth,
  });

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
      setFormData({
        name:                    data.name              || '',
        phone:                   data.phone             || '',
        whatsapp:                data.whatsapp          || '',
        phone_country:           data.phone_country === 'PY' ? 'PY' : 'BR',
        currency:                data.currency       === 'PYG' ? 'PYG' : 'BRL',
        language:                data.language       === 'es'  ? 'es'  : 'pt',
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
      });
    } catch (err) {
      console.error('Erro ao carregar restaurante:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
        updated_at:              new Date().toISOString(),
      }).eq('id', restaurantId);
      if (error) throw error;
      toast({ title: 'Configurações salvas com sucesso!' });
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
    <div className="w-full max-w-7xl space-y-5 pb-10">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Informações e preferências do seu restaurante
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSubmit()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F87116] to-orange-500 text-white font-semibold text-sm shadow-md shadow-orange-200/40 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      {/* ── Bento Grid principal ───────────────────────────────────────────── */}
      {/*
        Layout:
          mobile  (1 col): tudo empilhado
          tablet  (md, 2 cols): Logo|Identidade / Status(full) / Contato(full) / Horários(full) / Impressão(full)
          desktop (lg, 4 cols): [Logo][Identidade×2][Status] / [Contato×4] / [Horários×3][Impressão]
      */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start"
      >

        {/* ═══ 1. Logo ═══════════════════════════════════════════════════════ */}
        <BentoCard
          icon={ImageIcon}
          title="Logo"
          description="PNG, JPG ou WebP — convertida para WebP 80%."
          accent
          className="md:col-span-1 lg:col-span-1"
        >
          <div className="flex flex-col items-center gap-3">
            {/* Preview */}
            {formData.logo ? (
              <div className="relative">
                <img
                  src={formData.logo}
                  alt="Logo"
                  className="h-24 w-24 rounded-2xl object-cover border-2 border-border shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, logo: '' }))}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center shadow hover:brightness-110 transition-colors"
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

            {/* Upload hidden input */}
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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-[#F87116] hover:text-[#F87116] hover:bg-orange-50 transition-all disabled:opacity-50"
            >
              {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {logoUploading ? 'Enviando…' : 'Fazer upload'}
            </button>

            {/* URL manual */}
            <div className="w-full space-y-1">
              <SectionLabel>Ou cole uma URL</SectionLabel>
              <Input
                type="url"
                value={formData.logo}
                onChange={(e) => setFormData(f => ({ ...f, logo: e.target.value }))}
                placeholder="https://..."
                className="text-xs h-8"
              />
            </div>
          </div>
        </BentoCard>

        {/* ═══ 2. Identidade ══════════════════════════════════════════════════ */}
        <BentoCard
          icon={Globe}
          title="Identidade"
          description="Nome, idioma e moeda exibidos no cardápio."
          className="md:col-span-1 lg:col-span-2"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <SectionLabel>Nome do Restaurante</SectionLabel>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                required
                className="font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <SectionLabel>Moeda</SectionLabel>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData(f => ({ ...f, currency: v as 'BRL' | 'PYG' }))}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">🇧🇷 Real (R$)</SelectItem>
                    <SelectItem value="PYG">🇵🇾 Guaraní (Gs.)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Cardápio e pedidos</p>
              </div>

              <div className="space-y-1.5">
                <SectionLabel>Idioma</SectionLabel>
                <Select
                  value={formData.language}
                  onValueChange={(v) => setFormData(f => ({ ...f, language: v as 'pt' | 'es' }))}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Interface do cliente</p>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* ═══ 3. Status ══════════════════════════════════════════════════════ */}
        {/* tablet: full row (2 toggles side-by-side) | desktop: 1 col (stacked) */}
        <BentoCard
          icon={Wifi}
          title="Status"
          description="Controle de abertura do estabelecimento."
          className="md:col-span-2 lg:col-span-1"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
            <ToggleRow
              label="Sempre aberto (24h)"
              description="Ignora os horários abaixo."
              checked={formData.always_open}
              onChange={(v) => setFormData(f => ({ ...f, always_open: v }))}
              icon={Sun}
              activeColor="bg-emerald-50 border-emerald-200"
            />
            <ToggleRow
              label="Fechado agora (manual)"
              description="Força status fechado."
              checked={formData.is_manually_closed}
              onChange={(v) => setFormData(f => ({ ...f, is_manually_closed: v }))}
              icon={XCircle}
              activeColor="bg-red-50 border-red-200"
            />
          </div>
        </BentoCard>

        {/* ═══ 4. Contato ═════════════════════════════════════════════════════ */}
        <BentoCard
          icon={Phone}
          title="Contato"
          description="Telefone, WhatsApp e redes sociais exibidos no cardápio."
          className="md:col-span-2 lg:col-span-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <SectionLabel>País</SectionLabel>
              <Select
                value={formData.phone_country}
                onValueChange={(v) => setFormData(f => ({ ...f, phone_country: v as 'BR' | 'PY' }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">🇧🇷 Brasil (+55)</SelectItem>
                  <SelectItem value="PY">🇵🇾 Paraguai (+595)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <SectionLabel>Telefone</SectionLabel>
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
              <SectionLabel>WhatsApp</SectionLabel>
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
              <SectionLabel>
                <span className="inline-flex items-center gap-1"><Instagram style={{ height: 11, width: 11, display: 'inline' }} /> Instagram</span>
              </SectionLabel>
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

        {/* ═══ 5. Horários por dia ════════════════════════════════════════════ */}
        <BentoCard
          icon={Clock}
          title="Horários de funcionamento"
          description={
            formData.always_open
              ? 'Ignorados — estabelecimento definido como sempre aberto.'
              : 'Defina abertura e fechamento por dia da semana.'
          }
          className="md:col-span-2 lg:col-span-3"
        >
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
                  {/* Dia */}
                  <div className="w-14 flex-shrink-0">
                    <span className={`text-xs font-semibold hidden sm:block ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {label}
                    </span>
                    <span className={`text-xs font-semibold sm:hidden ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {short}
                    </span>
                  </div>

                  {/* Checkbox aberto/fechado */}
                  <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 w-24">
                    <input
                      type="checkbox"
                      checked={isClosed}
                      onChange={(e) => {
                        const next = { ...formData.opening_hours };
                        next[key] = e.target.checked ? null : { open: '11:00', close: '23:00' };
                        setFormData(f => ({ ...f, opening_hours: next }));
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

                  {/* Horários */}
                  {!isClosed ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Input
                        type="time"
                        value={slot?.open || '11:00'}
                        onChange={(e) => {
                          const next = { ...formData.opening_hours };
                          next[key] = { open: e.target.value, close: next[key]?.close || '23:00' };
                          setFormData(f => ({ ...f, opening_hours: next }));
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
                          setFormData(f => ({ ...f, opening_hours: next }));
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
        </BentoCard>

        {/* ═══ 6. Impressão ═══════════════════════════════════════════════════ */}
        <BentoCard
          icon={Printer}
          title="Impressão"
          description="Cupom não fiscal para impressoras térmicas via navegador."
          className="md:col-span-2 lg:col-span-1"
        >
          <div className="space-y-4">
            <ToggleRow
              label="Impressão automática"
              description="Abre janela de impressão ao receber novo pedido."
              checked={formData.print_auto_on_new_order}
              onChange={(v) => setFormData(f => ({ ...f, print_auto_on_new_order: v }))}
              icon={AlarmClock}
            />

            <div className="space-y-1.5">
              <SectionLabel>Largura do papel</SectionLabel>
              <Select
                value={formData.print_paper_width}
                onValueChange={(v) => setFormData(f => ({ ...f, print_paper_width: v as PrintPaperWidth }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58 mm — bobina estreita</SelectItem>
                  <SelectItem value="80mm">80 mm — bobina padrão</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Ajuste para sua impressora térmica.</p>
            </div>
          </div>
        </BentoCard>

        {/* ── Botão salvar (rodapé) ── */}
        <div className="md:col-span-2 lg:col-span-4 flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#F87116] to-orange-500 text-white font-semibold text-sm shadow-md shadow-orange-200/40 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>

      </form>
    </div>
  );
}
