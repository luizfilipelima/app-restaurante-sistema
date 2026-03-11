import { useState, useRef, useCallback, useEffect } from 'react';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_VARS,
  processTemplate,
  type TemplateKey,
} from '@/lib/whatsapp/whatsappTemplates';
import type { WhatsAppTemplates } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  Bike,
  ShoppingBag,
  ChefHat,
  Eye,
  EyeOff,
  RotateCcw,
  Info,
  Smartphone,
} from 'lucide-react';

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
  preparing_notification: {
    cliente_nome:     'João',
    restaurante_nome: 'Pizzaria da Vitória',
  },
  courier_dispatch: {
    codigo_pedido:     '#F8737EBC',
    cliente_nome:      'João Silva',
    cliente_telefone:  '+55 11 99999-9999',
    detalhes_endereco: 'Apto 12, Bloco B',
    endereco:          '-23.550520, -46.633308',
    mapa:              'https://maps.google.com/?q=-23.55,-46.63',
    restaurante_nome:  'Pizzaria da Vitória',
    itens:             '  • 2x Pizza Margherita\n  • 1x Refrigerante 2L',
    subtotal:          'R$ 38,90',
    taxa_entrega:      'R$ 5,00',
    total:             'R$ 43,90',
  },
};

const TAB_META: Record<TemplateKey, { icon: React.ElementType; whatsappColor: string }> = {
  new_order:             { icon: ShoppingBag, whatsappColor: 'bg-emerald-500' },
  delivery_notification: { icon: Truck,       whatsappColor: 'bg-blue-500'    },
  preparing_notification:{ icon: ChefHat,     whatsappColor: 'bg-indigo-500'  },
  courier_dispatch:      { icon: Bike,        whatsappColor: 'bg-orange-500'  },
};

function WaBubble({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .split('\n')
    .join('<br />');

  return (
    <div className="bg-[#DCF8C6] dark:bg-[#005C4B] rounded-2xl rounded-tl-none px-4 py-3 max-w-sm shadow-sm text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-[system-ui]">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <p className="text-right text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">12:34 ✓✓</p>
    </div>
  );
}

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

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(140, el.scrollHeight) + 'px';
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
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const resetToDefault = () => onChange(DEFAULT_TEMPLATES[templateKey]);

  const DESC_KEYS: Record<TemplateKey, string> = {
    new_order: 'waTemplates.descNewOrder',
    delivery_notification: 'waTemplates.descDelivery',
    preparing_notification: 'waTemplates.descPreparing',
    courier_dispatch: 'waTemplates.descCourier',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 bg-muted/50 border border-border rounded-lg px-3 py-2.5">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(DESC_KEYS[templateKey] as 'waTemplates.descNewOrder')}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
          {t('waTemplates.varsTitle')} — {t('waTemplates.varsHint')}
        </p>
        <div className="flex flex-wrap gap-1">
          {vars.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              title={v.description}
              className="px-1.5 py-0.5 rounded border border-dashed border-border bg-background hover:border-primary hover:bg-primary/5 text-[11px] font-mono text-foreground/70 hover:text-primary transition-colors"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); autoResize(); }}
        className="w-full min-h-[140px] resize-none rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        spellCheck={false}
        placeholder={DEFAULT_TEMPLATES[templateKey]}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? t('waTemplates.previewHide') : t('waTemplates.previewToggle')}
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          {t('waTemplates.resetDefault')}
        </button>
      </div>

      {showPreview && (
        <div className="rounded-lg bg-[#ECE5DD] dark:bg-slate-800 p-3 space-y-1">
          <div className={`h-6 rounded flex items-center px-2 gap-1.5 ${meta.whatsappColor}`}>
            <Smartphone className="h-3 w-3 text-white" />
            <span className="text-[10px] text-white font-semibold">WhatsApp</span>
          </div>
          <div className="flex justify-end">
            <WaBubble text={preview || '(mensagem vazia)'} />
          </div>
        </div>
      )}
    </div>
  );
}

const TABS: TemplateKey[] = ['new_order', 'delivery_notification', 'preparing_notification', 'courier_dispatch'];

export interface WhatsAppTemplatesEditorProps {
  value: WhatsAppTemplates;
  onChange: (templates: WhatsAppTemplates) => void;
  compact?: boolean;
}

export function WhatsAppTemplatesEditor({ value, onChange, compact }: WhatsAppTemplatesEditorProps) {
  const { t } = useAdminTranslation();

  const templates: Record<TemplateKey, string> = {
    new_order:             value?.new_order             ?? DEFAULT_TEMPLATES.new_order,
    delivery_notification: value?.delivery_notification ?? DEFAULT_TEMPLATES.delivery_notification,
    preparing_notification: value?.preparing_notification ?? DEFAULT_TEMPLATES.preparing_notification,
    courier_dispatch:      value?.courier_dispatch      ?? DEFAULT_TEMPLATES.courier_dispatch,
  };

  const setTemplate = (key: TemplateKey, text: string) => {
    onChange({ ...value, [key]: text });
  };

  const tabLabels: Record<TemplateKey, string> = {
    new_order:             t('waTemplates.tabNewOrder'),
    delivery_notification: t('waTemplates.tabDelivery'),
    preparing_notification: t('waTemplates.tabPreparing'),
    courier_dispatch:      t('waTemplates.tabCourier'),
  };

  const tabIcons: Record<TemplateKey, React.ElementType> = {
    new_order:             ShoppingBag,
    delivery_notification: Truck,
    preparing_notification: ChefHat,
    courier_dispatch:      Bike,
  };

  return (
    <Tabs defaultValue="new_order" className="w-full">
      <TabsList className={`grid grid-cols-4 w-full ${compact ? 'h-9' : 'h-10'} bg-muted/60`}>
        {TABS.map((key) => {
          const Icon = tabIcons[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className={`flex items-center gap-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm ${compact ? 'py-1.5' : ''}`}
            >
              <Icon className="h-3 w-3 hidden sm:block" />
              {tabLabels[key]}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className={compact ? 'mt-3' : 'mt-4'}>
        {TABS.map((key) => (
          <TabsContent key={key} value={key} className="mt-0 focus-visible:ring-0">
            <TemplateTab
              templateKey={key}
              value={templates[key]}
              onChange={(v) => setTemplate(key, v)}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
