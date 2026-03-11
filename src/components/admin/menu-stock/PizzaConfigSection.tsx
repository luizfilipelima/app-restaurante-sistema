import { useState } from 'react';
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
import { Plus, Trash2, SlidersHorizontal, Package, AlertCircle } from 'lucide-react';
import { usePizzaConfig, usePizzaConfigMutations } from '@/hooks/queries/usePizzaConfig';
import {
  formatPrice,
  convertPriceToStorage,
  convertPriceFromStorage,
  getCurrencySymbol,
  formatPriceInputPyG,
} from '@/lib/priceHelper';
import type { PizzaSize, PizzaDough, PizzaEdge, PizzaExtra } from '@/types';
import type { CurrencyCode, CostCurrencyCode } from '@/lib/priceHelper';
import { toast } from '@/hooks/shared/use-toast';

interface PizzaConfigSectionProps {
  restaurantId: string | null;
  currency: CurrencyCode;
  costCurrency?: CostCurrencyCode;
  ingredients?: Array<{ id: string; name: string; unit: string }>;
}

export default function PizzaConfigSection({
  restaurantId,
  currency,
  costCurrency,
  ingredients = [],
}: PizzaConfigSectionProps) {
  const costCur = costCurrency ?? currency;
  const { sizes, doughs, edges, extras, loading } = usePizzaConfig(restaurantId);
  const mut = usePizzaConfigMutations(restaurantId);

  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeMaxFlavors, setNewSizeMaxFlavors] = useState('2');
  const [newDoughName, setNewDoughName] = useState('');
  const [newEdgeName, setNewEdgeName] = useState('');
  const [newEdgePrice, setNewEdgePrice] = useState('');
  const [newEdgeCost, setNewEdgeCost] = useState('');
  const [newEdgeCostCurrency, setNewEdgeCostCurrency] = useState<CostCurrencyCode>(costCur);
  const [newEdgeInStock, setNewEdgeInStock] = useState(false);
  const [newEdgeIngredientId, setNewEdgeIngredientId] = useState<string | null>(null);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');
  const [newExtraCost, setNewExtraCost] = useState('');
  const [newExtraCostCurrency, setNewExtraCostCurrency] = useState<CostCurrencyCode>(costCur);
  const [newExtraInStock, setNewExtraInStock] = useState(false);
  const [newExtraIngredientId, setNewExtraIngredientId] = useState<string | null>(null);

  const formatInput = (v: string, cur: string) =>
    cur === 'PYG' ? formatPriceInputPyG(v) : v;

  const handleAddSize = async () => {
    const name = newSizeName.trim();
    if (!name) return;
    try {
      await mut.createSize.mutateAsync({
        name,
        max_flavors: Math.max(1, parseInt(newSizeMaxFlavors, 10) || 2),
        price_multiplier: 1,
      });
      setNewSizeName('');
      setNewSizeMaxFlavors('2');
      toast({ title: 'Tamanho adicionado!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddDough = async () => {
    const name = newDoughName.trim();
    if (!name) return;
    try {
      await mut.createDough.mutateAsync({ name, extra_price: 0 });
      setNewDoughName('');
      toast({ title: 'Massa adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddEdge = async () => {
    const name = newEdgeName.trim();
    if (!name) return;
    try {
      const price = newEdgePrice.trim() ? convertPriceToStorage(newEdgePrice, currency) : 0;
      const cost = newEdgeCost.trim() ? convertPriceToStorage(newEdgeCost, newEdgeCostCurrency) : 0;
      await mut.createEdge.mutateAsync({
        name,
        price,
        cost,
        cost_currency: newEdgeCostCurrency,
        in_stock: newEdgeInStock,
        ingredient_id: newEdgeInStock ? newEdgeIngredientId : null,
      });
      setNewEdgeName('');
      setNewEdgePrice('');
      setNewEdgeCost('');
      setNewEdgeInStock(false);
      setNewEdgeIngredientId(null);
      toast({ title: 'Borda adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleAddExtra = async () => {
    const name = newExtraName.trim();
    if (!name) return;
    try {
      const price = newExtraPrice.trim() ? convertPriceToStorage(newExtraPrice, currency) : 0;
      const cost = newExtraCost.trim() ? convertPriceToStorage(newExtraCost, newExtraCostCurrency) : 0;
      await mut.createExtra.mutateAsync({
        name,
        price,
        cost,
        cost_currency: newExtraCostCurrency,
        in_stock: newExtraInStock,
        ingredient_id: newExtraInStock ? newExtraIngredientId : null,
      });
      setNewExtraName('');
      setNewExtraPrice('');
      setNewExtraCost('');
      setNewExtraInStock(false);
      setNewExtraIngredientId(null);
      toast({ title: 'Extra adicionado!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleDelete = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
      toast({ title: `${label} removido(a)!` });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  const handleUpdateEdge = async (
    id: string,
    data: { name?: string; price?: number; cost?: number; cost_currency?: string; in_stock?: boolean; ingredient_id?: string | null }
  ) => {
    try {
      await mut.updateEdge.mutateAsync({ id, data });
      toast({ title: 'Borda atualizada!' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleUpdateExtra = async (
    id: string,
    data: { name?: string; price?: number; cost?: number; cost_currency?: string; in_stock?: boolean; ingredient_id?: string | null }
  ) => {
    try {
      await mut.updateExtra.mutateAsync({ id, data });
      toast({ title: 'Extra atualizado!' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  if (loading) return null;

  const hasIngredients = ingredients.length > 0;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/20">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Configuração Custom</span>
        <span className="text-xs text-muted-foreground">
          — tamanhos, massas, extras e bordas (aplicam a todos os produtos da categoria Custom)
        </span>
      </div>
      <div className="p-4 space-y-6">
        {/* Tamanhos */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Tamanhos</Label>
          <ul className="space-y-1">
            {sizes.map((s: PizzaSize) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-background/60">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">até {s.max_flavors} sabores</span>
                <button
                  type="button"
                  onClick={() => handleDelete(() => mut.deleteSize.mutateAsync(s.id), s.name)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Ex: Grande"
              value={newSizeName}
              onChange={(e) => setNewSizeName(e.target.value)}
              className="h-9 w-32"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
            />
            <Input
              type="number"
              min={1}
              max={5}
              value={newSizeMaxFlavors}
              onChange={(e) => setNewSizeMaxFlavors(e.target.value)}
              className="h-9 w-20"
              placeholder="Sabores"
            />
            <Button type="button" size="sm" onClick={handleAddSize} disabled={!newSizeName.trim() || mut.createSize.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Massas */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipos de massa</Label>
          <ul className="flex flex-wrap gap-1.5">
            {doughs.filter((d: PizzaDough) => d.is_active).map((d: PizzaDough) => (
              <li key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 text-sm">
                <span>{d.name}</span>
                {d.extra_price > 0 && (
                  <span className="text-xs text-muted-foreground">+{formatPrice(d.extra_price, currency)}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(() => mut.deleteDough.mutateAsync(d.id), d.name)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Tradicional, Integral"
              value={newDoughName}
              onChange={(e) => setNewDoughName(e.target.value)}
              className="h-9 flex-1 max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleAddDough()}
            />
            <Button type="button" size="sm" onClick={handleAddDough} disabled={!newDoughName.trim() || mut.createDough.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Extras */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Extras</Label>
          <div className="space-y-3">
            {extras.filter((x: PizzaExtra) => x.is_active).map((x: PizzaExtra) => {
              const needsIngredient = x.in_stock && !x.ingredient_id;
              const priceDisp = String(convertPriceFromStorage(x.price, currency));
              const costDisp =
                x.cost != null && x.cost > 0
                  ? String(convertPriceFromStorage(x.cost, (x.cost_currency as CostCurrencyCode) ?? costCur))
                  : '';
              return (
                <div
                  key={x.id}
                  className={`rounded-lg border p-4 space-y-3 ${
                    needsIngredient ? 'border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20' : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      defaultValue={x.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== x.name) handleUpdateExtra(x.id, { name: v });
                      }}
                      placeholder="Nome (ex: Aceitunas)"
                      className="flex-1 h-9 text-sm font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(() => mut.deleteExtra.mutateAsync(x.id), x.name)}
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
                        defaultValue={priceDisp}
                        onBlur={(e) => {
                          const raw = currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value;
                          const val = convertPriceToStorage(raw, currency);
                          if (!Number.isNaN(val) && val !== x.price)
                            handleUpdateExtra(x.id, { price: val });
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
                          defaultValue={costDisp}
                          onBlur={(e) => {
                            const cur = (x.cost_currency as CostCurrencyCode) ?? costCur;
                            const raw = cur === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value;
                            const val = convertPriceToStorage(raw, cur);
                            if (!Number.isNaN(val) && val !== (x.cost ?? 0))
                              handleUpdateExtra(x.id, { cost: val });
                          }}
                          placeholder={getCurrencySymbol((x.cost_currency as CostCurrencyCode) ?? costCur)}
                          className="h-9 text-sm tabular-nums flex-1"
                        />
                        <Select
                          value={(x.cost_currency as CostCurrencyCode) ?? costCur}
                          onValueChange={(v) => handleUpdateExtra(x.id, { cost_currency: v })}
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
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/60">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={x.in_stock ?? false}
                        onCheckedChange={(v) =>
                          handleUpdateExtra(x.id, { in_stock: v, ingredient_id: v ? x.ingredient_id : null })
                        }
                      />
                      <span className="font-medium">Controle de estoque</span>
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </label>
                    {x.in_stock && (
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          Item de estoque relacionado
                          <span className="text-amber-600">*</span>
                        </Label>
                        {hasIngredients ? (
                          <Select
                            value={x.ingredient_id ?? ''}
                            onValueChange={(v) => handleUpdateExtra(x.id, { ingredient_id: v || null })}
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
              );
            })}
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Adicionar novo extra</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Ex: Aceitunas, Alcaparras"
                value={newExtraName}
                onChange={(e) => setNewExtraName(e.target.value)}
                className="h-9 w-40"
              />
              <Input
                placeholder={`Preço (${getCurrencySymbol(currency)})`}
                value={newExtraPrice}
                onChange={(e) => setNewExtraPrice(formatInput(e.target.value, currency))}
                className="h-9 w-28"
              />
              <Input
                placeholder={`Custo (${getCurrencySymbol(newExtraCostCurrency)})`}
                value={newExtraCost}
                onChange={(e) => setNewExtraCost(formatInput(e.target.value, newExtraCostCurrency))}
                className="h-9 w-28"
              />
              <Select value={newExtraCostCurrency} onValueChange={(v) => setNewExtraCostCurrency(v as CostCurrencyCode)}>
                <SelectTrigger className="w-14 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$</SelectItem>
                  <SelectItem value="PYG">Gs</SelectItem>
                  <SelectItem value="ARS">AR$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={newExtraInStock} onCheckedChange={setNewExtraInStock} />
                <span>Controle de estoque</span>
              </label>
              {newExtraInStock && hasIngredients && (
                <Select value={newExtraIngredientId ?? ''} onValueChange={(v) => setNewExtraIngredientId(v || null)}>
                  <SelectTrigger className="h-9 w-48 text-sm">
                    <SelectValue placeholder="Ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" size="sm" onClick={handleAddExtra} disabled={!newExtraName.trim() || mut.createExtra.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* Bordas recheadas */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Bordas recheadas</Label>
          <div className="space-y-3">
            {edges.filter((e: PizzaEdge) => e.is_active).map((e: PizzaEdge) => {
              const needsIngredient = e.in_stock && !e.ingredient_id;
              const priceDisp = String(convertPriceFromStorage(e.price, currency));
              const costDisp =
                e.cost != null && e.cost > 0
                  ? String(convertPriceFromStorage(e.cost, (e.cost_currency as CostCurrencyCode) ?? costCur))
                  : '';
              return (
                <div
                  key={e.id}
                  className={`rounded-lg border p-4 space-y-3 ${
                    needsIngredient ? 'border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20' : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      defaultValue={e.name}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        if (v && v !== e.name) handleUpdateEdge(e.id, { name: v });
                      }}
                      placeholder="Ex: Catupiry, Cheddar"
                      className="flex-1 h-9 text-sm font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(() => mut.deleteEdge.mutateAsync(e.id), e.name)}
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
                        defaultValue={priceDisp}
                        onBlur={(ev) => {
                          const raw = currency === 'PYG' ? ev.target.value.replace(/\D/g, '') : ev.target.value;
                          const val = convertPriceToStorage(raw, currency);
                          if (!Number.isNaN(val) && val !== e.price) handleUpdateEdge(e.id, { price: val });
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
                          defaultValue={costDisp}
                          onBlur={(ev) => {
                            const cur = (e.cost_currency as CostCurrencyCode) ?? costCur;
                            const raw = cur === 'PYG' ? ev.target.value.replace(/\D/g, '') : ev.target.value;
                            const val = convertPriceToStorage(raw, cur);
                            if (!Number.isNaN(val) && val !== (e.cost ?? 0)) handleUpdateEdge(e.id, { cost: val });
                          }}
                          placeholder={getCurrencySymbol((e.cost_currency as CostCurrencyCode) ?? costCur)}
                          className="h-9 text-sm tabular-nums flex-1"
                        />
                        <Select
                          value={(e.cost_currency as CostCurrencyCode) ?? costCur}
                          onValueChange={(v) => handleUpdateEdge(e.id, { cost_currency: v })}
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
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/60">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={e.in_stock ?? false}
                        onCheckedChange={(v) =>
                          handleUpdateEdge(e.id, { in_stock: v, ingredient_id: v ? e.ingredient_id : null })
                        }
                      />
                      <span className="font-medium">Controle de estoque</span>
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </label>
                    {e.in_stock && (
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          Item de estoque relacionado
                          <span className="text-amber-600">*</span>
                        </Label>
                        {hasIngredients ? (
                          <Select
                            value={e.ingredient_id ?? ''}
                            onValueChange={(v) => handleUpdateEdge(e.id, { ingredient_id: v || null })}
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
              );
            })}
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Adicionar nova borda</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Ex: Catupiry, Cheddar"
                value={newEdgeName}
                onChange={(e) => setNewEdgeName(e.target.value)}
                className="h-9 w-36"
                onKeyDown={(k) => k.key === 'Enter' && handleAddEdge()}
              />
              <Input
                placeholder={`Preço (${getCurrencySymbol(currency)})`}
                value={newEdgePrice}
                onChange={(e) => setNewEdgePrice(formatInput(e.target.value, currency))}
                className="h-9 w-28"
              />
              <Input
                placeholder={`Custo (${getCurrencySymbol(newEdgeCostCurrency)})`}
                value={newEdgeCost}
                onChange={(e) => setNewEdgeCost(formatInput(e.target.value, newEdgeCostCurrency))}
                className="h-9 w-28"
              />
              <Select value={newEdgeCostCurrency} onValueChange={(v) => setNewEdgeCostCurrency(v as CostCurrencyCode)}>
                <SelectTrigger className="w-14 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$</SelectItem>
                  <SelectItem value="PYG">Gs</SelectItem>
                  <SelectItem value="ARS">AR$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={newEdgeInStock} onCheckedChange={setNewEdgeInStock} />
                <span>Controle de estoque</span>
              </label>
              {newEdgeInStock && hasIngredients && (
                <Select value={newEdgeIngredientId ?? ''} onValueChange={(v) => setNewEdgeIngredientId(v || null)}>
                  <SelectTrigger className="h-9 w-48 text-sm">
                    <SelectValue placeholder="Ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" size="sm" onClick={handleAddEdge} disabled={!newEdgeName.trim() || mut.createEdge.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
