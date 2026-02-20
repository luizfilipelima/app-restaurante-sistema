import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  formatPriceInputPyG,
  getCurrencySymbol,
  formatPrice,
} from '@/lib/priceHelper';
import { Category, Product, InventoryItem, InventoryMovement } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  PackageOpen,
  PackagePlus,
  AlertTriangle,
  TrendingDown,
  BarChart2,
  ChevronRight,
  Edit,
  Plus,
  Minus,
  Search,
  Loader2,
  Calendar,
  Clock,
  History,
  Pizza,
  UtensilsCrossed,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  X,
  Check,
  Settings,
} from 'lucide-react';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface ProductWithInventory extends Product {
  inventoryItem?: InventoryItem;
}

type InventoryFilter = 'all' | 'low' | 'out' | 'expiring' | 'unconfigured';

// ─── Helpers de status ────────────────────────────────────────────────────────

function getInventoryStatus(item: InventoryItem | undefined): 'unconfigured' | 'expired' | 'out_of_stock' | 'low_stock' | 'in_stock' {
  if (!item) return 'unconfigured';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (item.expiry_date) {
    const exp = new Date(item.expiry_date);
    if (exp < today) return 'expired';
  }
  if (item.quantity <= 0) return 'out_of_stock';
  if (item.quantity <= item.min_quantity) return 'low_stock';
  return 'in_stock';
}

function getDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ item }: { item: InventoryItem | undefined }) {
  const status = getInventoryStatus(item);
  if (status === 'unconfigured') {
    return (
      <Badge variant="outline" className="text-xs gap-1 text-slate-400 border-slate-200">
        <PackageOpen className="h-3 w-3" />
        Não cadastrado
      </Badge>
    );
  }
  if (status === 'expired') {
    return (
      <Badge className="text-xs gap-1 bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100">
        <X className="h-3 w-3" />
        Vencido
      </Badge>
    );
  }
  if (status === 'out_of_stock') {
    return (
      <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        <TrendingDown className="h-3 w-3" />
        Esgotado
      </Badge>
    );
  }
  if (status === 'low_stock') {
    return (
      <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        Estoque baixo
      </Badge>
    );
  }
  return (
    <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      <Check className="h-3 w-3" />
      Em estoque
    </Badge>
  );
}

// ─── Linha de produto na tabela ───────────────────────────────────────────────

interface ProductRowProps {
  product: ProductWithInventory;
  currency: ReturnType<typeof useAdminCurrency>;
  onEdit: (p: ProductWithInventory) => void;
  onQuickAdjust: (p: ProductWithInventory, delta: number) => void;
  onHistory: (p: ProductWithInventory) => void;
  onRegister: (p: ProductWithInventory) => void;
}

