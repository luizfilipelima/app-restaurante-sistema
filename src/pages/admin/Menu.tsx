import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminRestaurant, useAdminBasePath } from '@/contexts/AdminRestaurantContext';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  formatPriceInputPyG,
  getCurrencySymbol,
  formatPrice,
  convertBetweenCurrencies,
} from '@/lib/priceHelper';
import { Product, Restaurant, Category, Subcategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { formatCurrency, generateSlug, getCardapioPublicUrl } from '@/lib/utils';
import { uploadProductImage } from '@/lib/imageUpload';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Loader2,
  Upload,
  Copy,
  Check,
  Search,
  LayoutGrid,
  QrCode,
  GripVertical,
  Edit,
  Package,
  ExternalLink,
  BarChart2,
  Eye,
  EyeOff,
  ChevronRight,
  Boxes,
  Sparkles,
  X as XIcon,
  Printer,
  ChefHat,
  Wine,
  Tag,
} from 'lucide-react';
import MenuQRCodeCard from '@/components/admin/MenuQRCodeCard';
import ProductAddonsSection, { type AddonGroupEdit } from '@/components/admin/ProductAddonsSection';
import { useProductUpsells, useSaveProductUpsells, useProductComboItems, useProductAddons, useSaveProductAddons } from '@/hooks/queries';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_TYPES = [
  { id: 'default', label: 'Padrão', is_pizza: false, is_marmita: false, extra_field: null, extra_label: null, extra_placeholder: null },
  { id: 'volume', label: 'Bebidas (volume)', is_pizza: false, is_marmita: false, extra_field: 'volume', extra_label: 'Volume ou medida', extra_placeholder: 'Ex: 350ml, 1L, 2L' },
  { id: 'portion', label: 'Sobremesas (porção)', is_pizza: false, is_marmita: false, extra_field: 'portion', extra_label: 'Porção', extra_placeholder: 'Ex: individual, fatia, 500g' },
  { id: 'detail', label: 'Combos (detalhe)', is_pizza: false, is_marmita: false, extra_field: 'detail', extra_label: 'Detalhe do combo', extra_placeholder: 'Ex: Pizza + Refrigerante' },
] as const;

const getCategoryConfigFromCategory = (cat: Category | null) => {
  if (!cat) return { isPizza: false, isMarmita: false, priceLabel: 'Preço' as string, extraField: undefined as string | undefined, extraLabel: undefined as string | undefined, extraPlaceholder: undefined as string | undefined };
  return {
    isPizza: cat.is_pizza ?? false,
    isMarmita: cat.is_marmita ?? false,
    priceLabel: cat.is_pizza ? 'Preço base (por sabor)' : cat.is_marmita ? 'Preço base' : 'Preço',
    extraField: cat.extra_field ?? undefined,
    extraLabel: cat.extra_label ?? undefined,
    extraPlaceholder: cat.extra_placeholder ?? undefined,
  };
};

type CostCurrencyCode = 'BRL' | 'PYG' | 'ARS';

const formDefaults = {
  name: '',
  categoryId: '' as string,
  description: '',
  price: '',
  priceCost: '',
  costCurrency: 'BRL' as CostCurrencyCode,
  is_pizza: false,
  is_marmita: false,
  image_url: '',
  categoryDetail: '',
  subcategoryId: '' as string | null,
  // Destino de impressão por produto
  printDest: 'kitchen' as 'kitchen' | 'bar',
  // Estoque por produto
  hasInventory: false,
  invQuantity: '',
  invMinQuantity: '5',
  invUnit: 'un',
  invExpiry: '',
};

// ─── SortableCategoryItem ──────────────────────────────────────────────────────

