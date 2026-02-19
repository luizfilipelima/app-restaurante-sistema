/**
 * Editor completo da Landing Page principal — quiero.food (rota "/")
 *
 * Cobre todas as seções com edição de:
 *   - Textos e títulos
 *   - Imagens (via URL)
 *   - Cores (picker nativo)
 *   - Blocos dinâmicos (add/remove/edit)
 *
 * Abas: Cores & Visual | Header | Hero | Bento | Funcionalidades |
 *       Depoimentos | Preços | FAQ | Rodapé
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useLandingPageContent,
  useUpsertLandingSection,
  type LandingUpsertItem,
} from '@/hooks/queries/useLandingPageContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  ExternalLink, Loader2, Check, AlertCircle, Plus, Trash2,
  Palette, Layout, Zap, Grid3x3, MessageSquare, CreditCard,
  HelpCircle, Footprints, MonitorSmartphone, ChevronDown, ChevronUp,
  Info,
} from 'lucide-react';

// ─── Tipos compartilhados ─────────────────────────────────────────────────────

type SectionId =
  | 'main_colors' | 'main_header' | 'main_hero'
  | 'main_problem' | 'main_features' | 'main_testimonials'
  | 'main_pricing' | 'main_faq' | 'main_footer';

interface TestimonialItem { name: string; role: string; content: string; rating: number }
interface FaqItem          { question: string; answer: string }
interface FeatureGroup     { title: string; description: string; color: string; items: string[] }
interface PlanItem         { name: string; price: string; period: string; features: string[]; cta: string; popular: boolean }
interface CompRow          { name: string; basic: boolean; pro: boolean; enterprise: boolean }
interface FooterCol        { title: string; links: Array<{ label: string; href: string }> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function g(d: Record<string, string>, k: string, fb = '') { return d?.[k] ?? fb; }

function parseJson<T>(raw: string | undefined, fb: T): T {
  try { if (raw) return JSON.parse(raw) as T; } catch { /* noop */ }
  return fb;
}

// ─── Componentes de campo ─────────────────────────────────────────────────────