function ProductRow({ product, currency, onEdit, onQuickAdjust, onHistory, onRegister }: ProductRowProps) {
  const inv = product.inventoryItem;
  const status = getInventoryStatus(inv);
  const days = inv ? getDaysUntilExpiry(inv.expiry_date) : null;

  const salePrice = inv?.sale_price && inv.sale_price > 0 ? inv.sale_price : Number(product.price_sale || product.price);
  const costPrice = inv?.cost_price && inv.cost_price > 0 ? inv.cost_price : (product.price_cost ? Number(product.price_cost) : null);
  const margin = costPrice && salePrice > 0 ? ((salePrice - costPrice) / salePrice) * 100 : null;

  const marginColor = margin === null ? ''
    : margin >= 40 ? 'text-emerald-600'
    : margin >= 20 ? 'text-amber-600'
    : 'text-red-600';

  const quantityColor = status === 'out_of_stock' ? 'text-red-600 font-bold'
    : status === 'low_stock' ? 'text-amber-600 font-semibold'
    : status === 'expired' ? 'text-rose-600 font-semibold'
    : 'text-foreground';

  return (
    <TableRow className="group hover:bg-muted/30 transition-colors">
      {/* Foto */}
      <TableCell className="w-12 p-2">
        <div className="w-9 h-9 rounded-md overflow-hidden bg-muted border flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/60 text-sm">
              {product.is_pizza ? <Pizza className="h-4 w-4" /> : product.is_marmita ? <UtensilsCrossed className="h-4 w-4" /> : '🍽'}
            </div>
          )}
        </div>
      </TableCell>

      {/* Produto */}
      <TableCell className="min-w-0">
        <div className="font-medium text-sm truncate">{product.name}</div>
        {product.sku && <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>}
      </TableCell>

      {/* Preço Venda */}
      <TableCell className="whitespace-nowrap text-sm tabular-nums">
        {formatPrice(salePrice, currency)}
      </TableCell>

      {/* Custo */}
      <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
        {costPrice ? formatPrice(costPrice, currency) : <span className="text-muted-foreground/40">—</span>}
      </TableCell>

      {/* Margem */}
      <TableCell className="whitespace-nowrap text-sm">
        {margin !== null ? (
          <span className={`font-semibold ${marginColor}`}>{margin.toFixed(0)}%</span>
        ) : <span className="text-muted-foreground/40">—</span>}
      </TableCell>

      {/* Quantidade */}
      <TableCell className="whitespace-nowrap">
        {inv ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onQuickAdjust(product, -1)}
              title="Remover 1"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className={`text-sm tabular-nums w-14 text-center ${quantityColor}`}>
              {Number(inv.quantity) % 1 !== 0 ? Number(inv.quantity).toFixed(2) : Number(inv.quantity).toFixed(0)} {inv.unit}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onQuickAdjust(product, 1)}
              title="Adicionar 1"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : <span className="text-muted-foreground/40 text-sm">—</span>}
      </TableCell>

      {/* Mínimo */}
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
        {inv ? `${Number(inv.min_quantity) % 1 !== 0 ? Number(inv.min_quantity).toFixed(2) : Number(inv.min_quantity).toFixed(0)} ${inv.unit}` : <span className="text-muted-foreground/40">—</span>}
      </TableCell>

      {/* Validade */}
      <TableCell className="whitespace-nowrap text-sm">
        {inv?.expiry_date ? (() => {
          const expiryTitle = days === null ? '' : days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : days === 0 ? 'Vence hoje!' : `Vence em ${days} dia(s)`;
          return (
            <span
              title={expiryTitle}
              className={`flex items-center gap-1 cursor-default ${days !== null && days <= 7 ? 'text-rose-600 font-semibold' : days !== null && days <= 30 ? 'text-amber-600' : 'text-muted-foreground'}`}
            >
              <Calendar className="h-3 w-3 flex-shrink-0" />
              {new Date(inv.expiry_date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          );
        })() : <span className="text-muted-foreground/40">—</span>}
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge item={inv} />
      </TableCell>

      {/* Ações */}
      <TableCell className="w-[120px] p-1.5">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!inv ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-primary hover:text-primary"
              onClick={() => onRegister(product)}
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Cadastrar
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)} title="Editar">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onHistory(product)} title="Histórico">
                <History className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminInventory() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();

  // Dados
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>({});
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [search, setSearch] = useState('');

  // Modal de edição/cadastro
  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithInventory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    quantity: '',
    min_quantity: '5',
    unit: 'un',
    cost_price: '',
    sale_price: '',
    expiry_date: '',
    notes: '',
  });

  // Modal de ajuste rápido
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<ProductWithInventory | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustType, setAdjustType] = useState<'restock' | 'adjustment' | 'loss'>('restock');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Modal de histórico
  const [historyModal, setHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<ProductWithInventory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [catRes, prodRes, invRes] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('has_inventory', true)
          .order('order_index', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('inventory_items')
          .select('*')
          .eq('restaurant_id', restaurantId),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (prodRes.data) setProducts(prodRes.data);

      if (invRes.data) {
        const map: Record<string, InventoryItem> = {};
        invRes.data.forEach((item) => { map[item.product_id] = item; });
        setInventoryMap(map);
      }

      // Seleciona primeira categoria automaticamente
      if (catRes.data?.length && !selectedCategoryId) {
        setSelectedCategoryId(catRes.data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadHistory = async (productWithInv: ProductWithInventory) => {
    if (!productWithInv.inventoryItem) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('inventory_item_id', productWithInv.inventoryItem.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setMovements(data || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ─── Dados derivados ────────────────────────────────────────────────────────

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => p.category === selectedCategory.name);
  }, [products, selectedCategory]);

  const productsWithInventory: ProductWithInventory[] = useMemo(() => (
    categoryProducts.map((p) => ({ ...p, inventoryItem: inventoryMap[p.id] }))
  ), [categoryProducts, inventoryMap]);

  const filtered = useMemo(() => {
    let result = productsWithInventory;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q));
    }
    if (filter === 'low') result = result.filter((p) => getInventoryStatus(p.inventoryItem) === 'low_stock');
    if (filter === 'out') result = result.filter((p) => getInventoryStatus(p.inventoryItem) === 'out_of_stock');
    if (filter === 'expiring') {
      result = result.filter((p) => {
        const days = getDaysUntilExpiry(p.inventoryItem?.expiry_date);
        return days !== null && days <= 30 && days >= 0;
      });
    }
    if (filter === 'unconfigured') result = result.filter((p) => !p.inventoryItem);
    return result;
  }, [productsWithInventory, search, filter]);

  // Stats globais (todas as categorias com inventário)
  const allInventoryProducts = useMemo(() => {
    const catNames = new Set(categories.map((c) => c.name));
    return products
      .filter((p) => catNames.has(p.category))
      .map((p) => ({ ...p, inventoryItem: inventoryMap[p.id] }));
  }, [products, categories, inventoryMap]);

  const stats = useMemo(() => {
    const total = allInventoryProducts.length;
    const configured = allInventoryProducts.filter((p) => p.inventoryItem).length;
    const inStock = allInventoryProducts.filter((p) => getInventoryStatus(p.inventoryItem) === 'in_stock').length;
    const low = allInventoryProducts.filter((p) => getInventoryStatus(p.inventoryItem) === 'low_stock').length;
    const out = allInventoryProducts.filter((p) => getInventoryStatus(p.inventoryItem) === 'out_of_stock').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiring = allInventoryProducts.filter((p) => {
      const days = getDaysUntilExpiry(p.inventoryItem?.expiry_date);
      return days !== null && days <= 30 && days >= 0;
    }).length;
    const expired = allInventoryProducts.filter((p) => getInventoryStatus(p.inventoryItem) === 'expired').length;
    return { total, configured, inStock, low, out, expiring, expired };
  }, [allInventoryProducts]);

  // ─── Handlers — Edit/Register ───────────────────────────────────────────────

  const openEdit = (product: ProductWithInventory) => {
    setEditProduct(product);
    const inv = product.inventoryItem;
    setForm({
      quantity: inv ? String(Number(inv.quantity)) : '0',
      min_quantity: inv ? String(Number(inv.min_quantity)) : '5',
      unit: inv?.unit ?? 'un',
      cost_price: inv?.cost_price ? convertPriceFromStorage(inv.cost_price, currency) : '',
      sale_price: inv?.sale_price ? convertPriceFromStorage(inv.sale_price, currency) : '',
      expiry_date: inv?.expiry_date ?? '',
      notes: inv?.notes ?? '',
    });
    setEditModal(true);
  };

  const handleSaveItem = async () => {
    if (!editProduct || !restaurantId) return;
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        product_id: editProduct.id,
        quantity: parseFloat(form.quantity.replace(',', '.')) || 0,
        min_quantity: parseFloat(form.min_quantity.replace(',', '.')) || 0,
        unit: form.unit || 'un',
        cost_price: form.cost_price ? convertPriceToStorage(form.cost_price, currency) : 0,
        sale_price: form.sale_price ? convertPriceToStorage(form.sale_price, currency) : 0,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      const existing = editProduct.inventoryItem;
      if (existing) {
        const { error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;

        // Se a quantidade foi alterada, registra movimentação
        const oldQty = Number(existing.quantity);
        const newQty = payload.quantity;
        if (oldQty !== newQty) {
          await supabase.from('inventory_movements').insert({
            inventory_item_id: existing.id,
            quantity_change: newQty - oldQty,
            movement_type: 'adjustment',
            notes: 'Ajuste manual via editor',
          });
        }
      } else {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        // Log entrada inicial
        if (data && payload.quantity > 0) {
          await supabase.from('inventory_movements').insert({
            inventory_item_id: data.id,
            quantity_change: payload.quantity,
            movement_type: 'restock',
            notes: 'Cadastro inicial do estoque',
          });
        }
      }

      toast({ title: existing ? 'Estoque atualizado!' : 'Produto cadastrado no estoque!' });
      setEditModal(false);
      await loadAll();
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Handlers — Quick Adjust ────────────────────────────────────────────────

  const handleQuickAdjust = async (product: ProductWithInventory, delta: number) => {
    const inv = product.inventoryItem;
    if (!inv) return;
    const newQty = Number(inv.quantity) + delta;
    try {
      await supabase.from('inventory_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', inv.id);
      await supabase.from('inventory_movements').insert({
        inventory_item_id: inv.id,
        quantity_change: delta,
        movement_type: delta > 0 ? 'restock' : 'adjustment',
        notes: `Ajuste rápido (${delta > 0 ? '+' : ''}${delta})`,
      });
      setInventoryMap((prev) => ({
        ...prev,
        [product.id]: { ...inv, quantity: newQty },
      }));
    } catch {
      toast({ title: 'Erro ao ajustar quantidade', variant: 'destructive' });
    }
  };

  const openAdjust = (product: ProductWithInventory) => {
    setAdjustProduct(product);
    setAdjustDelta('');
    setAdjustType('restock');
    setAdjustNotes('');
    setAdjustModal(true);
  };

  const handleConfirmAdjust = async () => {
    if (!adjustProduct?.inventoryItem || !adjustDelta) return;
    const inv = adjustProduct.inventoryItem;
    const delta = parseFloat(adjustDelta.replace(',', '.'));
    if (isNaN(delta) || delta === 0) return;

    const actualDelta = adjustType === 'loss' || adjustType === 'adjustment' && delta < 0 ? -Math.abs(delta) : Math.abs(delta);
    const newQty = Number(inv.quantity) + actualDelta;

    setAdjusting(true);
    try {
      await supabase.from('inventory_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', inv.id);
      await supabase.from('inventory_movements').insert({
        inventory_item_id: inv.id,
        quantity_change: actualDelta,
        movement_type: adjustType,
        notes: adjustNotes || null,
      });
      setInventoryMap((prev) => ({
        ...prev,
        [adjustProduct.id]: { ...inv, quantity: newQty },
      }));
      toast({ title: 'Movimentação registrada!' });
      setAdjustModal(false);
    } catch {
      toast({ title: 'Erro ao registrar movimentação', variant: 'destructive' });
    } finally {
      setAdjusting(false);
    }
  };

  // ─── Handlers — Histórico ───────────────────────────────────────────────────

  const openHistory = async (product: ProductWithInventory) => {
    setHistoryProduct(product);
    setHistoryModal(true);
    await loadHistory(product);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie quantidades, custos e validades dos seus produtos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-8 h-8 w-44 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={loadAll}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          onClick={() => { setFilter('all'); }}
          className={`text-left rounded-xl border p-3.5 transition-all ${filter === 'all' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
        >
          <div className={`text-xs font-medium mb-1 ${filter === 'all' ? 'text-slate-300' : 'text-muted-foreground'}`}>Total Itens</div>
          <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
          <div className={`text-xs mt-0.5 ${filter === 'all' ? 'text-slate-400' : 'text-muted-foreground'}`}>{stats.configured} configurados</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
          className={`text-left rounded-xl border p-3.5 transition-all ${filter === 'out' ? 'bg-red-600 border-red-500 text-white' : 'bg-white hover:bg-red-50 border-slate-200'}`}
        >
          <div className={`text-xs font-medium mb-1 ${filter === 'out' ? 'text-red-100' : 'text-muted-foreground'}`}>Esgotados</div>
          <div className={`text-2xl font-bold tabular-nums ${filter !== 'out' && stats.out > 0 ? 'text-red-600' : ''}`}>{stats.out}</div>
          <div className={`text-xs mt-0.5 ${filter === 'out' ? 'text-red-100' : stats.expired > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{stats.expired} vencido(s)</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          className={`text-left rounded-xl border p-3.5 transition-all ${filter === 'low' ? 'bg-amber-500 border-amber-400 text-white' : 'bg-white hover:bg-amber-50 border-slate-200'}`}
        >
          <div className={`text-xs font-medium mb-1 ${filter === 'low' ? 'text-amber-100' : 'text-muted-foreground'}`}>Estoque Baixo</div>
          <div className={`text-2xl font-bold tabular-nums ${filter !== 'low' && stats.low > 0 ? 'text-amber-600' : ''}`}>{stats.low}</div>
          <div className={`text-xs mt-0.5 ${filter === 'low' ? 'text-amber-100' : 'text-muted-foreground'}`}>abaixo do mínimo</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'expiring' ? 'all' : 'expiring')}
          className={`text-left rounded-xl border p-3.5 transition-all ${filter === 'expiring' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white hover:bg-orange-50 border-slate-200'}`}
        >
          <div className={`text-xs font-medium mb-1 ${filter === 'expiring' ? 'text-orange-100' : 'text-muted-foreground'}`}>Vencimento Próx.</div>
          <div className={`text-2xl font-bold tabular-nums ${filter !== 'expiring' && stats.expiring > 0 ? 'text-orange-600' : ''}`}>{stats.expiring}</div>
          <div className={`text-xs mt-0.5 ${filter === 'expiring' ? 'text-orange-100' : 'text-muted-foreground'}`}>próximos 30 dias</div>
        </button>

        <button
          onClick={() => setFilter(filter === 'unconfigured' ? 'all' : 'unconfigured')}
          className={`text-left rounded-xl border p-3.5 transition-all ${filter === 'unconfigured' ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
        >
          <div className={`text-xs font-medium mb-1 ${filter === 'unconfigured' ? 'text-slate-300' : 'text-muted-foreground'}`}>Não Configurados</div>
          <div className="text-2xl font-bold tabular-nums">{stats.total - stats.configured}</div>
          <div className={`text-xs mt-0.5 ${filter === 'unconfigured' ? 'text-slate-300' : 'text-muted-foreground'}`}>sem registro</div>
        </button>
      </div>

      {/* ── Aviso: nenhuma categoria com estoque ────────────────────────────── */}
      {!loading && categories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg mb-1">Nenhuma categoria com estoque ativo</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Ative o controle de estoque em pelo menos uma categoria pelo Central do Cardápio para começar a gerenciar.
              </p>
            </div>
            <Button asChild>
              <Link to="../menu">
                <Settings className="h-4 w-4 mr-2" />
                Ir para Central do Cardápio
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Layout duas colunas ──────────────────────────────────────────────── */}
      {(loading || categories.length > 0) && (
        <div className="flex gap-4 items-start min-h-[500px]">

          {/* ── Sidebar de categorias ──────────────────────────────────────── */}
          <div className="w-56 xl:w-64 flex-shrink-0">
            <Card className="sticky top-4">
              <CardHeader className="pb-2 pt-4 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categorias
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3 space-y-0.5">
                {loading ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : categories.map((cat) => {
                  const catProds = products.filter((p) => p.category === cat.name).map((p) => ({ ...p, inventoryItem: inventoryMap[p.id] }));
                  const hasAlert = catProds.some((p) => {
                    const s = getInventoryStatus(p.inventoryItem);
                    return s === 'out_of_stock' || s === 'expired';
                  });
                  const hasWarning = !hasAlert && catProds.some((p) => getInventoryStatus(p.inventoryItem) === 'low_stock');
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setSelectedCategoryId(cat.id); setFilter('all'); setSearch(''); }}
                      className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/70 text-foreground'
                      }`}
                    >
                      {cat.is_pizza ? (
                        <Pizza className="h-3.5 w-3.5 shrink-0" />
                      ) : cat.is_marmita ? (
                        <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      )}
                      <span className="flex-1 text-left truncate">{cat.name}</span>
                      {hasAlert ? (
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-red-300' : 'bg-red-500'}`} />
                      ) : hasWarning ? (
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-amber-300' : 'bg-amber-400'}`} />
                      ) : null}
                      <Badge
                        variant={isSelected ? 'secondary' : 'outline'}
                        className={`ml-auto shrink-0 text-xs h-4 px-1.5 ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground border-0' : ''}`}
                      >
                        {catProds.length}
                      </Badge>
                    </button>
                  );
                })}

                <div className="pt-2 border-t border-border/50 mt-2">
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground h-8 gap-1.5">
                    <Link to="../menu">
                      <Settings className="h-3 w-3" />
                      Gerenciar categorias
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Painel principal ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Cabeçalho do painel */}
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold">
                  {selectedCategory ? selectedCategory.name : 'Selecione uma categoria'}
                </h2>
                {selectedCategory && (
                  <Badge variant="outline" className="text-xs">{filtered.length} produto{filtered.length !== 1 ? 's' : ''}</Badge>
                )}
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Limpar filtro
                  </button>
                )}
              </div>
              {selectedCategory && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 flex-shrink-0"
                  onClick={() => {
                    const unconfigured = productsWithInventory.find((p) => !p.inventoryItem);
                    if (unconfigured) openEdit(unconfigured);
                  }}
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Cadastrar próximo
                </Button>
              )}
            </div>

            {/* Loading skeleton */}
            {loading ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                        <div className="h-3 bg-muted rounded animate-pulse w-1/5" />
                      </div>
                      <div className="h-4 bg-muted rounded animate-pulse w-16" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : !selectedCategory ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma categoria para ver os produtos</p>
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center space-y-3">
                  <PackageOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {search ? 'Nenhum produto encontrado' : filter !== 'all' ? 'Nenhum produto neste filtro' : 'Nenhum produto nesta categoria'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {search ? `Sem resultados para "${search}"` : filter !== 'all' ? 'Tente outro filtro ou limpe a busca.' : 'Adicione produtos pelo Central do Cardápio.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedCategoryId + filter}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                >
                  <div className="rounded-lg border border-border overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-12 p-2" />
                          <TableHead>Produto</TableHead>
                          <TableHead className="whitespace-nowrap">Preço Venda</TableHead>
                          <TableHead className="whitespace-nowrap">Custo</TableHead>
                          <TableHead className="whitespace-nowrap">Margem</TableHead>
                          <TableHead className="whitespace-nowrap">Quantidade</TableHead>
                          <TableHead className="whitespace-nowrap">Mínimo</TableHead>
                          <TableHead className="whitespace-nowrap">Validade</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            currency={currency}
                            onEdit={openEdit}
                            onQuickAdjust={handleQuickAdjust}
                            onHistory={openHistory}
                            onRegister={openEdit}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Legenda */}
                  <div className="flex items-center gap-4 mt-3 px-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Em estoque
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Estoque baixo
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Esgotado
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-600 inline-block" /> Vencido
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Editar / Cadastrar Item de Estoque
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editProduct?.inventoryItem ? 'Editar Estoque' : 'Cadastrar no Estoque'}
            </DialogTitle>
            {editProduct && (
              <p className="text-sm text-muted-foreground mt-1">
                {editProduct.name}
                {editProduct.sku && <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">SKU: {editProduct.sku}</span>}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Quantidade e mínimo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade atual</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    className="flex-1"
                  />
                  <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['un', 'kg', 'g', 'L', 'ml', 'cx', 'pç', 'por'].map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Qtd. mínima
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">(alerta de baixo estoque)</span>
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.min_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            {/* Preços */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BarChart2 className="h-3.5 w-3.5" />
                Precificação
                <span className="font-normal normal-case text-muted-foreground ml-1">(sobrepõe o produto)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Preço de custo ({getCurrencySymbol(currency)})</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      cost_price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    }))}
                    placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de venda ({getCurrencySymbol(currency)})</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      sale_price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    }))}
                    placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                  />
                </div>
              </div>
              {form.cost_price && form.sale_price && (() => {
                const cost = convertPriceToStorage(form.cost_price, currency);
                const sale = convertPriceToStorage(form.sale_price, currency);
                const m = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
                const color = m >= 40 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : m >= 20 ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-red-700 bg-red-50 border-red-200';
                return (
                  <div className={`rounded-md border px-3 py-2 text-xs font-semibold ${color}`}>
                    Margem calculada: {m.toFixed(1)}%
                  </div>
                );
              })()}
            </div>

            {/* Validade */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Data de validade
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
              {form.expiry_date && (() => {
                const days = getDaysUntilExpiry(form.expiry_date);
                if (days === null) return null;
                const color = days <= 0 ? 'text-rose-600' : days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600';
                const msg = days < 0 ? `Já vencido há ${Math.abs(days)} dia(s)`
                  : days === 0 ? 'Vence hoje!'
                  : `Vence em ${days} dia(s)`;
                return <p className={`text-xs font-medium ${color}`}>{msg}</p>;
              })()}
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Fornecedor, lote, localização no estoque..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editProduct?.inventoryItem ? 'Salvar alterações' : 'Cadastrar no estoque'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Ajuste de Estoque
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={adjustModal} onOpenChange={setAdjustModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Movimentação de Estoque
            </DialogTitle>
            {adjustProduct && (
              <p className="text-sm text-muted-foreground mt-1">{adjustProduct.name}</p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { type: 'restock' as const, label: 'Reposição', icon: ArrowUpRight, color: 'text-emerald-700 border-emerald-400 bg-emerald-50' },
                { type: 'adjustment' as const, label: 'Ajuste', icon: RefreshCw, color: 'text-blue-700 border-blue-400 bg-blue-50' },
                { type: 'loss' as const, label: 'Perda', icon: ArrowDownRight, color: 'text-red-700 border-red-400 bg-red-50' },
              ] as const).map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAdjustType(type)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 py-3 px-2 text-xs font-semibold transition-all ${
                    adjustType === type ? color + ' border-2' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Quantidade */}
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex gap-2 items-center">
                <span className={`text-lg font-bold w-5 text-center ${adjustType === 'loss' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {adjustType === 'loss' ? '−' : '+'}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground w-6">{adjustProduct?.inventoryItem?.unit}</span>
              </div>
              {adjustProduct?.inventoryItem && adjustDelta && (
                <p className="text-xs text-muted-foreground">
                  Estoque atual: <strong>{Number(adjustProduct.inventoryItem.quantity).toFixed(2)} {adjustProduct.inventoryItem.unit}</strong>
                  {' → '}
                  <strong>
                    {(Number(adjustProduct.inventoryItem.quantity) + (adjustType === 'loss' ? -Math.abs(parseFloat(adjustDelta.replace(',', '.')) || 0) : Math.abs(parseFloat(adjustDelta.replace(',', '.')) || 0))).toFixed(2)} {adjustProduct.inventoryItem.unit}
                  </strong>
                </p>
              )}
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <Label>Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Ex: Compra nota fiscal 123, quebra, etc."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdjustModal(false)}>Cancelar</Button>
            <Button onClick={handleConfirmAdjust} disabled={adjusting || !adjustDelta}>
              {adjusting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Histórico de Movimentações
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={historyModal} onOpenChange={setHistoryModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Movimentações
            </DialogTitle>
            {historyProduct && (
              <p className="text-sm text-muted-foreground mt-1">{historyProduct.name}</p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 py-2">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
              </div>
            ) : (
              movements.map((mv) => {
                const isPositive = mv.quantity_change > 0;
                const typeLabel: Record<string, string> = {
                  sale: 'Venda',
                  restock: 'Reposição',
                  adjustment: 'Ajuste',
                  loss: 'Perda',
                  return: 'Devolução',
                };
                const typeColor: Record<string, string> = {
                  sale: 'text-red-600 bg-red-50 border-red-100',
                  restock: 'text-emerald-700 bg-emerald-50 border-emerald-100',
                  adjustment: 'text-blue-600 bg-blue-50 border-blue-100',
                  loss: 'text-rose-700 bg-rose-50 border-rose-100',
                  return: 'text-purple-600 bg-purple-50 border-purple-100',
                };
                return (
                  <div key={mv.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <div className={`flex-shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeColor[mv.movement_type] ?? 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                      {typeLabel[mv.movement_type] ?? mv.movement_type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{mv.quantity_change > 0 ? Number(mv.quantity_change).toFixed(2) : Number(mv.quantity_change).toFixed(2)} {historyProduct?.inventoryItem?.unit}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(mv.created_at).toLocaleDateString('pt-BR')} {new Date(mv.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {mv.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{mv.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {historyProduct?.inventoryItem && (
            <div className="border-t pt-3 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Estoque atual: <strong className="text-foreground">{Number(historyProduct.inventoryItem.quantity).toFixed(2)} {historyProduct.inventoryItem.unit}</strong>
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setHistoryModal(false);
                  openAdjust(historyProduct);
                }}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Registrar movimentação
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
