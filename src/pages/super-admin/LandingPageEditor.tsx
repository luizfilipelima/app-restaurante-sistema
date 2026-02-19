/**
 * Editor visual da Landing Page — exclusivo para Super Admin.
 *
 * Organizado em abas por seção; cada aba permite editar os textos,
 * links e listas daquela parte da landing page premium (/landing-page).
 *
 * Estrutura de abas:
 *   Hero · Strip · Problema · Funcionalidades · Planos · Depoimentos · CTA Final · Navbar & Rodapé
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useLandingPageContent,
  useUpsertLandingSection,
  type LandingContent,
  type LandingUpsertItem,
} from '@/hooks/queries/useLandingPageContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Layout,
  Star,
  ChevronRight,
  MessageSquare,
  Zap,
  Grid3x3,
  CreditCard,
  Quote,
  Rocket,
  MonitorSmartphone,
  Info,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function get(content: LandingContent, section: string, key: string, fallback = ''): string {
  return content[section]?.[key] ?? fallback;
}

// ─── Componente de campo editável ─────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: 'text' | 'url';
  rows?: number;
}

function Field({ label, hint, value, onChange, multiline, type = 'text', rows = 3 }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-slate-600">{label}</Label>
        {hint && (
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" />
            {hint}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

// ─── Lista simples de strings (add/remove) ────────────────────────────────────

interface StringListProps {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

function StringList({ label, hint, items, onChange, placeholder = 'Novo item...' }: StringListProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft('');
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const update = (i: number, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? v : it)));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-slate-600">{label}</Label>
        {hint && (
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" />
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => remove(i)}
              className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="h-8 text-sm flex-1"
        />
        <Button variant="outline" size="sm" onClick={add} className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

// ─── Lista de depoimentos (objetos) ──────────────────────────────────────────

interface Testimonial { quote: string; name: string; role: string; initials: string }

interface TestimonialsListProps {
  items: Testimonial[];
  onChange: (items: Testimonial[]) => void;
}

function TestimonialsList({ items, onChange }: TestimonialsListProps) {
  const blank = (): Testimonial => ({ quote: '', name: '', role: '', initials: '' });

  const update = (i: number, field: keyof Testimonial, v: string) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: v } : it));

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Depoimento {i + 1}</span>
            <button
              onClick={() => remove(i)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={t.quote}
            onChange={(e) => update(i, 'quote', e.target.value)}
            placeholder="Texto do depoimento..."
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500">Nome</Label>
              <Input
                value={t.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                className="h-8 text-sm mt-1"
                placeholder="Nome Sobrenome"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500">Estabelecimento</Label>
              <Input
                value={t.role}
                onChange={(e) => update(i, 'role', e.target.value)}
                className="h-8 text-sm mt-1"
                placeholder="Pizzaria X"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500">Iniciais</Label>
              <Input
                value={t.initials}
                onChange={(e) => update(i, 'initials', e.target.value.slice(0, 3).toUpperCase())}
                className="h-8 text-sm mt-1"
                placeholder="AB"
                maxLength={3}
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, blank()])}
        className="w-full gap-1.5 h-9"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar Depoimento
      </Button>
    </div>
  );
}

// ─── Lista de dores/problemas ─────────────────────────────────────────────────

interface Pain { emoji: string; text: string }

interface PainsListProps {
  items: Pain[];
  onChange: (items: Pain[]) => void;
}

function PainsList({ items, onChange }: PainsListProps) {
  const update = (i: number, field: keyof Pain, v: string) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: v } : it));

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {items.map((pain, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={pain.emoji}
            onChange={(e) => update(i, 'emoji', e.target.value)}
            className="h-9 w-14 text-center text-lg"
            placeholder="🔥"
          />
          <Input
            value={pain.text}
            onChange={(e) => update(i, 'text', e.target.value)}
            className="h-9 text-sm flex-1"
            placeholder="Descrição do problema..."
          />
          <button
            onClick={() => remove(i)}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { emoji: '❓', text: '' }])}
        className="w-full gap-1.5 h-9"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar Problema
      </Button>
    </div>
  );
}

// ─── Wrapper de seção com botão Salvar ────────────────────────────────────────

interface SectionWrapperProps {
  title: string;
  description: string;
  icon: React.ElementType;
  saving: boolean;
  hasChanges: boolean;
  onSave: () => void;
  children: React.ReactNode;
}

function SectionWrapper({
  title, description, icon: Icon, saving, hasChanges, onSave, children,
}: SectionWrapperProps) {
  return (
    <div className="space-y-6">
      {/* Header da seção */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4.5 w-4.5 text-[#F87116]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {hasChanges && !saving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Não salvo
            </span>
          )}
          <Button
            onClick={onSave}
            disabled={!hasChanges || saving}
            size="sm"
            className="gap-1.5 bg-[#F87116] hover:bg-orange-500 text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? 'Salvando...' : 'Salvar Seção'}
          </Button>
        </div>
      </div>

      {/* Campos */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}

