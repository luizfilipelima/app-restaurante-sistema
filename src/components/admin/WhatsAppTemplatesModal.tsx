import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_VARS,
  processTemplate,
  type TemplateKey,
} from '@/lib/whatsappTemplates';
import type { WhatsAppTemplates } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  Truck,
  Bike,
  ShoppingBag,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Loader2,
  Info,
  Smartphone,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_VARS: Record<TemplateKey, Record<string, string>> = {
  new_order: {
    cliente_nome:      'João Silva',
    cliente_telefone:  '+55 11 99999-9999',
    tipo_entrega:      'Entrega',
    bairro:            'Centro',
    endereco:          '-23.550520, -46.633308',
    detalhes_endereco: 'Apto 12, Bloco B',
    pagamento:         'PIX',
    troco:             '',
    subtotal:          'R$ 38,90',
    taxa_entrega:      'Taxa entrega: R$ 5,00',
    total:             'R$ 43,90',
    itens:             '  • 2x Pizza Margherita — R$ 38,90\n  • 1x Refrigerante 2L — R$ 8,00',
    observacoes:       'Tirar a cebola',
  },
  delivery_notification: {
    cliente_nome:     'João',
    restaurante_nome: 'Pizzaria da Vitória',
  },
  courier_dispatch: {
    cliente_nome:      'João Silva',
    detalhes_endereco: 'Apto 12, Bloco B',
    endereco:          '-23.550520, -46.633308',
    mapa:              'https://maps.google.com/?q=-23.55,-46.63',
    restaurante_nome:  'Pizzaria da Vitória',
    itens:             '  • 2x Pizza Margherita\n  • 1x Refrigerante 2L',
  },
};

const TAB_META: Record<TemplateKey, { icon: React.ElementType; color: string; whatsappColor: string }> = {
  new_order:             { icon: ShoppingBag, color: 'text-emerald-500', whatsappColor: 'bg-emerald-500' },
  delivery_notification: { icon: Truck,       color: 'text-blue-500',    whatsappColor: 'bg-blue-500'    },
  courier_dispatch:      { icon: Bike,        color: 'text-orange-500',  whatsappColor: 'bg-orange-500'  },
};

// ── WhatsApp message bubble preview ──────────────────────────────────────────

function WaBubble({ text }: { text: string }) {
  // Convert WhatsApp markdown to basic HTML for preview
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .split('\n')
    .join('<br />');

  return (
    <div className="bg-[#DCF8C6] dark:bg-[#005C4B] rounded-2xl rounded-tl-none px-4 py-3 max-w-sm shadow-sm text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-[system-ui]">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <p className="text-right text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
        12:34 ✓✓
      </p>
    </div>
  );
}

// ── Template Tab ──────────────────────────────────────────────────────────────

