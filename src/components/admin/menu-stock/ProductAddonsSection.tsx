import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Package, AlertCircle, ListChecks, Hash } from 'lucide-react';
import { convertPriceToStorage, convertPriceFromStorage, getCurrencySymbol } from '@/lib/priceHelper';
import type { ProductAddonGroupWithItems } from '@/hooks/queries/useProductAddons';
import type { CostCurrencyCode } from '@/lib/priceHelper';

export type AddonMode = 'padrao' | 'quantidade';

export interface AddonGroupEdit {
  id: string;
  name: string;
  order_index: number;
  addon_mode?: AddonMode;
  addon_min?: number;
  addon_max?: number;
  addon_required?: boolean;
  items: AddonItemEdit[];
}

export interface AddonItemEdit {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  cost: number;
  costDisplay: string;
  cost_currency: CostCurrencyCode;
  in_stock: boolean;
  ingredient_id: string | null;
  order_index: number;
  max_quantity?: number;
}

export interface ProductAddonsSectionRef {
  getGroups: () => AddonGroupEdit[];
}

interface ProductAddonsSectionProps {
  addons: ProductAddonGroupWithItems[];
  /** ID do produto em edição. Quando null, está criando novo — não sobrescreve grupos locais quando addons vazio */
  productId?: string | null;
  currency: CostCurrencyCode;
  costCurrency: CostCurrencyCode;
  ingredients: Array<{ id: string; name: string; unit: string }>;
  onChange?: (groups: AddonGroupEdit[]) => void;
}

function toEditGroups(addons: ProductAddonGroupWithItems[], currency: CostCurrencyCode): AddonGroupEdit[] {
  return addons.map((g) => ({
    id: g.id,
    name: g.name,
    order_index: g.order_index,
    addon_mode: (g as ProductAddonGroupWithItems & { addon_mode?: AddonMode }).addon_mode ?? 'quantidade',
    addon_min: (g as ProductAddonGroupWithItems & { addon_min?: number }).addon_min ?? 0,
    addon_max: (g as ProductAddonGroupWithItems & { addon_max?: number }).addon_max ?? 5,
    addon_required: (g as ProductAddonGroupWithItems & { addon_required?: boolean }).addon_required ?? false,
    items: g.items.map((it, ii) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      priceDisplay: String(convertPriceFromStorage(it.price, currency)),
      cost: it.cost ?? 0,
      costDisplay: it.cost != null ? String(convertPriceFromStorage(it.cost, (it.cost_currency as CostCurrencyCode) || 'BRL')) : '',
      cost_currency: (it.cost_currency as CostCurrencyCode) || 'BRL',
      in_stock: it.in_stock ?? false,
      ingredient_id: it.ingredient_id ?? null,
      order_index: ii,
      max_quantity: (it as { max_quantity?: number }).max_quantity ?? 10,
    })),
  }));
}