// ─── Abas ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'hero',         label: 'Hero',           icon: Zap },
  { id: 'social_strip', label: 'Strip',          icon: Star },
  { id: 'problem',      label: 'Problema',       icon: MessageSquare },
  { id: 'features',     label: 'Funcionalidades',icon: Grid3x3 },
  { id: 'pricing',      label: 'Planos',         icon: CreditCard },
  { id: 'testimonials', label: 'Depoimentos',    icon: Quote },
  { id: 'final_cta',    label: 'CTA Final',      icon: Rocket },
  { id: 'navbar',       label: 'Navbar & Rodapé',icon: Layout },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LandingPageEditor() {
  const [activeTab, setActiveTab] = useState<TabId>('hero');
  const { data: content, isLoading, isError } = useLandingPageContent();
  const upsert = useUpsertLandingSection();

  // ── Estado local de draft por seção ──────────────────────────────────────────
  // Inicializados como undefined; populados via useEffect quando o content chega
  type Draft = Record<string, string>;
  const [drafts, setDrafts] = useState<Record<TabId, Draft>>({
    hero:         {},
    social_strip: {},
    problem:      {},
    features:     {},
    pricing:      {},
    testimonials: {},
    final_cta:    {},
    navbar:       {},
  });

  useEffect(() => {
    if (!content) return;
    const init: Record<TabId, Draft> = {
      hero:         { ...content['hero']         },
      social_strip: { ...content['social_strip'] },
      problem:      { ...content['problem']      },
      features:     { ...content['features']     },
      pricing:      { ...content['pricing']      },
      testimonials: { ...content['testimonials'] },
      final_cta:    { ...content['final_cta']    },
      navbar:       { ...content['navbar']       },
    };
    setDrafts(init);
  }, [content]);

  const setField = useCallback((section: TabId, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }, []);

  const hasChanges = (section: TabId): boolean => {
    if (!content) return false;
    const original = content[section] ?? {};
    const draft    = drafts[section] ?? {};
    return Object.entries(draft).some(([k, v]) => v !== (original[k] ?? ''));
  };

  const saveSection = async (section: TabId) => {
    const draft = drafts[section];
    if (!draft) return;

    const items: LandingUpsertItem[] = Object.entries(draft).map(([key, value]) => ({
      section,
      key,
      value,
    }));

    try {
      await upsert.mutateAsync(items);
      toast({
        title: 'Seção salva',
        description: 'As alterações foram publicadas na landing page.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      });
    }
  };

  // ── Parsers de JSON ───────────────────────────────────────────────────────────

  const getStringList = (section: TabId, key: string): string[] => {
    try { return JSON.parse(drafts[section]?.[key] ?? '[]') as string[]; }
    catch { return []; }
  };

  const setStringList = (section: TabId, key: string, items: string[]) =>
    setField(section, key, JSON.stringify(items));

  const getPainsList = (): Pain[] => {
    try { return JSON.parse(drafts.problem?.pains ?? '[]') as Pain[]; }
    catch { return []; }
  };

  const getTestimonialsList = (): Testimonial[] => {
    try { return JSON.parse(drafts.testimonials?.items ?? '[]') as Testimonial[]; }
    catch { return []; }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-slate-400">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="font-semibold text-slate-600">Não foi possível carregar o conteúdo.</p>
        <p className="text-sm text-center max-w-sm">
          Execute a migration <code>20260240_landing_page_content.sql</code> e verifique as permissões.
        </p>
      </div>
    );
  }

  const saving = upsert.isPending;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">

      {/* Cabeçalho da página */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MonitorSmartphone className="h-5 w-5 text-[#F87116]" />
            <h1 className="text-2xl font-bold text-slate-900">Editor da Landing Page</h1>
          </div>
          <p className="text-sm text-slate-500">
            Edite textos, links e listas da página pública{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">/landing-page</code>.
            As alterações são publicadas imediatamente após salvar cada seção.
          </p>
        </div>
        <a
          href="/landing-page"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 flex-shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver página
        </a>
      </div>

      {/* Aviso informativo */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          <strong>Dica:</strong> Use o botão "Ver página" para abrir a landing page em outra aba
          e conferir as alterações em tempo real após salvar cada seção.
        </p>
      </div>

      {/* Abas de seção */}
      <div className="space-y-6">
        {/* Navegação das abas */}
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-white text-[#F87116] shadow-sm border border-orange-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                {tab.label}
                {hasChanges(tab.id) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        {activeTab === 'hero' && (
          <SectionWrapper
            title="Seção Hero"
            description="Primeira tela da landing page. Título, subtítulo, estatísticas e links dos CTAs."
            icon={Zap}
            saving={saving}
            hasChanges={hasChanges('hero')}
            onSave={() => saveSection('hero')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Field
                  label="Texto do Badge"
                  hint="Pequeno badge acima do título"
                  value={drafts.hero?.badge_text ?? ''}
                  onChange={(v) => setField('hero', 'badge_text', v)}
                />
              </div>
              <div className="md:col-span-2">
                <Field
                  label="Título Principal"
                  value={drafts.hero?.headline ?? ''}
                  onChange={(v) => setField('hero', 'headline', v)}
                  multiline
                  rows={2}
                />
              </div>
              <Field
                label="Palavra em destaque no título"
                hint="Será colorida em laranja"
                value={drafts.hero?.headline_highlight ?? ''}
                onChange={(v) => setField('hero', 'headline_highlight', v)}
              />
              <div className="md:col-span-2">
                <Field
                  label="Subtítulo"
                  value={drafts.hero?.subheadline ?? ''}
                  onChange={(v) => setField('hero', 'subheadline', v)}
                  multiline
                  rows={2}
                />
              </div>

              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Botões CTA</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Botão Principal (WhatsApp)"
                    value={drafts.hero?.cta_primary_label ?? ''}
                    onChange={(v) => setField('hero', 'cta_primary_label', v)}
                  />
                  <Field
                    label="Botão Secundário"
                    value={drafts.hero?.cta_secondary_label ?? ''}
                    onChange={(v) => setField('hero', 'cta_secondary_label', v)}
                  />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Links</p>
                <div className="grid grid-cols-1 gap-4">
                  <Field
                    label="Link WhatsApp (WA_LINK)"
                    hint="Usado em todos os botões CTA"
                    value={drafts.hero?.wa_link ?? ''}
                    onChange={(v) => setField('hero', 'wa_link', v)}
                    type="url"
                  />
                  <Field
                    label="Link da Plataforma (APP_LINK)"
                    hint="Botão Entrar e link do rodapé"
                    value={drafts.hero?.app_link ?? ''}
                    onChange={(v) => setField('hero', 'app_link', v)}
                    type="url"
                  />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Estatísticas (mini-prova social)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key_v: 'stat_1_value', key_l: 'stat_1_label', label: 'Stat 1' },
                    { key_v: 'stat_2_value', key_l: 'stat_2_label', label: 'Stat 2' },
                    { key_v: 'stat_3_value', key_l: 'stat_3_label', label: 'Stat 3' },
                  ].map(({ key_v, key_l, label }) => (
                    <div key={key_v} className="rounded-lg border border-slate-100 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">{label}</p>
                      <Input
                        value={drafts.hero?.[key_v] ?? ''}
                        onChange={(e) => setField('hero', key_v, e.target.value)}
                        placeholder="500+"
                        className="h-8 text-sm font-bold text-center"
                      />
                      <Input
                        value={drafts.hero?.[key_l] ?? ''}
                        onChange={(e) => setField('hero', key_l, e.target.value)}
                        placeholder="Restaurantes"
                        className="h-7 text-xs text-center text-slate-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <Field
                  label="Texto da notificação flutuante"
                  hint="Apareçe no mockup do telefone"
                  value={drafts.hero?.notification_text ?? ''}
                  onChange={(v) => setField('hero', 'notification_text', v)}
                />
              </div>
            </div>
          </SectionWrapper>
        )}

        {/* ── Strip de Destaque ─────────────────────────────────────────────── */}
        {activeTab === 'social_strip' && (
          <SectionWrapper
            title="Strip de Destaque"
            description="Faixa animada que desfila funcionalidades do produto."
            icon={Star}
            saving={saving}
            hasChanges={hasChanges('social_strip')}
            onSave={() => saveSection('social_strip')}
          >
            <StringList
              label="Itens do strip"
              hint="Ordem de exibição (se repete em loop)"
              items={getStringList('social_strip', 'items')}
              onChange={(items) => setStringList('social_strip', 'items', items)}
              placeholder="Ex: Cardápio Digital"
            />
          </SectionWrapper>
        )}

        {/* ── Problema ─────────────────────────────────────────────────────── */}
        {activeTab === 'problem' && (
          <SectionWrapper
            title="Seção Problema"
            description='Seção "Você é refém do seu restaurante?" com dores do cliente.'
            icon={MessageSquare}
            saving={saving}
            hasChanges={hasChanges('problem')}
            onSave={() => saveSection('problem')}
          >
            <Field
              label="Título"
              value={drafts.problem?.headline ?? ''}
              onChange={(v) => setField('problem', 'headline', v)}
            />
            <Field
              label="Subtítulo"
              value={drafts.problem?.subheadline ?? ''}
              onChange={(v) => setField('problem', 'subheadline', v)}
            />
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-2 block">
                Lista de dores <span className="text-slate-400 font-normal">(emoji + texto)</span>
              </Label>
              <PainsList
                items={getPainsList()}
                onChange={(items) => setField('problem', 'pains', JSON.stringify(items))}
              />
            </div>
            <Field
              label="Texto de fechamento"
              hint="Aparece abaixo das dores"
              value={drafts.problem?.closing_text ?? ''}
              onChange={(v) => setField('problem', 'closing_text', v)}
              multiline
              rows={2}
            />
          </SectionWrapper>
        )}

        {/* ── Funcionalidades ───────────────────────────────────────────────── */}
        {activeTab === 'features' && (
          <SectionWrapper
            title="Seção Funcionalidades"
            description="Grid Bento com as 4 principais features do produto."
            icon={Grid3x3}
            saving={saving}
            hasChanges={hasChanges('features')}
            onSave={() => saveSection('features')}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Rótulo da seção"
                hint="Pequeno texto acima do título (ex: A Solução)"
                value={drafts.features?.section_label ?? ''}
                onChange={(v) => setField('features', 'section_label', v)}
              />
              <Field
                label="Título da seção"
                value={drafts.features?.headline ?? ''}
                onChange={(v) => setField('features', 'headline', v)}
              />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Os cards das funcionalidades (KDS, Cardápio, Offline, BI) possuem conteúdo técnico
                  (mockups animados) que são editados diretamente no código.
                  Aqui você edita apenas o cabeçalho da seção.
                </p>
              </div>
            </div>
          </SectionWrapper>
        )}

        {/* ── Planos ────────────────────────────────────────────────────────── */}
        {activeTab === 'pricing' && (
          <SectionWrapper
            title="Seção de Planos"
            description="Cabeçalho da seção de preços. Os planos em si são gerenciados em Planos & Preços."
            icon={CreditCard}
            saving={saving}
            hasChanges={hasChanges('pricing')}
            onSave={() => saveSection('pricing')}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Rótulo da seção"
                value={drafts.pricing?.section_label ?? ''}
                onChange={(v) => setField('pricing', 'section_label', v)}
              />
              <Field
                label="Título"
                value={drafts.pricing?.headline ?? ''}
                onChange={(v) => setField('pricing', 'headline', v)}
              />
            </div>
            <Field
              label="Subtexto"
              hint="Aparece abaixo do título"
              value={drafts.pricing?.subtext ?? ''}
              onChange={(v) => setField('pricing', 'subtext', v)}
            />
            <div className="flex items-start gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <Info className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700 leading-relaxed">
                Para editar os nomes, descrições e preços dos planos, acesse{' '}
                <strong>Planos & Preços</strong> no menu lateral.
              </p>
            </div>
          </SectionWrapper>
        )}

        {/* ── Depoimentos ──────────────────────────────────────────────────── */}
        {activeTab === 'testimonials' && (
          <SectionWrapper
            title="Seção de Depoimentos"
            description="Avaliações e depoimentos de clientes reais."
            icon={Quote}
            saving={saving}
            hasChanges={hasChanges('testimonials')}
            onSave={() => saveSection('testimonials')}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Rótulo da seção"
                value={drafts.testimonials?.section_label ?? ''}
                onChange={(v) => setField('testimonials', 'section_label', v)}
              />
              <Field
                label="Título"
                value={drafts.testimonials?.headline ?? ''}
                onChange={(v) => setField('testimonials', 'headline', v)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-3 block">Depoimentos</Label>
              <TestimonialsList
                items={getTestimonialsList()}
                onChange={(items) => setField('testimonials', 'items', JSON.stringify(items))}
              />
            </div>
          </SectionWrapper>
        )}

        {/* ── CTA Final ────────────────────────────────────────────────────── */}
        {activeTab === 'final_cta' && (
          <SectionWrapper
            title="CTA Final"
            description="Última seção da página — chamada para ação e garantia."
            icon={Rocket}
            saving={saving}
            hasChanges={hasChanges('final_cta')}
            onSave={() => saveSection('final_cta')}
          >
            <Field
              label="Título"
              value={drafts.final_cta?.headline ?? ''}
              onChange={(v) => setField('final_cta', 'headline', v)}
              multiline
              rows={2}
            />
            <Field
              label="Texto do corpo"
              value={drafts.final_cta?.body ?? ''}
              onChange={(v) => setField('final_cta', 'body', v)}
              multiline
              rows={3}
            />
            <Field
              label="Texto do botão CTA"
              value={drafts.final_cta?.cta_label ?? ''}
              onChange={(v) => setField('final_cta', 'cta_label', v)}
            />
            <Field
              label="Texto de garantia"
              hint="Aparece abaixo do botão (caixa com ícone escudo)"
              value={drafts.final_cta?.guarantee_text ?? ''}
              onChange={(v) => setField('final_cta', 'guarantee_text', v)}
              multiline
              rows={2}
            />
          </SectionWrapper>
        )}

        {/* ── Navbar & Rodapé ────────────────────────────────────────────── */}
        {activeTab === 'navbar' && (
          <SectionWrapper
            title="Navbar & Rodapé"
            description="Links da barra de navegação e texto de copyright do rodapé."
            icon={Layout}
            saving={saving}
            hasChanges={hasChanges('navbar')}
            onSave={() => saveSection('navbar')}
          >
            <StringList
              label="Itens do menu de navegação"
              hint="Exibidos na barra superior"
              items={getStringList('navbar', 'nav_items')}
              onChange={(items) => setStringList('navbar', 'nav_items', items)}
              placeholder="Ex: Funcionalidades"
            />
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Rodapé</p>
              <Field
                label="Texto de copyright"
                hint="Aparece após o símbolo © e o ano"
                value={drafts.navbar?.copyright_text ?? get(content ?? {}, 'footer', 'copyright_text')}
                onChange={(v) => setField('navbar', 'copyright_text', v)}
              />
            </div>

            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  O logotipo e os links "Entrar" e "Acessar Plataforma" no rodapé usam o
                  <strong> APP_LINK</strong> configurado na aba <strong>Hero</strong>.
                </p>
              </div>
            </div>
          </SectionWrapper>
        )}
      </div>

      {/* Badges de status */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">Seções com alterações pendentes:</span>
        {TABS.filter((t) => hasChanges(t.id)).length === 0 ? (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
            <Check className="h-3 w-3" />
            Tudo salvo
          </Badge>
        ) : (
          TABS.filter((t) => hasChanges(t.id)).map((t) => (
            <Badge key={t.id} variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
              {t.label}
            </Badge>
          ))
        )}
      </div>

      {/* Link de preview final */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Prévia da landing page</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Abra a página pública para ver o resultado das suas edições.
            </p>
          </div>
          <a
            href="/landing-page"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#F87116]" />
            Abrir Landing Page
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
