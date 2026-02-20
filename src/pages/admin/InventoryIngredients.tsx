import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  formatPriceInputPyG,
  getCurrencySymbol,
  formatPrice,
  convertBetweenCurrencies,
} from '@/lib/priceHelper';
import { Ingredient, IngredientStock } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Edit,
  Search,
  Loader2,
  Calendar,
  AlertTriangle,
  Check,
  Package,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pç', 'por'];

interface IngredientWithStock extends Ingredient {
  stock?: IngredientStock;
}

function getIngredientStatus(stock: IngredientStock | undefined): 'unconfigured' | 'out_of_stock' | 'low_stock' | 'in_stock' {
  if (!stock) return 'unconfigured';
  if (stock.quantity <= 0) return 'out_of_stock';
  if (stock.min_quantity > 0 && stock.quantity <= stock.min_quantity) return 'low_stock';
  return 'in_stock';
}

function StatusBadgeIngredient({ stock }: { stock: IngredientStock | undefined }) {
  const status = getIngredientStatus(stock);
  if (status === 'unconfigured') {
    return (
      <Badge variant="outline" className="text-xs gap-1 text-slate-400 border-slate-200">
        Não configurado
      </Badge>
    );
  }
  if (status === 'out_of_stock') {
    return (
      <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        Esgotado
      </Badge>
    );
  }
  if (status === 'low_stock') {
    return (
      <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        Baixo
      </Badge>
    );
  }
  return (
    <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      <Check className="h-3 w-3" />
      OK
    </Badge>
  );
}