interface SortableCategoryItemProps {
  category: Category;
  count: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableCategoryItem({ category, count, isSelected, onSelect, onDelete }: SortableCategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 rounded-lg border transition-all h-9 px-1.5 ${
        isSelected
          ? 'bg-primary border-primary shadow-sm'
          : 'bg-background border-transparent hover:border-border hover:bg-muted/50'
      } ${isDragging ? 'shadow-md z-50' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing touch-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected ? 'text-primary-foreground/50' : 'text-muted-foreground/50'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Select button */}
      <button
        type="button"
        className="flex-1 flex items-center gap-2 text-left min-w-0"
        onClick={onSelect}
      >
        <span className={`flex-shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
        </span>
        <span className={`truncate text-sm font-medium flex-1 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
          {category.name}
        </span>
        <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {count}
        </span>
      </button>

      {/* Delete — only visible on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded ${
          isSelected ? 'text-primary-foreground/40 hover:text-primary-foreground' : 'text-muted-foreground/40 hover:text-destructive'
        }`}
        title="Excluir categoria"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Inline product row for the central view ──────────────────────────────────

interface CentralProductRowProps {
  product: Product;
  currency: ReturnType<typeof useAdminCurrency>;
  exchangeRates: { pyg_per_brl?: number; ars_per_brl?: number };
  showInventory: boolean;
  onEdit: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  offersBasePath?: string;
}

function CentralProductRow({ product, currency, exchangeRates, showInventory, onEdit, onDuplicate, onDelete, onToggleActive, offersBasePath }: CentralProductRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  const salePrice = Number(product.price_sale || product.price);
  const costCurrency = (product.cost_currency ?? currency) as CostCurrencyCode;
  const costPriceRaw = product.price_cost ? Number(product.price_cost) : null;
  const costPriceInBase = costPriceRaw != null && costCurrency !== currency
    ? convertBetweenCurrencies(costPriceRaw, costCurrency, currency, exchangeRates)
    : costPriceRaw;
  const margin = costPriceInBase != null && salePrice > 0 ? ((salePrice - costPriceInBase) / salePrice) * 100 : null;

  const marginColor = margin === null
    ? ''
    : margin >= 40 ? 'text-emerald-600 dark:text-emerald-400'
    : margin >= 20 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/80 z-10' : ''}>
      <TableCell className="w-8 p-1.5">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>

      <TableCell className="w-10 p-1.5">
        <div className="w-9 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0 border">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              {product.is_combo ? <Boxes className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{product.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {product.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">{product.description}</span>
          )}
          {/* Print destination badge */}
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
            product.print_destination === 'bar'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
          }`}>
            {product.print_destination === 'bar' ? <Wine className="h-2.5 w-2.5" /> : <ChefHat className="h-2.5 w-2.5" />}
            {product.print_destination === 'bar' ? 'Bar' : 'Cozinha'}
          </span>
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap font-medium tabular-nums text-sm">
        {formatPrice(salePrice, currency)}
      </TableCell>

      {showInventory && (
        <>
          <TableCell className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
            {costPriceInBase != null ? formatPrice(costPriceInBase, currency) : <span className="text-muted-foreground/50">—</span>}
          </TableCell>
          <TableCell className="whitespace-nowrap text-sm">
            {margin !== null ? (
              <span className={`font-semibold ${marginColor}`}>{margin.toFixed(0)}%</span>
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </TableCell>
        </>
      )}

      <TableCell className="w-12 p-2">
        <Switch
          checked={product.is_active}
          onCheckedChange={() => onToggleActive(product.id, product.is_active)}
          title={product.is_active ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}
        />
      </TableCell>

      <TableCell className="w-[140px] p-1.5">
        <div className="flex items-center gap-0.5">
          {offersBasePath && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Adicionar à oferta">
              <Link to={`${offersBasePath}?productId=${product.id}`}>
                <Tag className="h-3.5 w-3.5 text-orange-500" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)} title="Editar">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDuplicate(product)} title="Duplicar">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(product.id)} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminMenu() {
  const restaurantId = useAdminRestaurantId();
  const basePath = useAdminBasePath();
  const { restaurant: ctxRestaurant } = useAdminRestaurant();
  const currency = useAdminCurrency();
  const exchangeRates = ctxRestaurant?.exchange_rates ?? { pyg_per_brl: 3600, ars_per_brl: 1150 };

  // Core data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, Subcategory[]>>({});

  // UI states
  const [loading, setLoading] = useState(true);
  const [savingCategoryOrder, setSavingCategoryOrder] = useState(false);

  // Selected category filter (null = All)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Product search
  const [productSearch, setProductSearch] = useState('');

  // Inventory mode toggle
  const [showInventory, setShowInventory] = useState(false);

  // Product form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState(formDefaults);

  // Category add modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormType, setCategoryFormType] = useState<string>(CATEGORY_TYPES[0].id);
  const [categoryFormInventory, setCategoryFormInventory] = useState(false);
  const [categoryFormDest, setCategoryFormDest] = useState<'kitchen' | 'bar'>('kitchen');

  // QR / Online modal
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuLinkCopied, setMenuLinkCopied] = useState(false);

  // Upsell
  const [upsellSearch, setUpsellSearch] = useState('');
  const [selectedUpsellIds, setSelectedUpsellIds] = useState<string[]>([]);
  const { data: existingUpsells } = useProductUpsells(editingProduct?.id ?? null);
  const saveUpsellsMutation = useSaveProductUpsells(restaurantId);

  // Combo: itens do combo (só quando categoria é Combo - extra_field detail)
  const [comboItems, setComboItems] = useState<Array<{ product_id: string; product: Product; quantity: number }>>([]);
  const [comboSearch, setComboSearch] = useState('');
  const isComboCategory = (categories.find((c) => c.id === (form.categoryId || selectedCategoryId || categories[0]?.id))?.extra_field) === 'detail';
  const { comboItems: existingComboItems } = useProductComboItems(isComboCategory ? editingProduct?.id ?? null : null);
  const { addons } = useProductAddons(editingProduct?.id ?? null);
  const saveAddonsMutation = useSaveProductAddons(null);
  const addonSectionRef = useRef<{ getGroups: () => AddonGroupEdit[] }>(null);

  // Receita de ingredientes (para CMV preciso no BI)
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([]);
  const [productRecipeItems, setProductRecipeItems] = useState<Array<{ ingredient_id: string; ingredient_name: string; quantity_per_unit: number; unit: string }>>([]);
  const [recipeSearch, setRecipeSearch] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Quando existingUpsells carrega (ao abrir edição), sincroniza o estado local
  useEffect(() => {
    if (existingUpsells) {
      setSelectedUpsellIds(existingUpsells.map((u) => u.upsell_product_id));
    }
  }, [existingUpsells]);

  // Quando existingComboItems carrega (ao abrir edição de combo), sincroniza
  useEffect(() => {
    if (isComboCategory && existingComboItems?.length) {
      setComboItems(existingComboItems.map((ci) => ({ product_id: ci.product_id, product: ci.product!, quantity: ci.quantity })));
    } else if (!isComboCategory || !editingProduct) {
      setComboItems([]);
    }
  }, [isComboCategory, editingProduct?.id, existingComboItems]);

  // ─── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (restaurantId) {
      loadRestaurant();
      loadProducts();
      loadCategoriesAndSubcategories();
      loadMenuConfig();
    }
  }, [restaurantId]);

  const loadRestaurant = async () => {
    if (!restaurantId) return;
    try {
      const { data } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
      if (data) { setRestaurant(data); setSlug(data.slug || ''); }
    } catch (e) { console.error(e); }
  };

  const loadCategoriesAndSubcategories = async () => {
    if (!restaurantId) return;
    try {
      const [catRes, subRes] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true }),
        supabase.from('subcategories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true }),
      ]);
      if (catRes.data) setCategories(catRes.data);
      const byCat: Record<string, Subcategory[]> = {};
      (subRes.data || []).forEach((s) => {
        if (!byCat[s.category_id]) byCat[s.category_id] = [];
        byCat[s.category_id].push(s);
      });
      setSubcategoriesByCategory(byCat);
    } catch (e) { console.error('Erro ao carregar categorias:', e); }
  };

  const loadProducts = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category', { ascending: true })
        .order('order_index', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({ title: 'Erro ao carregar cardápio', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadMenuConfig = async () => {
    if (!restaurantId) return;
    try {
      const { data } = await supabase.from('ingredients').select('id, name, unit').eq('restaurant_id', restaurantId).order('name');
      if (data) setIngredients(data);
    } catch (e) { console.error('Erro ao carregar ingredientes:', e); }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────────

  const selectedCategory = selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId) ?? null : null;
  const categoryConfig = getCategoryConfigFromCategory(
    editingProduct ? (categories.find((c) => c.id === form.categoryId) ?? null) : (selectedCategory ?? (categories[0] ?? null))
  );
  const subcategoriesOfSelected = (form.categoryId && subcategoriesByCategory[form.categoryId]) || [];

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategoryId && selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory.name);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedCategoryId, selectedCategory, productSearch]);

  const groupedProducts = useMemo(() => {
    const grouped = filteredProducts.reduce((acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    }, {} as Record<string, Product[]>);
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    });
    return grouped;
  }, [filteredProducts]);

  const categoryOrder = categories.map((c) => c.name);
  const sortedCategoryNames = categoryOrder.length > 0
    ? categoryOrder.filter((name) => groupedProducts[name]?.length)
    : Object.keys(groupedProducts);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;

  // ─── DnD handlers ─────────────────────────────────────────────────────────────

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ ...c, order_index: i }));
    setCategories(reordered);
    setSavingCategoryOrder(true);
    try {
      const updates = reordered.map((c, i) =>
        supabase.from('categories').update({ order_index: i }).eq('id', c.id).eq('restaurant_id', restaurantId!)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw new Error(err.error.message);
    } catch {
      toast({ title: 'Erro ao salvar ordem', variant: 'destructive' });
      loadCategoriesAndSubcategories();
    } finally {
      setSavingCategoryOrder(false);
    }
  };

  const handleProductsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeProduct = products.find((p) => p.id === activeId);
    const overProduct = products.find((p) => p.id === overId);
    if (!activeProduct || !overProduct || activeProduct.category !== overProduct.category) return;
    const categoryProducts = products.filter((p) => p.category === activeProduct.category);
    const oldIndex = categoryProducts.findIndex((p) => p.id === activeId);
    const newIndex = categoryProducts.findIndex((p) => p.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...categoryProducts];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    const withNewOrder = reordered.map((p, i) => ({ ...p, order_index: i }));
    setProducts((prev) => {
      const others = prev.filter((p) => p.category !== activeProduct.category);
      return [...others, ...withNewOrder].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      });
    });
    (async () => {
      const results = await Promise.all(withNewOrder.map((p) => supabase.from('products').update({ order_index: p.order_index }).eq('id', p.id)));
      const err = results.find((r) => r.error);
      if (err?.error) { toast({ title: 'Erro ao salvar ordem', variant: 'destructive' }); loadProducts(); }
    })();
  };

  // ─── Product CRUD ─────────────────────────────────────────────────────────────

  const openNew = (preselectedCategoryId?: string) => {
    setUpsellSearch('');
    setSelectedUpsellIds([]);
    setComboItems([]);
    setComboSearch('');
    setProductRecipeItems([]);
    setRecipeSearch('');
    setEditingProduct(null);
    const catId = preselectedCategoryId || selectedCategoryId || categories[0]?.id || '';
    const cat = categories.find((c) => c.id === catId);
    setForm({
      ...formDefaults,
      categoryId: catId,
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      subcategoryId: null,
      printDest: (cat?.print_destination ?? 'kitchen') as 'kitchen' | 'bar',
      costCurrency: currency as CostCurrencyCode,
    });
    setModalOpen(true);
  };

  const openEdit = async (product: Product) => {
    setUpsellSearch('');
    setSelectedUpsellIds([]);
    setEditingProduct(product);
    const cat = categories.find((c) => c.name === product.category);
    const desc = product.description || '';
    const hasDetail = cat?.extra_field && desc.includes(' - ');
    const [categoryDetail, description] = hasDetail
      ? (desc.split(/ - (.+)/).slice(0, 2) as [string, string])
      : ['', desc];

    // Carrega dados de estoque (independente de categoria)
    let hasInventory = false;
    let invQuantity = '';
    let invMinQuantity = '5';
    let invUnit = 'un';
    let invExpiry = '';
    let priceCost = product.price_cost ? convertPriceFromStorage(Number(product.price_cost), (product.cost_currency ?? currency) as CostCurrencyCode) : '';
    let costCurrency = (product.cost_currency ?? currency) as CostCurrencyCode;

    if (restaurantId) {
      try {
        const { data: inv } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('product_id', product.id)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        if (inv) {
          hasInventory   = true;
          invQuantity    = String(Number(inv.quantity));
          invMinQuantity = String(Number(inv.min_quantity));
          invUnit        = inv.unit ?? 'un';
          invExpiry      = inv.expiry_date ?? '';
          // Prioridade: valores do estoque (sobrepõem o produto)
          priceCost   = inv.cost_price && inv.cost_price > 0
            ? convertPriceFromStorage(inv.cost_price, (inv.cost_currency ?? product.cost_currency ?? currency) as CostCurrencyCode)
            : (product.price_cost ? convertPriceFromStorage(Number(product.price_cost), (product.cost_currency ?? currency) as CostCurrencyCode) : '');
          costCurrency = (inv.cost_currency ?? product.cost_currency ?? currency) as CostCurrencyCode;
        }
      } catch { /* silencioso */ }
    }

    setForm({
      name: product.name,
      categoryId: cat?.id ?? '',
      description: description?.trim() || '',
      price: convertPriceFromStorage(Number(product.price), currency),
      priceCost,
      costCurrency,
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      image_url: product.image_url || '',
      categoryDetail: categoryDetail?.trim() || '',
      subcategoryId: product.subcategory_id ?? null,
      printDest: (product.print_destination ?? cat?.print_destination ?? 'kitchen') as 'kitchen' | 'bar',
      hasInventory,
      invQuantity,
      invMinQuantity,
      invUnit,
      invExpiry,
    });
    setProductRecipeItems([]);
    setRecipeSearch('');
    if (restaurantId) {
      try {
        const { data } = await supabase
          .from('product_ingredients')
          .select('ingredient_id, quantity_per_unit, unit, ingredients(name)')
          .eq('product_id', product.id);
        if (data?.length) {
          setProductRecipeItems(data.map((pi: { ingredient_id: string; quantity_per_unit: number; unit: string; ingredients?: { name: string } | { name: string }[] | null }) => {
            const ing = pi.ingredients;
            const name = Array.isArray(ing) ? ing[0]?.name : ing?.name;
            return {
              ingredient_id: pi.ingredient_id,
              ingredient_name: name ?? '',
              quantity_per_unit: Number(pi.quantity_per_unit),
              unit: pi.unit ?? 'un',
            };
          }));
        }
      } catch { /* silencioso */ }
    }
    setModalOpen(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId) ?? null;
    const isNowCombo = cat?.extra_field === 'detail';
    if (!isNowCombo) setComboItems([]);
    setForm((f) => ({
      ...f,
      categoryId,
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      categoryDetail: cat?.extra_field != null ? f.categoryDetail : '',
      subcategoryId: null,
      printDest: (cat?.print_destination ?? f.printDest) as 'kitchen' | 'bar',
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const name = form.name.trim();
    const formCat = categories.find((c) => c.id === form.categoryId);
    const categoryName = formCat?.name ?? '';
    const price = convertPriceToStorage(form.price, currency);
    if (!name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    if (!form.categoryId || !categoryName) { toast({ title: 'Selecione uma categoria', variant: 'destructive' }); return; }
    if (Number.isNaN(price) || price < 0) { toast({ title: 'Preço inválido', variant: 'destructive' }); return; }
    const cfg = getCategoryConfigFromCategory(formCat ?? null);
    const descriptionFinal = form.categoryDetail.trim()
      ? form.description.trim() ? `${form.categoryDetail.trim()} - ${form.description.trim()}` : form.categoryDetail.trim()
      : form.description.trim() || null;
    setSaving(true);
    try {
      const costCurrency = form.costCurrency;
      const costPrice = form.priceCost.trim() ? convertPriceToStorage(form.priceCost, costCurrency) : null;
      const isCombo = isComboCategory && comboItems.length > 0;
      const payload = {
        restaurant_id: restaurantId,
        name,
        category: categoryName,
        description: descriptionFinal,
        price,
        price_cost: costPrice,
        cost_currency: costPrice != null ? costCurrency : null,
        is_pizza: cfg.isPizza,
        is_marmita: cfg.isMarmita,
        is_combo: isCombo,
        image_url: form.image_url.trim() || null,
        is_active: true,
        subcategory_id: form.subcategoryId || null,
        print_destination: form.printDest,
      };
      let savedProductId = editingProduct?.id ?? '';

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        toast({ title: 'Produto atualizado!' });
      } else {
        const { data: nextOrder } = await supabase.rpc('get_next_product_order_index', { p_restaurant_id: restaurantId, p_category: categoryName });
        const { data: newProd, error } = await supabase
          .from('products')
          .insert({ ...payload, order_index: nextOrder ?? 0 })
          .select('id')
          .single();
        if (error) throw error;
        savedProductId = newProd?.id ?? '';
        toast({ title: 'Produto adicionado ao cardápio!' });
      }

      // Salvar sugestões de upsell
      if (savedProductId) {
        await saveUpsellsMutation.mutateAsync({ productId: savedProductId, upsellIds: selectedUpsellIds });
      }

      // Salvar itens do combo
      if (savedProductId && isCombo && comboItems.length > 0) {
        await supabase.from('product_combo_items').delete().eq('combo_product_id', savedProductId);
        await supabase.from('product_combo_items').insert(
          comboItems.map((ci, i) => ({ combo_product_id: savedProductId, product_id: ci.product_id, quantity: ci.quantity, sort_order: i }))
        );
      } else if (savedProductId && (editingProduct?.is_combo || isCombo) && comboItems.length === 0) {
        await supabase.from('product_combo_items').delete().eq('combo_product_id', savedProductId);
      }

      // Adicionais do produto (sempre salva para garantir sincronia, inclusive ao limpar)
      if (savedProductId) {
        const addonGroups = addonSectionRef.current?.getGroups() ?? [];
        const groupsToSave = addonGroups
          .filter((g) => g.name.trim())
          .map((g) => ({
            name: g.name.trim(),
            order_index: g.order_index,
            items: g.items
              .filter((it) => it.name.trim())
              .map((it) => ({
                name: it.name.trim(),
                price: it.price,
                cost: it.cost,
                cost_currency: it.cost_currency,
                in_stock: it.in_stock,
                ingredient_id: it.ingredient_id || null,
                order_index: it.order_index,
              })),
          }))
          .filter((g) => g.items.length > 0);
        await saveAddonsMutation.mutateAsync({ productId: savedProductId, groups: groupsToSave });
      }

      // Receita de ingredientes (para CMV preciso no BI)
      if (savedProductId) {
        await supabase.from('product_ingredients').delete().eq('product_id', savedProductId);
        if (productRecipeItems.length > 0) {
          await supabase.from('product_ingredients').insert(
            productRecipeItems.map((ri) => ({
              product_id: savedProductId,
              ingredient_id: ri.ingredient_id,
              quantity_per_unit: ri.quantity_per_unit,
              unit: ri.unit,
            }))
          );
        }
      }

      // Upsert de estoque por produto (independente da categoria) — sincroniza custo e venda
      if (form.hasInventory && savedProductId) {
        const invQty    = parseFloat((form.invQuantity || '0').replace(',', '.')) || 0;
        const invMinQty = parseFloat((form.invMinQuantity || '5').replace(',', '.')) || 0;
        const costCur   = form.costCurrency;
        const costVal   = form.priceCost.trim() ? convertPriceToStorage(form.priceCost, costCur) : 0;
        const saleVal   = price; // preço de venda do produto
        await supabase.from('inventory_items').upsert({
          restaurant_id: restaurantId,
          product_id:    savedProductId,
          quantity:      invQty,
          min_quantity:  invMinQty,
          unit:          form.invUnit || 'un',
          cost_price:    costVal,
          cost_currency: costVal > 0 ? costCur : null,
          sale_price:    saleVal,
          expiry_date:   form.invExpiry || null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'restaurant_id,product_id' });
      } else if (!form.hasInventory && savedProductId && editingProduct) {
        // Se desativou estoque em produto que tinha, remove o item de estoque
        await supabase.from('inventory_items')
          .delete()
          .eq('product_id', savedProductId)
          .eq('restaurant_id', restaurantId);
      }

      setModalOpen(false);
      loadProducts();
      loadCategoriesAndSubcategories();
    } catch (error) {
      toast({ title: 'Erro ao salvar produto', description: error instanceof Error ? error.message : 'Verifique as permissões.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('products').update({ is_active: !isActive }).eq('id', productId);
      if (error) throw error;
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, is_active: !isActive } : p));
    } catch (e) { console.error(e); }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (e) { console.error(e); }
  };

  const duplicateProduct = async (product: Product) => {
    if (!restaurantId) return;
    try {
      const { data: nextOrder } = await supabase.rpc('get_next_product_order_index', { p_restaurant_id: restaurantId, p_category: product.category });
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert({
          restaurant_id: product.restaurant_id, category: product.category, subcategory_id: product.subcategory_id ?? null,
          name: `${product.name} (Cópia)`, description: product.description ?? null, price: product.price,
          price_sale: product.price_sale ?? null, price_cost: product.price_cost ?? null, cost_currency: product.cost_currency ?? null, image_url: product.image_url ?? null,
          is_pizza: product.is_pizza, is_marmita: product.is_marmita ?? false, is_active: product.is_active, order_index: nextOrder ?? 0,
        })
        .select('*').single();
      if (error) throw error;
      setProducts((prev) => [...prev, { ...newProduct, order_index: nextOrder ?? 0 }].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      }));
      toast({ title: 'Produto duplicado!', description: `${newProduct.name} adicionado.` });
      openEdit(newProduct);
    } catch (err) {
      toast({ title: 'Erro ao duplicar produto', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ─── Category CRUD ────────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    const name = categoryFormName.trim();
    if (!name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    if (categories.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Já existe uma categoria com esse nome', variant: 'destructive' }); return;
    }
    const preset = CATEGORY_TYPES.find((t) => t.id === categoryFormType) || CATEGORY_TYPES[0];
    try {
      const { error } = await supabase.from('categories').insert({
        restaurant_id: restaurantId, name, order_index: categories.length,
        is_pizza: preset.is_pizza, is_marmita: preset.is_marmita,
        has_inventory: categoryFormInventory,
        print_destination: categoryFormDest,
        extra_field: preset.extra_field, extra_label: preset.extra_label, extra_placeholder: preset.extra_placeholder,
      });
      if (error) throw error;
      setShowCategoryModal(false);
      setCategoryFormName('');
      setCategoryFormType(CATEGORY_TYPES[0].id);
      setCategoryFormInventory(false);
      setCategoryFormDest('kitchen');
      await loadCategoriesAndSubcategories();
      toast({ title: 'Categoria adicionada!' });
    } catch (e) { toast({ title: 'Erro ao adicionar categoria', variant: 'destructive' }); }
  };

  const handleDeleteCategory = async (category: Category) => {
    const { data: productsInCat } = await supabase.from('products').select('id').eq('restaurant_id', restaurantId!).eq('category', category.name).limit(1);
    const hasProducts = (productsInCat?.length ?? 0) > 0;
    const fallback = categories.find((c) => c.id !== category.id && c.name === 'Outros') || categories.find((c) => c.id !== category.id);
    const targetCategory = fallback?.name ?? 'Outros';
    const message = hasProducts
      ? `Existem produtos em "${category.name}". Eles serão movidos para "${targetCategory}". Deseja continuar?`
      : `Remover a categoria "${category.name}"?`;
    if (!confirm(message)) return;
    try {
      if (hasProducts) {
        await supabase.from('products').update({ category: targetCategory, subcategory_id: null }).eq('restaurant_id', restaurantId!).eq('category', category.name);
      }
      await supabase.from('categories').delete().eq('id', category.id).eq('restaurant_id', restaurantId!);
      if (selectedCategoryId === category.id) setSelectedCategoryId(null);
      await loadCategoriesAndSubcategories();
      await loadProducts();
      toast({ title: 'Categoria removida!' });
    } catch (e) { toast({ title: 'Erro ao remover categoria', variant: 'destructive' }); }
  };

  // ─── Slug ─────────────────────────────────────────────────────────────────────

  const handleSaveSlug = async () => {
    if (!restaurantId) return;
    const slugNormalized = generateSlug(slug) || generateSlug(restaurant?.name || '');
    if (!slugNormalized) { toast({ title: 'Slug inválido', variant: 'destructive' }); return; }
    setSlugSaving(true);
    try {
      const { error } = await supabase.from('restaurants').update({ slug: slugNormalized }).eq('id', restaurantId);
      if (error) throw error;
      setSlug(slugNormalized);
      toast({ title: 'Slug salvo com sucesso!' });
    } catch { toast({ title: 'Erro ao salvar slug', variant: 'destructive' }); }
    finally { setSlugSaving(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Central do Cardápio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalProducts} produto{totalProducts !== 1 ? 's' : ''} · {activeProducts} ativo{activeProducts !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search — desktop-first, campo mais largo */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9 h-9 w-44 min-[900px]:w-64 text-sm"
            />
          </div>

          {/* Inventory toggle */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none ${showInventory ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
            onClick={() => setShowInventory((v) => !v)}
          >
            {showInventory ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Ver Custos</span>
            <div onClick={(e) => e.stopPropagation()} className="ml-0.5">
              <Switch checked={showInventory} onCheckedChange={setShowInventory} className="h-4 w-7" />
            </div>
          </div>

          {/* Gestão de Ofertas */}
          <Button variant="outline" size="sm" asChild className="h-8 gap-1.5">
            <Link to={basePath ? `${basePath}/offers` : '#'}>
              <Tag className="h-3.5 w-3.5 text-orange-500" />
              <span className="hidden sm:inline">Gestão de Ofertas</span>
            </Link>
          </Button>

          {/* Online */}
          <Button variant="outline" size="sm" onClick={() => setShowOnlineModal(true)} className="h-8 gap-1.5">
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cardápio Online</span>
          </Button>

          {/* New product */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={{ duration: 0.15 }} className="inline-flex">
            <Button size="sm" onClick={() => openNew()} className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Novo Produto
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Two-column master-detail layout (desktop-first) ───────────────────── */}
      <div className="flex gap-5 xl:gap-6 items-start min-h-[520px]">

        {/* ── Left: Category Sidebar ──────────────────────────────────────────── */}
        <div className="w-60 xl:w-72 flex-shrink-0">
          <Card className="dark:bg-slate-900 sticky top-4 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categorias</CardTitle>
                {savingCategoryOrder && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-4 space-y-1">

              {/* "Todas" */}
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategoryId === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/70 text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">Todas</span>
                <Badge
                  variant={selectedCategoryId === null ? 'secondary' : 'outline'}
                  className={`text-xs h-4 px-1.5 ${selectedCategoryId === null ? 'bg-primary-foreground/20 text-primary-foreground border-0' : ''}`}
                >
                  {totalProducts}
                </Badge>
              </button>

              {/* Category list with DnD */}
              {loading ? (
                <div className="py-3 flex justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                  Nenhuma categoria ainda.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                  <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {categories.map((cat) => (
                      <SortableCategoryItem
                        key={cat.id}
                        category={cat}
                        count={products.filter((p) => p.category === cat.name).length}
                        isSelected={selectedCategoryId === cat.id}
                        onSelect={() => setSelectedCategoryId(cat.id)}
                        onDelete={() => handleDeleteCategory(cat)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Add category */}
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-1 border border-dashed border-border/60 hover:border-border"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>Nova Categoria</span>
              </button>

            </CardContent>
          </Card>
        </div>

        {/* ── Right: Products panel ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Panel header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {selectedCategory ? selectedCategory.name : 'Todos os Produtos'}
              </h2>
              {selectedCategory?.is_pizza && <Badge variant="secondary" className="text-xs">Pizza</Badge>}
              {selectedCategory?.is_marmita && <Badge variant="secondary" className="text-xs">Marmita</Badge>}
              <Badge variant="outline" className="text-xs">{filteredProducts.length}</Badge>
            </div>
            {selectedCategory && (
              <Button size="sm" variant="outline" onClick={() => openNew(selectedCategory.id)} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Produto nesta categoria
              </Button>
            )}
          </div>

          {/* Inventory mode info banner */}
          <AnimatePresence>
            {showInventory && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 overflow-hidden"
              >
                <BarChart2 className="h-3.5 w-3.5 shrink-0" />
                <span>Modo inventário ativado — exibindo custo e margem de lucro. Margem: <strong className="text-emerald-700">≥40% verde</strong>, <strong className="text-amber-600">20–40% amarelo</strong>, <strong className="text-red-600">&lt;20% vermelho</strong>.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading skeleton */}
          {loading ? (
            <Card className="dark:bg-slate-900">
              <CardContent className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
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
          ) : filteredProducts.length === 0 ? (
            <Card className="dark:bg-slate-900">
              <CardContent className="p-16 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">
                    {productSearch ? 'Nenhum produto encontrado' : 'Nenhum produto aqui ainda'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {productSearch
                      ? `Sem resultados para "${productSearch}"`
                      : 'Crie o primeiro produto desta categoria.'}
                  </p>
                </div>
                {!productSearch && (
                  <Button onClick={() => openNew(selectedCategoryId ?? undefined)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategoryId || 'all'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                className="space-y-5"
              >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductsDragEnd}>
                  {sortedCategoryNames.map((categoryName) => {
                    const catProducts = groupedProducts[categoryName] ?? [];
                    return (
                      <div key={categoryName} className="space-y-2">
                        {/* Show category header only in "All" mode */}
                        {!selectedCategoryId && (
                          <div className="flex items-center gap-2 px-1.5 py-1">
                            <span className="text-sm font-semibold text-foreground">{categoryName}</span>
                            <Badge variant="outline" className="text-xs">{catProducts.length}</Badge>
                          </div>
                        )}
                        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="w-8" />
                                <TableHead className="w-10" />
                                <TableHead>Nome</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Preço Venda</TableHead>
                                {showInventory && (
                                  <>
                                    <TableHead className="text-right whitespace-nowrap">Custo</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Margem</TableHead>
                                  </>
                                )}
                                <TableHead className="w-12 text-center">Ativo</TableHead>
                                <TableHead className="w-[120px] text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <SortableContext items={catProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                                {catProducts.map((product) => (
                                  <CentralProductRow
                                    key={product.id}
                                    product={product}
                                    currency={currency}
                                    exchangeRates={exchangeRates}
                                    showInventory={showInventory}
                                    onEdit={openEdit}
                                    onDuplicate={duplicateProduct}
                                    onDelete={deleteProduct}
                                    onToggleActive={toggleProductStatus}
                                    offersBasePath={basePath ? `${basePath}/offers` : undefined}
                                  />
                                ))}
                              </SortableContext>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </DndContext>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ── Product Form Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border sticky top-0 bg-background z-10">
            <div>
              <DialogTitle className="text-lg font-semibold">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
              {editingProduct && (
                <p className="text-xs text-muted-foreground mt-0.5">{editingProduct.category}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProduct} className="px-6 pb-6 space-y-5 pt-5">

            {/* ── BLOCO 1: Imagem + Identidade ── */}
            <div className="flex gap-4 items-start">
              {/* Image upload — compacto à esquerda */}
              <div className="flex-shrink-0">
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" className="sr-only" disabled={imageUploading || !restaurantId}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !restaurantId) return;
                      setImageUploading(true);
                      try { const url = await uploadProductImage(restaurantId, file); setForm((f) => ({ ...f, image_url: url })); toast({ title: 'Imagem enviada!' }); }
                      catch (err) { toast({ title: 'Erro ao enviar imagem', description: err instanceof Error ? err.message : 'Tente outro arquivo.', variant: 'destructive' }); }
                      finally { setImageUploading(false); e.target.value = ''; }
                    }}
                  />
                  <div className={`relative w-24 h-24 rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all ${
                    form.image_url
                      ? 'border-border hover:border-primary/40'
                      : 'border-dashed border-border hover:border-primary/50 bg-muted/40 hover:bg-muted/70'
                  }`}>
                    {imageUploading ? (
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-[10px] text-muted-foreground">Enviando…</span>
                      </div>
                    ) : form.image_url ? (
                      <>
                        <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="h-5 w-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center leading-tight">Foto do<br/>produto</span>
                      </div>
                    )}
                  </div>
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    className="mt-1 w-full text-[10px] text-muted-foreground hover:text-destructive transition-colors text-center"
                  >
                    Remover
                  </button>
                )}
              </div>

              {/* Nome, Categoria, Subcategoria */}
              <div className="flex-1 space-y-3 min-w-0">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome *</Label>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={categoryConfig.isPizza ? 'Ex: Margherita, Calabresa' : 'Ex: nome do produto'}
                    required
                    className="h-10 text-base font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria *</Label>
                    <Select value={form.categoryId} onValueChange={handleCategoryChange} required>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={categories.length ? 'Selecione' : 'Crie uma categoria'} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}{cat.is_pizza && ' (pizza)'}{cat.is_marmita && ' (marmita)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {subcategoriesOfSelected.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subcategoria</Label>
                      <Select value={form.subcategoryId ?? 'none'} onValueChange={(v) => setForm((f) => ({ ...f, subcategoryId: v === 'none' ? null : v }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {subcategoriesOfSelected.map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider invisible">_</Label>
                      {/* URL da imagem como fallback */}
                      <Input
                        type="url"
                        value={form.image_url}
                        onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                        placeholder="Ou cole URL da foto"
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Combo Builder (categoria Combos) */}
            {isComboCategory && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/20">
                  <Boxes className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Composição do Combo</span>
                  <span className="text-xs text-muted-foreground">— selecione os produtos incluídos</span>
                </div>
                <div className="p-4 space-y-3">
                  {comboItems.length > 0 && (
                    <div className="space-y-2">
                      {comboItems.map((ci, idx) => (
                        <div key={ci.product_id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                          {ci.product.image_url ? (
                            <img src={ci.product.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <span className="flex-1 text-sm font-medium truncate">{ci.product.name}</span>
                          <div className="flex items-center gap-1">
                            <Input type="number" min={0.5} step={0.5} value={ci.quantity}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 1;
                                setComboItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(0.5, v) } : p));
                              }}
                              className="w-14 h-8 text-center text-sm" />
                            <button type="button" onClick={() => setComboItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Preço sugerido: {formatCurrency(comboItems.reduce((s, ci) => s + (Number(ci.product.price_sale || ci.product.price) || 0) * ci.quantity, 0), currency)}
                        <button type="button" className="ml-2 text-primary font-medium hover:underline"
                          onClick={() => {
                            const sum = comboItems.reduce((s, ci) => s + (Number(ci.product.price_sale || ci.product.price) || 0) * ci.quantity, 0);
                            setForm((f) => ({ ...f, price: convertPriceFromStorage(sum, currency) }));
                          }}>
                          Aplicar ao preço
                        </button>
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={comboSearch} onChange={(e) => setComboSearch(e.target.value)}
                        placeholder="Buscar produto para incluir no combo..."
                        className="pl-8 h-9" />
                    </div>
                    {comboSearch.trim() && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border/60">
                        {products
                          .filter((p) => p.is_active && p.id !== editingProduct?.id && !comboItems.some((c) => c.product_id === p.id) &&
                            (p.name.toLowerCase().includes(comboSearch.toLowerCase()) || p.category.toLowerCase().includes(comboSearch.toLowerCase())))
                          .slice(0, 10)
                          .map((p) => (
                            <button key={p.id} type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                              onClick={() => {
                                setComboItems((prev) => [...prev, { product_id: p.id, product: p, quantity: 1 }]);
                                setComboSearch('');
                              }}>
                              {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4" /></div>}
                              <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{formatCurrency(Number(p.price_sale || p.price), currency)}</span>
                              <Plus className="h-4 w-4 text-primary" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Adicionais do produto */}
            <ProductAddonsSection
              ref={addonSectionRef}
              addons={addons}
              currency={currency}
              costCurrency={form.costCurrency}
              ingredients={ingredients}
            />

            {/* Extra field (não-Combo) se categoria tiver */}
            {categoryConfig.extraField && !isComboCategory && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{categoryConfig.extraLabel}</Label>
                <Input value={form.categoryDetail} onChange={(e) => setForm((f) => ({ ...f, categoryDetail: e.target.value }))}
                  placeholder={categoryConfig.extraPlaceholder} />
              </div>
            )}

            {/* ── BLOCO 2: Descrição ── */}
            <div className="space-y-1.5">
              <Label htmlFor="p-desc" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={categoryConfig.isPizza ? 'Ex: Molho de tomate, mussarela e manjericão' : 'Descrição opcional — aparece no cardápio público'}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* ── BLOCO 3: Precificação ── */}
            {(() => {
              const saleVal = convertPriceToStorage(form.price, currency);
              const costVal = form.priceCost.trim() ? convertPriceToStorage(form.priceCost, form.costCurrency) : null;
              const costValInBase = costVal != null && form.costCurrency !== currency
                ? convertBetweenCurrencies(costVal, form.costCurrency, currency, exchangeRates)
                : costVal;
              const margin = costValInBase != null && !isNaN(costValInBase) && saleVal > 0
                ? ((saleVal - costValInBase) / saleVal) * 100
                : null;
              const marginColor = margin === null ? 'text-muted-foreground'
                : margin >= 40 ? 'text-emerald-600 dark:text-emerald-400'
                : margin >= 20 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              const marginBg = margin === null ? 'bg-muted/40'
                : margin >= 40 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                : margin >= 20 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';

              return (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Precificação
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Preço de venda */}
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="p-price" className="text-xs text-muted-foreground">
                        {categoryConfig.priceLabel || 'Preço de venda'} ({getCurrencySymbol(currency)}) *
                      </Label>
                      <Input
                        id="p-price"
                        type="text"
                        inputMode="decimal"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))}
                        placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                        required
                        className="font-semibold tabular-nums"
                      />
                    </div>

                    {/* Custo */}
                    <div className="space-y-1.5 col-span-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="p-cost" className="text-xs text-muted-foreground">
                          Custo ({getCurrencySymbol(form.costCurrency)})
                        </Label>
                        <Select
                          value={form.costCurrency}
                          onValueChange={(v) => setForm((f) => ({ ...f, costCurrency: v as CostCurrencyCode }))}
                        >
                          <SelectTrigger className="h-7 w-[90px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BRL">R$ Real</SelectItem>
                            <SelectItem value="PYG">Gs. Guaraní</SelectItem>
                            <SelectItem value="ARS">ARS Peso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        id="p-cost"
                        type="text"
                        inputMode="decimal"
                        value={form.priceCost}
                        onChange={(e) => setForm((f) => ({ ...f, priceCost: form.costCurrency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))}
                        placeholder={form.costCurrency === 'PYG' ? '15.000' : '0,00'}
                        className="tabular-nums"
                      />
                    </div>

                    {/* Margem calculada */}
                    <div className="space-y-1.5 col-span-1">
                      <Label className="text-xs text-muted-foreground">Margem de lucro</Label>
                      <div className={`flex items-center justify-center h-10 rounded-lg border font-bold text-lg tabular-nums ${marginBg} ${marginColor}`}>
                        {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  </div>
                  {margin !== null && (
                    <p className={`text-xs font-medium ${marginColor}`}>
                      {margin >= 40 ? '✓ Margem saudável (≥ 40%)' : margin >= 20 ? '⚠ Margem moderada (20–40%)' : '✗ Margem baixa (< 20%)'}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── BLOCO 4: Destino de Impressão por produto ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Printer className="h-3.5 w-3.5" />
                Destino de impressão
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, printDest: 'kitchen' }))}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-all ${
                    form.printDest === 'kitchen'
                      ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-border bg-background hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <ChefHat className="h-4 w-4 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Cozinha Central</div>
                    <div className="text-[11px] opacity-70">Cozinhas e grelhados</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, printDest: 'bar' }))}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-all ${
                    form.printDest === 'bar'
                      ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
                      : 'border-border bg-background hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <Wine className="h-4 w-4 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Garçom / Bar</div>
                    <div className="text-[11px] opacity-70">Bebidas e frios</div>
                  </div>
                </button>
              </div>
            </div>

            {/* ── BLOCO 5: Estoque por produto ── */}
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Toggle header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  form.hasInventory ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => setForm((f) => ({ ...f, hasInventory: !f.hasInventory }))}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={form.hasInventory}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, hasInventory: v }))}
                  />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Boxes className={`h-4 w-4 flex-shrink-0 ${form.hasInventory ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                  <div>
                    <div className={`text-sm font-semibold ${form.hasInventory ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                      Controle de Estoque
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {form.hasInventory ? 'Rastreando quantidade e validade' : 'Ativar para rastrear este produto'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Campos de estoque */}
              <AnimatePresence>
                {form.hasInventory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs text-muted-foreground">Quantidade atual</Label>
                        <div className="flex gap-1.5">
                          <Input
                            type="text" inputMode="decimal"
                            value={form.invQuantity}
                            onChange={(e) => setForm((f) => ({ ...f, invQuantity: e.target.value }))}
                            placeholder="0"
                            className="flex-1"
                          />
                          <Select value={form.invUnit} onValueChange={(v) => setForm((f) => ({ ...f, invUnit: v }))}>
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['un', 'kg', 'g', 'L', 'ml', 'cx', 'pç', 'por'].map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Qtd. mínima</Label>
                        <Input
                          type="text" inputMode="decimal"
                          value={form.invMinQuantity}
                          onChange={(e) => setForm((f) => ({ ...f, invMinQuantity: e.target.value }))}
                          placeholder="5"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Validade</Label>
                        <Input
                          type="date"
                          value={form.invExpiry}
                          onChange={(e) => setForm((f) => ({ ...f, invExpiry: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── BLOCO 5b: Receita de ingredientes (CMV no BI) ── */}
            <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 dark:border-violet-800/70 dark:bg-violet-950/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-200/60 dark:border-violet-800/60">
                <ChefHat className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">Receita (ingredientes)</span>
                <span className="text-xs text-muted-foreground ml-1">— custo real e CMV no Dashboard BI</span>
              </div>
              <div className="p-4 space-y-3">
                {productRecipeItems.length > 0 && (
                  <div className="space-y-2">
                    {productRecipeItems.map((ri) => (
                      <div key={ri.ingredient_id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium truncate flex-1">{ri.ingredient_name}</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="w-16 h-7 text-xs text-center"
                          value={ri.quantity_per_unit}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value.replace(',', '.'));
                            setProductRecipeItems((list) => list.map((x) => x.ingredient_id === ri.ingredient_id ? { ...x, quantity_per_unit: isNaN(v) ? 0 : v } : x));
                          }}
                        />
                        <span className="text-xs text-muted-foreground w-8">{ri.unit}/un.</span>
                        <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setProductRecipeItems((list) => list.filter((x) => x.ingredient_id !== ri.ingredient_id))}>
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} placeholder="Buscar ingrediente para adicionar à receita..." className="pl-8 h-8 text-sm bg-white dark:bg-slate-800" />
                  </div>
                  {recipeSearch.trim() !== '' && (
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-white dark:bg-slate-900 divide-y divide-border/60">
                      {ingredients
                        .filter((i) => !productRecipeItems.some((ri) => ri.ingredient_id === i.id) && i.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                        .slice(0, 6)
                        .map((ing) => (
                          <button
                            key={ing.id}
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left text-sm"
                            onClick={() => {
                              setProductRecipeItems((list) => [...list, { ingredient_id: ing.id, ingredient_name: ing.name, quantity_per_unit: 1, unit: ing.unit }]);
                              setRecipeSearch('');
                            }}
                          >
                            <span>{ing.name}</span>
                            <Plus className="h-3.5 w-3.5 text-violet-500" />
                          </button>
                        ))}
                      {ingredients.filter((i) => !productRecipeItems.some((ri) => ri.ingredient_id === i.id) && i.name.toLowerCase().includes(recipeSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-muted-foreground p-3 text-center">Nenhum ingrediente encontrado. Cadastre em Estoque → Ingredientes.</p>
                      )}
                    </div>
                  )}
                  {recipeSearch.trim() === '' && productRecipeItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">Digite para buscar ingredientes. Quando o produto for vendido, o estoque dos ingredientes será consumido e o CMV será calculado automaticamente.</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── BLOCO 6: Sugestões de Upsell ── */}
            {(() => {
              const upsellCandidates = products.filter(
                (p) =>
                  p.is_active &&
                  p.id !== editingProduct?.id &&
                  !selectedUpsellIds.includes(p.id) &&
                  (upsellSearch.trim() === '' ||
                    p.name.toLowerCase().includes(upsellSearch.toLowerCase()) ||
                    p.category.toLowerCase().includes(upsellSearch.toLowerCase()))
              );
              const selectedUpsellProducts = products.filter((p) => selectedUpsellIds.includes(p.id));
              return (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200/60 dark:border-amber-800/60">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Sugestões de Upsell</span>
                    <span className="text-xs text-muted-foreground ml-1">— até 3 produtos complementares</span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Produtos selecionados */}
                    {selectedUpsellProducts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedUpsellProducts.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1 text-xs shadow-sm">
                            {p.image_url
                              ? <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                              : <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">🍽</span>
                            }
                            <span className="font-medium text-foreground max-w-[120px] truncate">{p.name}</span>
                            <button type="button" className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                              onClick={() => setSelectedUpsellIds((ids) => ids.filter((id) => id !== p.id))}>
                              <XIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedUpsellIds.length < 3 && (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                          <Input value={upsellSearch} onChange={(e) => setUpsellSearch(e.target.value)}
                            placeholder="Buscar produto para sugerir..."
                            className="pl-8 h-8 text-sm bg-white dark:bg-slate-800"
                          />
                        </div>
                        {upsellSearch.trim() !== '' && (
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white dark:bg-slate-900 divide-y divide-border/60 shadow-sm">
                            {upsellCandidates.length === 0
                              ? <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                              : upsellCandidates.slice(0, 8).map((p) => (
                                <button key={p.id} type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                                  onClick={() => { setSelectedUpsellIds((ids) => ids.length < 3 ? [...ids, p.id] : ids); setUpsellSearch(''); }}>
                                  {p.image_url
                                    ? <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                    : <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">🍽</div>
                                  }
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{p.category}</p>
                                  </div>
                                  <Plus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                </button>
                              ))
                            }
                          </div>
                        )}
                        {upsellSearch.trim() === '' && selectedUpsellIds.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Digite para buscar produtos que aparecerão como sugestão no carrinho.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[160px]">
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</>
                  : editingProduct ? 'Salvar Alterações' : 'Adicionar ao Cardápio'
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── New Category Modal ──────────────────────────────────────────────── */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da categoria</Label>
              <Input placeholder="Ex: Pizza, Bebidas, Sobremesas" value={categoryFormName} onChange={(e) => setCategoryFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
            </div>
            <div className="space-y-2">
              <Label>Tipo / Comportamento</Label>
              <Select value={categoryFormType} onValueChange={setCategoryFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Destino de Impressão */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Destino de Impressão
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryFormDest('kitchen')}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    categoryFormDest === 'kitchen'
                      ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-border hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <ChefHat className="h-4 w-4 flex-shrink-0" />
                  <span>Cozinha Central</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFormDest('bar')}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    categoryFormDest === 'bar'
                      ? 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
                      : 'border-border hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <Wine className="h-4 w-4 flex-shrink-0" />
                  <span>Garçom / Bar</span>
                </button>
              </div>
            </div>

            {/* Toggle de estoque */}
            <div className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors cursor-pointer ${categoryFormInventory ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'}`}
              onClick={() => setCategoryFormInventory((v) => !v)}>
              <Switch checked={categoryFormInventory} onCheckedChange={setCategoryFormInventory} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">Controle de Estoque</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ativa o gerenciamento de quantidade, custo e validade para os produtos desta categoria.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancelar</Button>
            <Button onClick={handleAddCategory} disabled={!categoryFormName.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cardápio Online Modal ───────────────────────────────────────────── */}
      <Dialog open={showOnlineModal} onOpenChange={setShowOnlineModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cardápio Online</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço do cardápio</CardTitle>
                <p className="text-sm text-muted-foreground">Defina o slug único que aparece no URL do seu cardápio.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                      placeholder="ex: minha-pizzaria" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas, números e hífens.</p>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleSaveSlug} disabled={slugSaving}>
                      {slugSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Salvar
                    </Button>
                  </div>
                </div>

                {(slug || restaurant?.slug) && (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Label className="text-sm font-medium">Cardápio interativo</Label>
                        <Badge variant="secondary" className="text-xs">Pedidos habilitados</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input readOnly value={getCardapioPublicUrl(slug || restaurant?.slug || '')} className="flex-1 text-sm bg-muted/30" />
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          const url = getCardapioPublicUrl(slug || restaurant?.slug || '');
                          navigator.clipboard.writeText(url).then(() => { setLinkCopied(true); toast({ title: 'Link copiado!' }); setTimeout(() => setLinkCopied(false), 2000); });
                        }}>
                          {linkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {linkCopied ? 'Copiado!' : 'Copiar'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => window.open(getCardapioPublicUrl(slug || restaurant?.slug || ''), '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Label className="text-sm font-medium">Somente leitura</Label>
                        <Badge variant="outline" className="text-xs">Sem pedidos</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input readOnly value={`${getCardapioPublicUrl(slug || restaurant?.slug || '')}/menu`} className="flex-1 text-sm bg-muted/30" />
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          const url = `${getCardapioPublicUrl(slug || restaurant?.slug || '')}/menu`;
                          navigator.clipboard.writeText(url).then(() => { setMenuLinkCopied(true); toast({ title: 'Link copiado!' }); setTimeout(() => setMenuLinkCopied(false), 2000); });
                        }}>
                          {menuLinkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {menuLinkCopied ? 'Copiado!' : 'Copiar'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => window.open(`${getCardapioPublicUrl(slug || restaurant?.slug || '')}/menu`, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <MenuQRCodeCard slug={slug || restaurant?.slug || ''} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnlineModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