function Field({ label, hint, value, onChange, multiline, type = 'text', rows = 3 }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void;
  multiline?: boolean; type?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-slate-600">{label}</Label>
        {hint && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Info className="h-2.5 w-2.5" />{hint}</span>}
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
      )}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-slate-600">{label}</Label>
        {hint && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Info className="h-2.5 w-2.5" />{hint}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input type="color" value={value || '#ea580c'} onChange={(e) => onChange(e.target.value)}
            className="h-10 w-16 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
        </div>
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="#ea580c" className="h-9 text-sm font-mono w-32" />
        <div className="h-9 w-16 rounded-lg border border-slate-200 shadow-sm flex-shrink-0"
          style={{ backgroundColor: value || '#ea580c' }} />
        <div className="flex gap-1 flex-wrap">
          {['#ea580c','#dc2626','#16a34a','#2563eb','#7c3aed','#0891b2','#be185d','#1d4ed8'].map((hex) => (
            <button key={hex} onClick={() => onChange(hex)}
              className="h-6 w-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: hex }} title={hex} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Editor de depoimentos ────────────────────────────────────────────────────

function TestimonialEditor({ items, onChange }: {
  items: TestimonialItem[]; onChange: (items: TestimonialItem[]) => void;
}) {
  const upd = (i: number, k: keyof TestimonialItem, v: string | number) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const rem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Depoimento {i + 1}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} onClick={() => upd(i, 'rating', s)}
                    className={`text-sm ${s <= t.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
                ))}
                <span className="text-[11px] text-slate-400 ml-1">{t.rating}/5</span>
              </div>
              <button onClick={() => rem(i)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <textarea value={t.content} onChange={(e) => upd(i, 'content', e.target.value)}
            placeholder="Texto do depoimento..." rows={2}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="grid grid-cols-3 gap-2">
            {([['name','Nome','Carlos Benitez'],['role','Estabelecimento','Pizzaria X']] as const).map(([fk,fl,fp]) => (
              <div key={fk}>
                <Label className="text-[11px] text-slate-500">{fl}</Label>
                <Input value={t[fk as 'name'|'role']} onChange={(e) => upd(i, fk as 'name'|'role', e.target.value)}
                  className="h-8 text-sm mt-1" placeholder={fp} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, { name:'', role:'', content:'', rating:5 }])}
        className="w-full gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Adicionar Depoimento</Button>
    </div>
  );
}

// ─── Editor de grupos de funcionalidades ──────────────────────────────────────

const COLORS = ['orange','amber','blue','slate','emerald','green','violet','red','pink','cyan'];

function FeatureGroupsEditor({ groups, onChange }: {
  groups: FeatureGroup[]; onChange: (groups: FeatureGroup[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const upd = (i: number, k: keyof FeatureGroup, v: unknown) =>
    onChange(groups.map((g, idx) => idx === i ? { ...g, [k]: v } : g));
  const rem = (i: number) => onChange(groups.filter((_, idx) => idx !== i));
  const addItem = (gi: number) => {
    onChange(groups.map((gr, idx) => idx === gi ? { ...gr, items: [...gr.items, ''] } : gr));
    setExpanded(gi);
  };
  const updItem = (gi: number, ii: number, v: string) => {
    onChange(groups.map((gr, idx) => idx === gi ? { ...gr, items: gr.items.map((it, iidx) => iidx === ii ? v : it) } : gr));
  };
  const remItem = (gi: number, ii: number) => {
    onChange(groups.map((gr, idx) => idx === gi ? { ...gr, items: gr.items.filter((_, iidx) => iidx !== ii) } : gr));
  };
  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full bg-${g.color}-500`} />
              <span className="text-sm font-semibold text-slate-800">{g.title || `Grupo ${i+1}`}</span>
              <Badge variant="outline" className="text-[10px] font-normal">{g.items.length} itens</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); rem(i); }}
                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
              {expanded === i ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Título" value={g.title} onChange={(v) => upd(i, 'title', v)} />
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Cor do ícone</Label>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => upd(i, 'color', c)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${g.color === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''} bg-${c}-100 text-${c}-600`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Field label="Descrição" value={g.description} onChange={(v) => upd(i, 'description', v)} />
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">Itens da lista</Label>
                {g.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <Input value={item} onChange={(e) => updItem(i, ii, e.target.value)} className="h-8 text-sm flex-1" />
                    <button onClick={() => remItem(i, ii)}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addItem(i)} className="h-7 gap-1 text-xs">
                  <Plus className="h-3 w-3" />Adicionar item
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm"
        onClick={() => onChange([...groups, { title:'', description:'', color:'orange', items:[] }])}
        className="w-full gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Adicionar Grupo</Button>
    </div>
  );
}

// ─── Editor de planos ─────────────────────────────────────────────────────────

function PlansEditor({ plans, onChange }: { plans: PlanItem[]; onChange: (p: PlanItem[]) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const upd = (i: number, k: keyof PlanItem, v: unknown) =>
    onChange(plans.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  const rem = (i: number) => onChange(plans.filter((_, idx) => idx !== i));
  const addFeat = (pi: number) => onChange(plans.map((p, idx) => idx === pi ? { ...p, features: [...p.features, ''] } : p));
  const updFeat = (pi: number, fi: number, v: string) => onChange(plans.map((p, idx) => idx === pi ? { ...p, features: p.features.map((f, fidx) => fidx === fi ? v : f) } : p));
  const remFeat = (pi: number, fi: number) => onChange(plans.map((p, idx) => idx === pi ? { ...p, features: p.features.filter((_, fidx) => fidx !== fi) } : p));
  return (
    <div className="space-y-2">
      {plans.map((plan, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{plan.name || `Plano ${i+1}`}</span>
              {plan.popular && <Badge className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100">Popular</Badge>}
              <span className="text-xs text-slate-400">{plan.price}{plan.period}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); rem(i); }}
                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
              {expanded === i ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Nome do plano" value={plan.name} onChange={(v) => upd(i, 'name', v)} />
                <Field label="Preço" value={plan.price} onChange={(v) => upd(i, 'price', v)} />
                <Field label="Período" hint='Ex: /mês' value={plan.period} onChange={(v) => upd(i, 'period', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Texto do botão CTA" value={plan.cta} onChange={(v) => upd(i, 'cta', v)} />
                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={plan.popular} onChange={(e) => upd(i, 'popular', e.target.checked)}
                      className="h-4 w-4 rounded accent-orange-600" />
                    <span className="text-sm font-medium text-slate-600">Plano em destaque (Popular)</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">Funcionalidades incluídas</Label>
                {plan.features.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    <Input value={f} onChange={(e) => updFeat(i, fi, e.target.value)} className="h-8 text-sm flex-1" />
                    <button onClick={() => remFeat(i, fi)}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addFeat(i)} className="h-7 gap-1 text-xs">
                  <Plus className="h-3 w-3" />Adicionar funcionalidade
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm"
        onClick={() => onChange([...plans, { name:'', price:'', period:'', features:[], cta:'', popular:false }])}
        className="w-full gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Adicionar Plano</Button>
    </div>
  );
}

// ─── Editor de FAQ ────────────────────────────────────────────────────────────

function FaqEditor({ items, onChange }: { items: FaqItem[]; onChange: (items: FaqItem[]) => void }) {
  const upd = (i: number, k: keyof FaqItem, v: string) => onChange(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const rem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pergunta {i + 1}</span>
            <button onClick={() => rem(i)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Field label="Pergunta" value={item.question} onChange={(v) => upd(i, 'question', v)} />
          <Field label="Resposta" value={item.answer} onChange={(v) => upd(i, 'answer', v)} multiline rows={3} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, { question:'', answer:'' }])}
        className="w-full gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Adicionar Pergunta</Button>
    </div>
  );
}

// ─── Editor de colunas do rodapé ──────────────────────────────────────────────

function FooterColsEditor({ cols, onChange }: { cols: FooterCol[]; onChange: (c: FooterCol[]) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const updTitle = (i: number, v: string) => onChange(cols.map((c, ci) => ci === i ? { ...c, title: v } : c));
  const updLink  = (ci: number, li: number, k: 'label' | 'href', v: string) =>
    onChange(cols.map((c, i) => i === ci ? { ...c, links: c.links.map((l, lx) => lx === li ? { ...l, [k]: v } : l) } : c));
  const remLink  = (ci: number, li: number) =>
    onChange(cols.map((c, i) => i === ci ? { ...c, links: c.links.filter((_, lx) => lx !== li) } : c));
  const addLink  = (ci: number) =>
    onChange(cols.map((c, i) => i === ci ? { ...c, links: [...c.links, { label:'', href:'#' }] } : c));
  const remCol   = (ci: number) => onChange(cols.filter((_, i) => i !== ci));
  return (
    <div className="space-y-2">
      {cols.map((col, ci) => (
        <div key={ci} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button onClick={() => setExpanded(expanded === ci ? null : ci)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{col.title || `Coluna ${ci+1}`}</span>
              <Badge variant="outline" className="text-[10px]">{col.links.length} links</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); remCol(ci); }}
                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
              {expanded === ci ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {expanded === ci && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-3">
              <Field label="Título da coluna" value={col.title} onChange={(v) => updTitle(ci, v)} />
              <Label className="text-xs font-semibold text-slate-600 block">Links</Label>
              {col.links.map((link, li) => (
                <div key={li} className="flex items-center gap-2">
                  <Input value={link.label} onChange={(e) => updLink(ci, li, 'label', e.target.value)} placeholder="Label" className="h-8 text-sm flex-1" />
                  <Input value={link.href}  onChange={(e) => updLink(ci, li, 'href',  e.target.value)} placeholder="URL (#)" className="h-8 text-sm flex-1" />
                  <button onClick={() => remLink(ci, li)}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addLink(ci)} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" />Adicionar link
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm"
        onClick={() => onChange([...cols, { title:'', links:[] }])}
        className="w-full gap-1.5 h-9"><Plus className="h-3.5 w-3.5" />Adicionar Coluna</Button>
    </div>
  );
}

// ─── Wrapper de seção com botão Salvar ────────────────────────────────────────

function SectionWrapper({ title, description, icon: Icon, saving, hasChanges, onSave, children }: {
  title: string; description: string; icon: React.ElementType;
  saving: boolean; hasChanges: boolean; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Icon className="h-[18px] w-[18px] text-[#F87116]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {hasChanges && !saving && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />Não salvo
            </span>
          )}
          <Button onClick={onSave} disabled={!hasChanges || saving} size="sm"
            className="gap-1.5 bg-[#F87116] hover:bg-orange-500 text-white">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? 'Salvando...' : 'Salvar Seção'}
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}

// ─── Abas ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'main_colors'       as SectionId, label: 'Cores & Visual',   icon: Palette },
  { id: 'main_header'       as SectionId, label: 'Header',           icon: Layout },
  { id: 'main_hero'         as SectionId, label: 'Hero',             icon: Zap },
  { id: 'main_problem'      as SectionId, label: 'Bento',            icon: Grid3x3 },
  { id: 'main_features'     as SectionId, label: 'Funcionalidades',  icon: MonitorSmartphone },
  { id: 'main_testimonials' as SectionId, label: 'Depoimentos',      icon: MessageSquare },
  { id: 'main_pricing'      as SectionId, label: 'Preços',           icon: CreditCard },
  { id: 'main_faq'          as SectionId, label: 'FAQ',              icon: HelpCircle },
  { id: 'main_footer'       as SectionId, label: 'Rodapé',           icon: Footprints },
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LandingPageEditor() {
  const [activeTab, setActiveTab] = useState<SectionId>('main_colors');
  const { data: content, isLoading, isError } = useLandingPageContent();
  const upsert = useUpsertLandingSection();

  type DraftMap = Record<SectionId, Record<string, string>>;
  const [drafts, setDrafts] = useState<DraftMap>(() =>
    Object.fromEntries(TABS.map((t) => [t.id, {}])) as DraftMap
  );

  useEffect(() => {
    if (!content) return;
    setDrafts(Object.fromEntries(
      TABS.map((t) => [t.id, { ...(content[t.id] ?? {}) }])
    ) as DraftMap);
  }, [content]);

  const setField = useCallback((section: SectionId, key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  const hasChanges = (section: SectionId): boolean => {
    if (!content) return false;
    const original = content[section] ?? {};
    const draft = drafts[section] ?? {};
    return Object.entries(draft).some(([k, v]) => v !== (original[k] ?? ''));
  };

  const saveSection = async (section: SectionId) => {
    const draft = drafts[section];
    if (!draft) return;
    const items: LandingUpsertItem[] = Object.entries(draft).map(([key, value]) => ({ section, key, value }));
    try {
      await upsert.mutateAsync(items);
      toast({ title: 'Seção salva', description: 'Alterações publicadas na quiero.food.' });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: String(err), variant: 'destructive' });
    }
  };

  // Helpers de JSON para drafts
  const getJson = <T,>(section: SectionId, key: string, fb: T): T =>
    parseJson(drafts[section]?.[key], fb);
  const setJson = <T,>(section: SectionId, key: string, value: T) =>
    setField(section, key, JSON.stringify(value));

  if (isLoading) return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-slate-400">
      <AlertCircle className="h-12 w-12 text-slate-300" />
      <p className="font-semibold text-slate-600">Não foi possível carregar o conteúdo.</p>
      <p className="text-sm text-center max-w-sm">
        Execute as migrations <code>20260240</code> e <code>20260241</code> no Supabase.
      </p>
    </div>
  );

  const saving = upsert.isPending;
  const d = drafts;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MonitorSmartphone className="h-5 w-5 text-[#F87116]" />
            <h1 className="text-2xl font-bold text-slate-900">Editor da Landing Page</h1>
          </div>
          <p className="text-sm text-slate-500">
            Edite textos, imagens, cores e blocos da página pública{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">quiero.food</code>.
          </p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 flex-shrink-0">
          <ExternalLink className="h-3.5 w-3.5" />Ver página
        </a>
      </div>

      {/* Dica */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          <strong>Dica:</strong> Use "Ver página" para conferir as alterações em tempo real. Cada seção tem seu próprio botão de salvar.
        </p>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active ? 'bg-white text-[#F87116] shadow-sm border border-orange-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}>
              <Icon className="h-3 w-3 flex-shrink-0" />
              {tab.label}
              {hasChanges(tab.id) && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Cores & Visual ─────────────────────────────────────────────── */}
      {activeTab === 'main_colors' && (
        <SectionWrapper title="Cores & Visual" description="Cor primária da marca, fundo e logotipo aplicados em toda a página."
          icon={Palette} saving={saving} hasChanges={hasChanges('main_colors')} onSave={() => saveSection('main_colors')}>
          <ColorField label="Cor primária da marca"
            hint="Botões, destaques, links e bordas."
            value={g(d.main_colors, 'primary_hex', '#ea580c')}
            onChange={(v) => setField('main_colors', 'primary_hex', v)} />
          <div className="grid grid-cols-2 gap-5 border-t border-slate-100 pt-5">
            <Field label="URL do logotipo" type="url"
              hint="Caminho relativo ou URL absoluta"
              value={g(d.main_colors, 'logo_url', '/quierofood-logo-f.svg')}
              onChange={(v) => setField('main_colors', 'logo_url', v)} />
            <div>
              <Label className="text-xs font-semibold text-slate-600 block mb-1.5">Prévia do logotipo</Label>
              <div className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center px-4">
                {d.main_colors?.logo_url ? (
                  <img src={d.main_colors.logo_url} alt="logo" className="h-8 w-auto object-contain" onError={(e) => (e.currentTarget.style.display='none')} />
                ) : (
                  <span className="text-xs text-slate-400">Nenhuma URL definida</span>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              A cor primária é aplicada via CSS variable (<code>--brand</code>) e inline styles em botões, ícones e destaques. Após salvar, atualize a página para ver as mudanças.
            </p>
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Header ──────────────────────────────────────────────────────── */}
      {activeTab === 'main_header' && (
        <SectionWrapper title="Header / Navegação" description="Barra fixa no topo: logo, menu, botões de ação e links."
          icon={Layout} saving={saving} hasChanges={hasChanges('main_header')} onSave={() => saveSection('main_header')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Texto do botão CTA" value={g(d.main_header,'cta_label','Testar Grátis')} onChange={(v) => setField('main_header','cta_label',v)} />
            <Field label="Texto do botão Entrar" value={g(d.main_header,'login_label','Entrar')} onChange={(v) => setField('main_header','login_label',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Links</p>
            <Field label="Link WhatsApp (botão CTA)" type="url" value={g(d.main_header,'wa_link','')} onChange={(v) => setField('main_header','wa_link',v)} />
            <Field label="Link da plataforma (botão Entrar)" type="url" value={g(d.main_header,'app_link','https://app.quiero.food')} onChange={(v) => setField('main_header','app_link',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Itens do menu de navegação</p>
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3].map((n) => (
                <Field key={n} label={`Item ${n}`}
                  value={g(d.main_header, `nav_item_${n}`, ['Funcionalidades','Preços','FAQ'][n-1])}
                  onChange={(v) => setField('main_header', `nav_item_${n}`, v)} />
              ))}
            </div>
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Hero ────────────────────────────────────────────────────────── */}
      {activeTab === 'main_hero' && (
        <SectionWrapper title="Seção Hero" description="Primeira tela da página: título, subtítulo, CTA, imagem e prova social."
          icon={Zap} saving={saving} hasChanges={hasChanges('main_hero')} onSave={() => saveSection('main_hero')}>
          <Field label="Texto do badge" hint="Pequena pílula acima do título"
            value={g(d.main_hero,'badge_text','Novo: Modo Cozinha Inteligente v2.0')} onChange={(v) => setField('main_hero','badge_text',v)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Título principal" multiline rows={2}
                value={g(d.main_hero,'headline','O Delivery que vende sozinho no WhatsApp.')} onChange={(v) => setField('main_hero','headline',v)} />
            </div>
            <Field label="Palavra em destaque (gradiente)" hint="Será colorida com a cor primária"
              value={g(d.main_hero,'headline_highlight','WhatsApp')} onChange={(v) => setField('main_hero','headline_highlight',v)} />
            <Field label="Texto do botão CTA"
              value={g(d.main_hero,'cta_label','Criar Cardápio Grátis')} onChange={(v) => setField('main_hero','cta_label',v)} />
          </div>
          <Field label="Subtítulo" multiline rows={2}
            value={g(d.main_hero,'subheadline','')} onChange={(v) => setField('main_hero','subheadline',v)} />
          <Field label="Placeholder do campo de e-mail"
            value={g(d.main_hero,'email_placeholder','seu@email.com')} onChange={(v) => setField('main_hero','email_placeholder',v)} />
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Imagem / Mockup</p>
            <Field label="URL da imagem hero" type="url" hint="Substitui o placeholder cinza"
              value={g(d.main_hero,'hero_image_url','')} onChange={(v) => setField('main_hero','hero_image_url',v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Alt text da imagem" value={g(d.main_hero,'hero_image_alt','Dashboard do QuieroFood')} onChange={(v) => setField('main_hero','hero_image_alt',v)} />
              <Field label="Label quando sem imagem" value={g(d.main_hero,'hero_image_label','Dashboard Screenshot Mockup')} onChange={(v) => setField('main_hero','hero_image_label',v)} />
            </div>
            {d.main_hero?.hero_image_url && (
              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-48">
                <img src={d.main_hero.hero_image_url} alt="preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display='none')} />
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prova Social</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de destaque (avatares)" value={g(d.main_hero,'social_proof_count','+100')} onChange={(v) => setField('main_hero','social_proof_count',v)} />
            </div>
            <Field label="Texto de prova social" hint="Aceita <strong> HTML básico"
              value={g(d.main_hero,'social_proof_text','Usado por <strong>+100 restaurantes</strong> no Paraguai')} onChange={(v) => setField('main_hero','social_proof_text',v)} />
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Bento ───────────────────────────────────────────────────────── */}
      {activeTab === 'main_problem' && (
        <SectionWrapper title="Bento — Problema & Solução" description="Grid de 4 cards visuais que apresentam as principais soluções."
          icon={Grid3x3} saving={saving} hasChanges={hasChanges('main_problem')} onSave={() => saveSection('main_problem')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título da seção" value={g(d.main_problem,'section_title','Adeus, caderninho.')} onChange={(v) => setField('main_problem','section_title',v)} />
            <Field label="Subtítulo da seção" value={g(d.main_problem,'section_subtitle','')} onChange={(v) => setField('main_problem','section_subtitle',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Conteúdo dos Cards</p>
            <div className="grid grid-cols-1 gap-4">
              {[
                { prefix:'card1', label:'Card 1 (destaque grande)',   hasCta: true },
                { prefix:'card2', label:'Card 2 (pequeno, ícone impressora)', hasCta: false },
                { prefix:'card3', label:'Card 3 (fundo escuro, QR Code)',     hasCta: false },
                { prefix:'card4', label:'Card 4 (gradiente, gráfico)',         hasCta: false },
              ].map(({ prefix, label, hasCta }) => (
                <div key={prefix} className="rounded-xl border border-slate-100 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <div className={`grid gap-3 ${hasCta ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <Field label="Título"
                      value={g(d.main_problem, `${prefix}_title`, '')} onChange={(v) => setField('main_problem', `${prefix}_title`, v)} />
                    <Field label="Descrição"
                      value={g(d.main_problem, `${prefix}_desc`, '')} onChange={(v) => setField('main_problem', `${prefix}_desc`, v)} />
                    {hasCta && (
                      <Field label="Texto do botão"
                        value={g(d.main_problem, `${prefix}_cta`, 'Ver Demo')} onChange={(v) => setField('main_problem', `${prefix}_cta`, v)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Funcionalidades ─────────────────────────────────────────────── */}
      {activeTab === 'main_features' && (
        <SectionWrapper title="Funcionalidades" description="Grid de grupos de funcionalidades com listas de itens."
          icon={MonitorSmartphone} saving={saving} hasChanges={hasChanges('main_features')} onSave={() => saveSection('main_features')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título da seção" value={g(d.main_features,'section_title','Tudo o que você precisa para vender mais.')} onChange={(v) => setField('main_features','section_title',v)} />
            <Field label="Subtítulo" value={g(d.main_features,'section_subtitle','')} onChange={(v) => setField('main_features','section_subtitle',v)} />
          </div>
          <Field label="Texto rodapé da seção (CTA strip)" multiline rows={2}
            value={g(d.main_features,'footer_cta','')} onChange={(v) => setField('main_features','footer_cta',v)} />
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Grupos de funcionalidades <span className="font-normal normal-case text-slate-400">(clique para expandir e editar)</span>
            </p>
            <FeatureGroupsEditor
              groups={getJson<FeatureGroup[]>('main_features', 'groups', [])}
              onChange={(v) => setJson('main_features', 'groups', v)}
            />
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Depoimentos ─────────────────────────────────────────────────── */}
      {activeTab === 'main_testimonials' && (
        <SectionWrapper title="Depoimentos" description="Cards de avaliações de clientes reais."
          icon={MessageSquare} saving={saving} hasChanges={hasChanges('main_testimonials')} onSave={() => saveSection('main_testimonials')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título" value={g(d.main_testimonials,'section_title','Quem usa, recomenda.')} onChange={(v) => setField('main_testimonials','section_title',v)} />
            <Field label="Subtítulo" value={g(d.main_testimonials,'section_subtitle','')} onChange={(v) => setField('main_testimonials','section_subtitle',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <TestimonialEditor
              items={getJson<TestimonialItem[]>('main_testimonials', 'items', [])}
              onChange={(v) => setJson('main_testimonials', 'items', v)}
            />
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Preços ──────────────────────────────────────────────────────── */}
      {activeTab === 'main_pricing' && (
        <SectionWrapper title="Preços" description="Planos, preços e tabela de comparação."
          icon={CreditCard} saving={saving} hasChanges={hasChanges('main_pricing')} onSave={() => saveSection('main_pricing')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título" value={g(d.main_pricing,'section_title','Investimento que se paga com mais pedidos.')} onChange={(v) => setField('main_pricing','section_title',v)} />
            <Field label="Subtítulo" value={g(d.main_pricing,'section_subtitle','')} onChange={(v) => setField('main_pricing','section_subtitle',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Preços na tabela de comparação</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Preço Basic" value={g(d.main_pricing,'price_basic','$15')} onChange={(v) => setField('main_pricing','price_basic',v)} />
              <Field label="Preço Pro" value={g(d.main_pricing,'price_pro','$100')} onChange={(v) => setField('main_pricing','price_pro',v)} />
              <Field label="Preço Enterprise" value={g(d.main_pricing,'price_enterprise','$70+')} onChange={(v) => setField('main_pricing','price_enterprise',v)} />
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Planos</p>
            <PlansEditor
              plans={getJson<PlanItem[]>('main_pricing', 'plans', [])}
              onChange={(v) => setJson('main_pricing', 'plans', v)}
            />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tabela comparativa de funcionalidades</p>
            <div className="space-y-2">
              {getJson<CompRow[]>('main_pricing', 'comparison_features', []).map((row, i) => {
                const rows = getJson<CompRow[]>('main_pricing', 'comparison_features', []);
                const update = (k: keyof CompRow, v: unknown) => {
                  const updated = rows.map((r, ri) => ri === i ? { ...r, [k]: v } : r);
                  setJson('main_pricing', 'comparison_features', updated);
                };
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <Input value={row.name} onChange={(e) => update('name', e.target.value)} className="h-8 text-sm flex-1" placeholder="Nome da funcionalidade" />
                    {(['basic','pro','enterprise'] as const).map((tier) => (
                      <label key={tier} className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                        <input type="checkbox" checked={row[tier]}
                          onChange={(e) => update(tier, e.target.checked)} className="h-4 w-4 rounded accent-orange-600" />
                        <span className="text-[11px] text-slate-500 capitalize">{tier}</span>
                      </label>
                    ))}
                    <button onClick={() => {
                      const updated = rows.filter((_, ri) => ri !== i);
                      setJson('main_pricing', 'comparison_features', updated);
                    }} className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-full gap-1.5 h-9"
                onClick={() => setJson('main_pricing', 'comparison_features', [...getJson<CompRow[]>('main_pricing','comparison_features',[]), { name:'', basic:false, pro:true, enterprise:true }])}>
                <Plus className="h-3.5 w-3.5" />Adicionar linha de comparação
              </Button>
            </div>
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: FAQ ─────────────────────────────────────────────────────────── */}
      {activeTab === 'main_faq' && (
        <SectionWrapper title="FAQ" description="Perguntas e respostas frequentes."
          icon={HelpCircle} saving={saving} hasChanges={hasChanges('main_faq')} onSave={() => saveSection('main_faq')}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título" value={g(d.main_faq,'section_title','Dúvidas frequentes.')} onChange={(v) => setField('main_faq','section_title',v)} />
            <Field label="Subtítulo" value={g(d.main_faq,'section_subtitle','')} onChange={(v) => setField('main_faq','section_subtitle',v)} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <FaqEditor
              items={getJson<FaqItem[]>('main_faq','items',[])}
              onChange={(v) => setJson('main_faq','items',v)}
            />
          </div>
        </SectionWrapper>
      )}

      {/* ── Tab: Rodapé ──────────────────────────────────────────────────────── */}
      {activeTab === 'main_footer' && (
        <SectionWrapper title="Rodapé" description="Tagline, redes sociais, colunas de links e copyright."
          icon={Footprints} saving={saving} hasChanges={hasChanges('main_footer')} onSave={() => saveSection('main_footer')}>
          <Field label="Tagline (abaixo do logo)" multiline rows={2}
            value={g(d.main_footer,'tagline','O sistema de delivery mais amado da fronteira. Feito para quem tem fome de crescer.')}
            onChange={(v) => setField('main_footer','tagline',v)} />
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Redes Sociais</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Instagram URL" type="url" value={g(d.main_footer,'instagram_url','#')} onChange={(v) => setField('main_footer','instagram_url',v)} />
              <Field label="Facebook URL"  type="url" value={g(d.main_footer,'facebook_url','#')}  onChange={(v) => setField('main_footer','facebook_url',v)} />
              <Field label="Twitter URL"   type="url" value={g(d.main_footer,'twitter_url','#')}   onChange={(v) => setField('main_footer','twitter_url',v)} />
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Colunas de links</p>
            <FooterColsEditor
              cols={getJson<FooterCol[]>('main_footer','product_cols',[])}
              onChange={(v) => setJson('main_footer','product_cols',v)}
            />
          </div>
          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <Field label="Texto copyright" hint="Após © e o ano"
              value={g(d.main_footer,'copyright_text','Quiero Food. Todos os direitos reservados.')}
              onChange={(v) => setField('main_footer','copyright_text',v)} />
            <Field label="Texto de rodapé (ex: feito em...)"
              value={g(d.main_footer,'made_in_text','Feito com ❤️ em Ciudad del Este')}
              onChange={(v) => setField('main_footer','made_in_text',v)} />
          </div>
        </SectionWrapper>
      )}

      {/* Rodapé do editor */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">Seções com alterações pendentes:</span>
        {TABS.filter((t) => hasChanges(t.id)).length === 0 ? (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
            <Check className="h-3 w-3" />Tudo salvo
          </Badge>
        ) : (
          TABS.filter((t) => hasChanges(t.id)).map((t) => (
            <Badge key={t.id} variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">{t.label}</Badge>
          ))
        )}
      </div>
    </div>
  );
}