export default function InventoryIngredients() {
  const restaurantId = useAdminRestaurantId();
  const { restaurant } = useAdminRestaurant();
  const currency = useAdminCurrency();
  const exchangeRates = restaurant?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };

  const [ingredients, setIngredients] = useState<IngredientWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientWithStock | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    unit: 'un',
    cost_per_unit: '',
    cost_currency: 'BRL' as 'BRL' | 'PYG' | 'ARS',
    sku: '',
    notes: '',
    quantity: '0',
    min_quantity: '0',
    expiry_date: '',
  });

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustIngredient, setAdjustIngredient] = useState<IngredientWithStock | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustType, setAdjustType] = useState<'restock' | 'adjustment' | 'loss'>('restock');
  const [adjusting, setAdjusting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [ingRes, stockRes] = await Promise.all([
        supabase.from('ingredients').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.from('ingredient_stock').select('*'),
      ]);
      const stockMap: Record<string, IngredientStock> = {};
      (stockRes.data ?? []).forEach((s) => { stockMap[s.ingredient_id] = s; });
      const list = (ingRes.data ?? []).map((i) => ({ ...i, stock: stockMap[i.id] }));
      setIngredients(list);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = ingredients.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q);
  });

  const openEdit = (ing: IngredientWithStock | null) => {
    if (ing) {
      setEditingIngredient(ing);
      const costCur = (ing.cost_currency ?? currency) as 'BRL' | 'PYG' | 'ARS';
      setForm({
        name: ing.name,
        unit: ing.unit,
        cost_per_unit: ing.cost_per_unit ? convertPriceFromStorage(ing.cost_per_unit, costCur) : '',
        cost_currency: costCur,
        sku: ing.sku ?? '',
        notes: ing.notes ?? '',
        quantity: ing.stock ? String(Number(ing.stock.quantity)) : '0',
        min_quantity: ing.stock ? String(Number(ing.stock.min_quantity)) : '0',
        expiry_date: ing.stock?.expiry_date ?? '',
      });
    } else {
      setEditingIngredient(null);
      setForm({
        name: '',
        unit: 'un',
        cost_per_unit: '',
        cost_currency: 'BRL',
        sku: '',
        notes: '',
        quantity: '0',
        min_quantity: '0',
        expiry_date: '',
      });
    }
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const costVal = form.cost_per_unit ? convertPriceToStorage(form.cost_per_unit, form.cost_currency) : 0;
      const qty = parseFloat(form.quantity.replace(',', '.')) || 0;
      const minQty = parseFloat(form.min_quantity.replace(',', '.')) || 0;

      if (editingIngredient) {
        await supabase
          .from('ingredients')
          .update({
            name: form.name.trim(),
            unit: form.unit,
            cost_per_unit: costVal,
            cost_currency: form.cost_per_unit ? form.cost_currency : null,
            sku: form.sku.trim() || null,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingIngredient.id);

        if (editingIngredient.stock) {
          await supabase
            .from('ingredient_stock')
            .update({
              quantity: qty,
              min_quantity: minQty,
              expiry_date: form.expiry_date || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingIngredient.stock.id);
        } else if (qty > 0 || minQty > 0) {
          const { data } = await supabase
            .from('ingredient_stock')
            .insert({
              ingredient_id: editingIngredient.id,
              quantity: qty,
              min_quantity: minQty,
              expiry_date: form.expiry_date || null,
            })
            .select()
            .single();
          if (data) {
            await supabase.from('ingredient_movements').insert({
              ingredient_stock_id: data.id,
              quantity_change: qty,
              movement_type: 'restock',
              notes: 'Cadastro inicial',
            });
          }
        }
        toast({ title: 'Ingrediente atualizado!' });
      } else {
        const { data: ing } = await supabase
          .from('ingredients')
          .insert({
            restaurant_id: restaurantId,
            name: form.name.trim(),
            unit: form.unit,
            cost_per_unit: costVal,
            cost_currency: form.cost_per_unit ? form.cost_currency : null,
            sku: form.sku.trim() || null,
            notes: form.notes.trim() || null,
          })
          .select()
          .single();

        if (ing && (qty > 0 || minQty > 0)) {
          const { data: st } = await supabase
            .from('ingredient_stock')
            .insert({ ingredient_id: ing.id, quantity: qty, min_quantity: minQty, expiry_date: form.expiry_date || null })
            .select()
            .single();
          if (st && qty > 0) {
            await supabase.from('ingredient_movements').insert({
              ingredient_stock_id: st.id,
              quantity_change: qty,
              movement_type: 'restock',
              notes: 'Cadastro inicial',
            });
          }
        }
        toast({ title: 'Ingrediente cadastrado!' });
      }
      setEditModal(false);
      await loadAll();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (ing: IngredientWithStock) => {
    setAdjustIngredient(ing);
    setAdjustDelta('');
    setAdjustType('restock');
    setAdjustModal(true);
  };

  const handleAdjust = async () => {
    if (!adjustIngredient?.stock || !adjustDelta) return;
    const delta = parseFloat(adjustDelta.replace(',', '.'));
    if (isNaN(delta) || delta === 0) return;
    const actualDelta = adjustType === 'loss' ? -Math.abs(delta) : Math.abs(delta);
    const newQty = Number(adjustIngredient.stock.quantity) + actualDelta;

    setAdjusting(true);
    try {
      await supabase
        .from('ingredient_stock')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', adjustIngredient.stock.id);
      await supabase.from('ingredient_movements').insert({
        ingredient_stock_id: adjustIngredient.stock.id,
        quantity_change: actualDelta,
        movement_type: adjustType,
        notes: adjustType === 'restock' ? 'Reposição' : adjustType === 'loss' ? 'Perda' : 'Ajuste',
      });
      toast({ title: 'Movimentação registrada!' });
      setAdjustModal(false);
      await loadAll();
    } catch {
      toast({ title: 'Erro ao registrar', variant: 'destructive' });
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ingredientes</h2>
          <p className="text-sm text-muted-foreground">Matérias-primas e seus estoques para receitas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="pl-8 h-8 w-44 text-sm"
            />
          </div>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => openEdit(null)}>
            <Plus className="h-3.5 w-3.5" />
            Novo Ingrediente
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={loadAll}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center space-y-3">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium">Nenhum ingrediente cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Cadastre ingredientes para montar as receitas dos seus produtos e ter CMV preciso no BI.
            </p>
            <Button size="sm" onClick={() => openEdit(null)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Cadastrar primeiro ingrediente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Ingrediente</TableHead>
                <TableHead className="whitespace-nowrap">Unidade</TableHead>
                <TableHead className="whitespace-nowrap">Custo/Un.</TableHead>
                <TableHead className="whitespace-nowrap">Estoque</TableHead>
                <TableHead className="whitespace-nowrap">Mínimo</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[90px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ing) => {
                const costCur = (ing.cost_currency ?? currency) as 'BRL' | 'PYG' | 'ARS';
                const costInBase = ing.cost_per_unit != null && costCur !== currency
                  ? convertBetweenCurrencies(ing.cost_per_unit, costCur, currency, exchangeRates)
                  : ing.cost_per_unit ?? 0;
                const stock = ing.stock;
                const qty = stock ? Number(stock.quantity) : 0;
                const unit = ing.unit;
                return (
                  <TableRow key={ing.id} className="group">
                    <TableCell>
                      <div className="font-medium">{ing.name}</div>
                      {ing.sku && <div className="text-xs text-muted-foreground">SKU: {ing.sku}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{unit}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatPrice(costInBase, currency)}</TableCell>
                    <TableCell>
                      {stock ? (
                        <div className="flex items-center gap-1">
                          <span className={`text-sm tabular-nums ${qty <= 0 ? 'text-red-600 font-semibold' : qty <= (stock.min_quantity || 0) ? 'text-amber-600' : ''}`}>
                            {Number(qty) % 1 !== 0 ? Number(qty).toFixed(2) : Number(qty).toFixed(0)} {unit}
                          </span>
                          {stock && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => openAdjust(ing)}
                              title="Movimentar"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {stock ? `${Number(stock.min_quantity)} ${unit}` : '—'}
                    </TableCell>
                    <TableCell><StatusBadgeIngredient stock={stock} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ing)} title="Editar">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIngredient ? 'Editar ingrediente' : 'Novo ingrediente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Queijo mussarela" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Custo por unidade</Label>
                <Select value={form.cost_currency} onValueChange={(v) => setForm((f) => ({ ...f, cost_currency: v as 'BRL' | 'PYG' | 'ARS' }))}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="PYG">PYG</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={form.cost_per_unit}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  cost_per_unit: form.cost_currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                }))}
                placeholder={form.cost_currency === 'PYG' ? '25.000' : '0,00'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade em estoque</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Mínimo (alerta)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.min_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Fornecedor, lote..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingIngredient ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustModal} onOpenChange={setAdjustModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Movimentar estoque</DialogTitle>
            {adjustIngredient && <p className="text-sm text-muted-foreground">{adjustIngredient.name}</p>}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'restock' as const, label: 'Reposição', icon: ArrowUpRight, color: 'text-emerald-700 border-emerald-400 bg-emerald-50' },
                { type: 'adjustment' as const, label: 'Ajuste', icon: RefreshCw, color: 'text-blue-700 border-blue-400 bg-blue-50' },
                { type: 'loss' as const, label: 'Perda', icon: ArrowDownRight, color: 'text-red-700 border-red-400 bg-red-50' },
              ].map(({ type, label, color }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAdjustType(type)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-semibold ${adjustType === type ? color : 'border-slate-200 text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex gap-2 items-center">
                <span className={adjustType === 'loss' ? 'text-red-500' : 'text-emerald-600'}>
                  {adjustType === 'loss' ? '−' : '+'}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">{adjustIngredient?.unit}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={adjusting || !adjustDelta}>
              {adjusting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