const ProductAddonsSectionInner = ({
  addons,
  productId,
  currency,
  costCurrency,
  ingredients,
  onChange,
}: ProductAddonsSectionProps, ref: React.Ref<ProductAddonsSectionRef>) => {
  const [groups, setGroups] = useState<AddonGroupEdit[]>(
    addons.length > 0 ? toEditGroups(addons, currency) : []
  );
  const prevProductIdRef = useRef<string | null | undefined>(productId);

  useEffect(() => {
    const prevId = prevProductIdRef.current;
    prevProductIdRef.current = productId;

    if (productId) {
      // Editando produto existente: sincroniza com addons do servidor
      const next = addons.length > 0 ? toEditGroups(addons, currency) : [];
      setGroups(next);
    } else if (prevId != null) {
      // Troca de edição para criação: limpa os grupos
      setGroups([]);
    }
    // Criando produto novo (productId null, sempre foi null): não sobrescreve groups,
    // preservando os grupos/itens que o usuário adicionou localmente
  }, [productId, addons, currency]);

  useImperativeHandle(ref, () => ({
    getGroups: () => groups,
  }), [groups]);

  const updateGroups = (next: AddonGroupEdit[]) => {
    setGroups(next);
    onChange?.(next);
  };

  const addGroup = () => {
    const next = [
      ...groups,
      {
        id: `new-${Date.now()}`,
        name: '',
        order_index: groups.length,
        addon_mode: 'quantidade' as AddonMode,
        addon_min: 0,
        addon_max: 5,
        addon_required: false,
        items: [],
      },
    ];
    updateGroups(next);
  };

  const updateGroup = (idx: number, patch: Partial<AddonGroupEdit>) => {
    const next = [...groups];
    next[idx] = { ...next[idx], ...patch };
    updateGroups(next);
  };

  const removeGroup = (idx: number) => {
    updateGroups(groups.filter((_, i) => i !== idx));
  };

  const addItem = (groupIdx: number) => {
    const g = groups[groupIdx];
    const next = [...groups];
    next[groupIdx] = {
      ...g,
      items: [
        ...g.items,
        {
          id: `new-item-${Date.now()}`,
          name: '',
          price: 0,
          priceDisplay: '',
          cost: 0,
          costDisplay: '',
          cost_currency: costCurrency,
          in_stock: false,
          ingredient_id: null,
          order_index: g.items.length,
          max_quantity: 10,
        },
      ],
    };
    updateGroups(next);
  };

  const updateItem = (groupIdx: number, itemIdx: number, patch: Partial<AddonItemEdit>) => {
    const next = [...groups];
    const items = [...next[groupIdx].items];
    items[itemIdx] = { ...items[itemIdx], ...patch };
    next[groupIdx] = { ...next[groupIdx], items };
    updateGroups(next);
  };

  const removeItem = (groupIdx: number, itemIdx: number) => {
    const next = [...groups];
    next[groupIdx] = {
      ...next[groupIdx],
      items: next[groupIdx].items.filter((_, i) => i !== itemIdx),
    };
    updateGroups(next);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Adicionais do produto</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGroup} className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Novo grupo
        </Button>
      </div>
      <div className="p-4 space-y-4">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum adicional configurado. Adicione grupos (ex: Borda, Extras) e defina os itens com preço e custo.
          </p>
        ) : (
          groups.map((g, gi) => (
            <div key={g.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={g.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder="Nome do grupo (ex: Borda, Extras)"
                  className="flex-1 h-9 text-sm font-medium"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(gi)}
                  className="text-destructive hover:text-destructive h-9 w-9 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Tipo:</span>
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { addon_mode: 'padrao' })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                      (g.addon_mode ?? 'quantidade') === 'padrao' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    <ListChecks className="h-3 w-3" /> Padrão
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { addon_mode: 'quantidade' })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                      (g.addon_mode ?? 'quantidade') === 'quantidade' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    <Hash className="h-3 w-3" /> Quantidade
                  </button>
                </div>
                {(g.addon_mode ?? 'quantidade') === 'padrao' && (
                  <div className="flex items-center gap-3 ml-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Mín</Label>
                      <Input type="number" min={0} max={20} value={g.addon_min ?? 0}
                        onChange={(e) => updateGroup(gi, { addon_min: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="h-7 w-12 text-xs" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Máx</Label>
                      <Input type="number" min={0} max={20} value={g.addon_max ?? 5}
                        onChange={(e) => updateGroup(gi, { addon_max: Math.max(0, parseInt(e.target.value, 10) || 5) })}
                        className="h-7 w-12 text-xs" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Switch checked={g.addon_required ?? false} onCheckedChange={(v) => updateGroup(gi, { addon_required: v })} />
                      Obrigatório
                    </label>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {g.items.map((it, ii) => {
                  const needsIngredient = it.in_stock && !it.ingredient_id;
                  const hasIngredients = ingredients.length > 0;
                  return (
                  <div
                    key={it.id}
                    className={`rounded-lg border p-4 space-y-3 ${
                      needsIngredient ? 'border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20' : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Input
                        value={it.name}
                        onChange={(e) => updateItem(gi, ii, { name: e.target.value })}
                        placeholder="Nome (ex: Borda Catupiry)"
                        className="flex-1 h-9 text-sm font-medium"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(gi, ii)}
                        className="text-destructive hover:text-destructive h-9 w-9 p-0 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preço</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={it.priceDisplay}
                          onChange={(e) => {
                            const raw = currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value;
                            const val = convertPriceToStorage(raw, currency);
                            updateItem(gi, ii, { priceDisplay: raw, price: Number.isNaN(val) ? 0 : val });
                          }}
                          placeholder={getCurrencySymbol(currency)}
                          className="h-9 text-sm tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Custo</Label>
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={it.costDisplay}
                            onChange={(e) => {
                              const raw = it.cost_currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value;
                              const val = convertPriceToStorage(raw, it.cost_currency);
                              updateItem(gi, ii, { costDisplay: raw, cost: Number.isNaN(val) ? 0 : val });
                            }}
                            placeholder={getCurrencySymbol(it.cost_currency)}
                            className="h-9 text-sm tabular-nums flex-1"
                          />
                          <Select
                            value={it.cost_currency}
                            onValueChange={(v) => updateItem(gi, ii, { cost_currency: v as CostCurrencyCode })}
                          >
                            <SelectTrigger className="w-14 h-9 text-xs shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BRL">R$</SelectItem>
                              <SelectItem value="PYG">Gs</SelectItem>
                              <SelectItem value="ARS">AR$</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {(g.addon_mode ?? 'quantidade') === 'quantidade' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Qtde. máx</Label>
                        <Input type="number" min={1} max={50} defaultValue={it.max_quantity ?? 10}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!Number.isNaN(v) && v >= 1 && v <= 50) updateItem(gi, ii, { max_quantity: v });
                          }}
                          className="h-8 w-16 text-sm" />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/60">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Switch
                          checked={it.in_stock}
                          onCheckedChange={(v) => updateItem(gi, ii, { in_stock: v, ingredient_id: v ? it.ingredient_id : null })}
                        />
                        <span className="font-medium">Controle de estoque</span>
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </label>

                      {it.in_stock && (
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            Item de estoque relacionado
                            <span className="text-amber-600">*</span>
                          </Label>
                          {hasIngredients ? (
                            <Select
                              value={it.ingredient_id ?? ''}
                              onValueChange={(v) => updateItem(gi, ii, { ingredient_id: v || null })}
                            >
                              <SelectTrigger className={`h-9 text-sm ${needsIngredient ? 'border-amber-400' : ''}`}>
                                <SelectValue placeholder="Selecione o ingrediente" />
                              </SelectTrigger>
                              <SelectContent>
                                {ingredients.map((ing) => (
                                  <SelectItem key={ing.id} value={ing.id}>
                                    {ing.name}
                                    {ing.unit && ing.unit !== 'un' && (
                                      <span className="text-muted-foreground ml-1">({ing.unit})</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>Cadastre ingredientes em Estoque → Ingredientes para vincular.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );})}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addItem(gi)}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar item
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ProductAddonsSection = forwardRef<ProductAddonsSectionRef, ProductAddonsSectionProps>(ProductAddonsSectionInner);
export default ProductAddonsSection;
