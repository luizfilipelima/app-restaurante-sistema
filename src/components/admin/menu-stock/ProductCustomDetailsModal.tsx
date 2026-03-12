/**
 * Modal "Detalhes Custom" — permite vincular/desvincular itens da Config Custom ao produto.
 * Exibe tamanhos, massas, bordas e extras de forma organizada. Vazio = usa todos.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Check } from 'lucide-react';
import type { ProductCustomConfig } from '@/types';
import type { PizzaSize, PizzaDough, PizzaEdge, PizzaExtra } from '@/types';

interface ProductCustomDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ProductCustomConfig | null | undefined;
  onChange: (config: ProductCustomConfig) => void;
  sizes: PizzaSize[];
  doughs: PizzaDough[];
  edges: PizzaEdge[];
  extras: PizzaExtra[];
}

function toggleIds(ids: string[] | undefined, id: string, allIds: string[]): string[] | undefined | null {
  const current = ids && ids.length > 0 ? ids : allIds;
  const hasId = current.includes(id);
  const next = hasId ? current.filter((x) => x !== id) : [...current, id];
  if (next.length === 0) return null; // sem alteração (não permite ficar sem nenhum)
  if (next.length === allIds.length) return undefined; // todos = não filtrar
  return next;
}

function isSelected(ids: string[] | undefined, id: string, allIds: string[]): boolean {
  if (!ids || ids.length === 0) return true;
  return ids.includes(id);
}

export default function ProductCustomDetailsModal({
  open,
  onOpenChange,
  config,
  onChange,
  sizes,
  doughs,
  edges,
  extras,
}: ProductCustomDetailsModalProps) {
  const activeSizes = sizes.filter((s: PizzaSize) => s.id);
  const activeDoughs = doughs.filter((d: PizzaDough) => d.is_active);
  const activeEdges = edges.filter((e: PizzaEdge) => e.is_active);
  const activeExtras = extras.filter((e: PizzaExtra) => e.is_active);

  const handleToggle = (
    key: keyof ProductCustomConfig,
    id: string,
    allIds: string[]
  ) => {
    const current = config?.[key];
    const next = toggleIds(current, id, allIds);
    if (next === null) return; // sem alteração
    onChange({ ...config, [key]: next });
  };

  const Section = ({
    title,
    items,
    keyName,
    getLabel,
    allIds,
  }: {
    title: string;
    items: Array<{ id: string }>;
    keyName: keyof ProductCustomConfig;
    getLabel: (item: { id: string }) => string;
    allIds: string[];
  }) => {
    if (items.length === 0) return null;
    const selectedIds = (config?.[keyName] && config[keyName]!.length > 0) ? config[keyName]! : allIds;
    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">{title}</Label>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const sel = isSelected(config?.[keyName], item.id, allIds);
            const isLastSelected = sel && selectedIds.length === 1;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !isLastSelected && handleToggle(keyName, item.id, allIds)}
                disabled={isLastSelected}
                title={isLastSelected ? 'Selecione pelo menos um' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  sel
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                } ${isLastSelected ? 'opacity-90 cursor-default' : 'cursor-pointer'}`}
              >
                {sel && <Check className="h-3.5 w-3.5" />}
                {getLabel(item)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {config?.[keyName] && (config[keyName]?.length ?? 0) > 0 && (config[keyName]?.length ?? 0) < allIds.length
            ? `${config[keyName]?.length} de ${allIds.length} selecionados`
            : 'Todos aplicados (vazio = todos)'}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Detalhes Custom</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quais itens da Configuração Custom se aplicam a este produto. Deixe todos selecionados ou escolha apenas alguns.
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <Section
            title="Tamanhos"
            items={activeSizes}
            keyName="sizeIds"
            getLabel={(s) => (s as PizzaSize).name}
            allIds={activeSizes.map((s) => s.id)}
          />
          <Section
            title="Tipos de massa"
            items={activeDoughs}
            keyName="doughIds"
            getLabel={(d) => (d as PizzaDough).name}
            allIds={activeDoughs.map((d) => d.id)}
          />
          <Section
            title="Bordas recheadas"
            items={activeEdges}
            keyName="edgeIds"
            getLabel={(e) => (e as PizzaEdge).name}
            allIds={activeEdges.map((e) => e.id)}
          />
          <Section
            title="Extras"
            items={activeExtras}
            keyName="extraIds"
            getLabel={(e) => (e as PizzaExtra).name}
            allIds={activeExtras.map((e) => e.id)}
          />
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