function TemplateTab({
  templateKey,
  value,
  onChange,
}: {
  templateKey: TemplateKey;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useAdminTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meta = TAB_META[templateKey];
  const vars = TEMPLATE_VARS[templateKey];
  const preview = processTemplate(value, SAMPLE_VARS[templateKey]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(180, el.scrollHeight) + 'px';
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const tag = `{{${key}}}`;
    const next = value.slice(0, start) + tag + value.slice(end);
    onChange(next);
    // Restore cursor after the inserted tag
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const resetToDefault = () => {
    onChange(DEFAULT_TEMPLATES[templateKey]);
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="flex items-start gap-2.5 bg-muted/50 border border-border rounded-xl px-3.5 py-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`waTemplates.desc${templateKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as 'NewOrder' | 'Delivery' | 'Courier'}`)}
        </p>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t('waTemplates.varsTitle')}
          </p>
          <span className="text-xs text-muted-foreground">— {t('waTemplates.varsHint')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {vars.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              title={v.description}
              className="group flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors text-xs font-mono font-medium text-foreground/70 hover:text-primary"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-primary/60">{'{'}</span>
              {v.key}
              <span className="text-[10px] text-muted-foreground group-hover:text-primary/60">{'}'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); autoResize(); }}
          className="w-full min-h-[180px] resize-none rounded-xl border border-border bg-background px-3.5 py-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          spellCheck={false}
          placeholder={DEFAULT_TEMPLATES[templateKey]}
        />
        <div className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground pointer-events-none">
          {t('waTemplates.charCount').replace('{{n}}', String(value.length))}
        </div>
      </div>

      {/* Preview toggle */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {showPreview
            ? <><EyeOff className="h-4 w-4" /> {t('waTemplates.previewHide')}</>
            : <><Eye className="h-4 w-4" /> {t('waTemplates.previewToggle')}</>
          }
        </button>

        {showPreview && (
          <div className="rounded-xl bg-[#ECE5DD] dark:bg-slate-800 p-4 space-y-1">
            {/* Status bar mock */}
            <div className={`h-8 rounded-lg mb-3 flex items-center px-3 gap-2 ${meta.whatsappColor}`}>
              <Smartphone className="h-3.5 w-3.5 text-white" />
              <span className="text-xs text-white font-semibold">WhatsApp</span>
            </div>
            <div className="flex justify-end">
              <WaBubble text={preview || '(mensagem vazia)'} />
            </div>
          </div>
        )}
      </div>

      {/* Reset */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetToDefault}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('waTemplates.resetDefault')}
        </button>
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

interface WhatsAppTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string | null;
  currentTemplates?: WhatsAppTemplates | null;
  onSaved?: (templates: WhatsAppTemplates) => void;
}

const TABS: TemplateKey[] = ['new_order', 'delivery_notification', 'courier_dispatch'];

export function WhatsAppTemplatesModal({
  open,
  onClose,
  restaurantId,
  currentTemplates,
  onSaved,
}: WhatsAppTemplatesModalProps) {
  const { t } = useAdminTranslation();
  const [saving, setSaving] = useState(false);

  // Form state — initialize from saved templates or defaults
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({
    new_order:             currentTemplates?.new_order             ?? DEFAULT_TEMPLATES.new_order,
    delivery_notification: currentTemplates?.delivery_notification ?? DEFAULT_TEMPLATES.delivery_notification,
    courier_dispatch:      currentTemplates?.courier_dispatch      ?? DEFAULT_TEMPLATES.courier_dispatch,
  });

  // Re-sync when currentTemplates prop changes (e.g., after first load)
  useEffect(() => {
    setTemplates({
      new_order:             currentTemplates?.new_order             ?? DEFAULT_TEMPLATES.new_order,
      delivery_notification: currentTemplates?.delivery_notification ?? DEFAULT_TEMPLATES.delivery_notification,
      courier_dispatch:      currentTemplates?.courier_dispatch      ?? DEFAULT_TEMPLATES.courier_dispatch,
    });
  }, [currentTemplates]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const payload: WhatsAppTemplates = {
        new_order:             templates.new_order,
        delivery_notification: templates.delivery_notification,
        courier_dispatch:      templates.courier_dispatch,
      };

      const { error } = await supabase
        .from('restaurants')
        .update({ whatsapp_templates: payload })
        .eq('id', restaurantId);

      if (error) throw error;

      onSaved?.(payload);
      toast({
        title: '✅ ' + t('waTemplates.savedOk'),
        className: 'bg-green-50 border-green-200',
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: t('waTemplates.savedError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const tabLabels: Record<TemplateKey, string> = {
    new_order:             t('waTemplates.tabNewOrder'),
    delivery_notification: t('waTemplates.tabDelivery'),
    courier_dispatch:      t('waTemplates.tabCourier'),
  };

  const tabIcons: Record<TemplateKey, React.ElementType> = {
    new_order:             ShoppingBag,
    delivery_notification: Truck,
    courier_dispatch:      Bike,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {t('waTemplates.modalTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 leading-snug max-w-lg">
                {t('waTemplates.modalDesc')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <Tabs defaultValue="new_order" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid grid-cols-3 mx-6 mt-4 flex-shrink-0 h-10 bg-muted/60">
            {TABS.map((key) => {
              const Icon = tabIcons[key];
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 hidden sm:block" />
                  {tabLabels[key]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {TABS.map((key) => (
              <TabsContent key={key} value={key} className="px-6 py-5 mt-0 focus-visible:ring-0">
                <TemplateTab
                  templateKey={key}
                  value={templates[key]}
                  onChange={(v) => setTemplates((prev) => ({ ...prev, [key]: v }))}
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 flex-shrink-0 bg-background">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !restaurantId}
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white gap-2"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('waTemplates.saving')}</>
              : <><Save className="h-4 w-4" /> {t('waTemplates.saveBtn')}</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppTemplatesModal;
