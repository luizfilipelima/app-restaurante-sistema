import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import {
  convertPriceToStorage,
  convertPriceFromStorage,
  formatPriceInputPyG,
  getCurrencySymbol,
  formatPrice,
} from '@/lib/priceHelper';
import {
  Product,
  Restaurant,
  PizzaSize,
  PizzaDough,
  PizzaEdge,
  MarmitaSize,
  MarmitaProtein,
  MarmitaSide,
  Category,
  Subcategory,
} from '@/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Info,
  Upload,
  Copy,
  Check,
  Search,
  UtensilsCrossed,
  LayoutGrid,
  Settings,
  QrCode,
  GripVertical,
  Edit,
  Package,
  Pizza,
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
} from 'lucide-react';
import MenuQRCodeCard from '@/components/admin/MenuQRCodeCard';
import { useProductUpsells, useSaveProductUpsells } from '@/hooks/queries';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_TYPES = [
  { id: 'default', label: 'Padrão', is_pizza: false, is_marmita: false, extra_field: null, extra_label: null, extra_placeholder: null },
  { id: 'pizza', label: 'Pizza (tamanhos e sabores)', is_pizza: true, is_marmita: false, extra_field: null, extra_label: null, extra_placeholder: null },
  { id: 'marmita', label: 'Marmitas (monte sua marmita)', is_pizza: false, is_marmita: true, extra_field: null, extra_label: null, extra_placeholder: null },
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

const formDefaults = {
  name: '',
  categoryId: '' as string,
  description: '',
  price: '',
  is_pizza: false,
  is_marmita: false,
  image_url: '',
  categoryDetail: '',
  subcategoryId: '' as string | null,
  // Campos de estoque (visíveis quando categoria tem has_inventory = true)
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
  onToggleInventory: (id: string, current: boolean) => void;
  onChangeDest: (id: string, dest: 'kitchen' | 'bar') => void;
}

function SortableCategoryItem({ category, count, isSelected, onSelect, onDelete, onToggleInventory, onChangeDest }: SortableCategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };
  const dest = category.print_destination ?? 'kitchen';
  const isBar = dest === 'bar';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border transition-all ${
        isSelected
          ? 'bg-primary border-primary shadow-sm'
          : 'bg-background border-border hover:border-primary/40 hover:bg-muted/40'
      } ${isDragging ? 'shadow-lg z-50' : ''}`}
    >
      {/* Linha principal: drag + seleção */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {/* Handle de drag — sempre visível como alça sutil */}
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing touch-none p-1 rounded transition-colors ${
            isSelected ? 'text-primary-foreground/50 hover:text-primary-foreground/80' : 'text-muted-foreground/30 hover:text-muted-foreground/70'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Botão principal de seleção */}
        <button
          type="button"
          className="flex-1 flex items-center gap-2 text-left min-w-0"
          onClick={onSelect}
        >
          {/* Ícone de tipo */}
          <span className={`flex-shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
            {category.is_pizza ? (
              <Pizza className="h-3.5 w-3.5" />
            ) : category.is_marmita ? (
              <UtensilsCrossed className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isSelected ? 'rotate-90 text-primary-foreground' : ''}`} />
            )}
          </span>

          {/* Nome */}
          <span className={`truncate text-sm font-semibold flex-1 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
            {category.name}
          </span>

          {/* Contagem */}
          <span className={`flex-shrink-0 text-xs font-bold min-w-[1.25rem] text-center ${
            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
          }`}>
            {count}
          </span>
        </button>
      </div>

      {/* Linha de meta: badges de destino + estoque + ações */}
      <div className={`flex items-center gap-1.5 px-2 pb-1.5 border-t ${isSelected ? 'border-primary-foreground/20' : 'border-border/60'}`}>
        {/* Badge destino de impressão — clicável para alternar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChangeDest(category.id, isBar ? 'kitchen' : 'bar');
          }}
          title={isBar ? 'Destino: Garçom/Bar — clique para mudar para Cozinha' : 'Destino: Cozinha — clique para mudar para Bar'}
          className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
            isBar
              ? isSelected ? 'bg-orange-300/30 text-orange-200 hover:bg-orange-300/50' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : isSelected ? 'bg-blue-300/30 text-blue-200 hover:bg-blue-300/50' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          <Printer className="h-2.5 w-2.5" />
          {isBar ? 'Bar' : 'Cozinha'}
        </button>

        {/* Badge estoque — clicável para alternar */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleInventory(category.id, !!category.has_inventory); }}
          title={category.has_inventory ? 'Estoque ativo — clique para desativar' : 'Ativar controle de estoque'}
          className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
            category.has_inventory
              ? isSelected ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : isSelected ? 'bg-primary-foreground/10 text-primary-foreground/40 hover:bg-primary-foreground/20' : 'bg-muted/60 text-muted-foreground/60 hover:bg-muted'
          }`}
        >
          <Boxes className="h-2.5 w-2.5" />
          Estoque
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Botão excluir */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`p-0.5 rounded transition-colors ${
            isSelected
              ? 'text-primary-foreground/40 hover:text-primary-foreground'
              : 'text-muted-foreground/40 hover:text-destructive'
          }`}
          title="Excluir categoria"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Inline product row for the central view ──────────────────────────────────

interface CentralProductRowProps {
  product: Product;
  currency: ReturnType<typeof useAdminCurrency>;
  showInventory: boolean;
  onEdit: (p: Product) => void;
  onDuplicate: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

function CentralProductRow({ product, currency, showInventory, onEdit, onDuplicate, onDelete, onToggleActive }: CentralProductRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  const salePrice = Number(product.price_sale || product.price);
  const costPrice = product.price_cost ? Number(product.price_cost) : null;
  const margin = costPrice && salePrice > 0 ? ((salePrice - costPrice) / salePrice) * 100 : null;

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
              {product.is_pizza ? <Pizza className="h-4 w-4" /> : product.is_marmita ? <UtensilsCrossed className="h-4 w-4" /> : '🍽'}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{product.name}</div>
        {product.description && (
          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</div>
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap font-medium tabular-nums text-sm">
        {formatPrice(salePrice, currency)}
      </TableCell>

      {showInventory && (
        <>
          <TableCell className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
            {costPrice ? formatPrice(costPrice, currency) : <span className="text-muted-foreground/50">—</span>}
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

      <TableCell className="w-[120px] p-1.5">
        <div className="flex items-center gap-0.5">
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
  const currency = useAdminCurrency();

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

  // Config modal (Pizza / Marmita)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [menuConfigLoading, setMenuConfigLoading] = useState(false);

  // QR / Online modal
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuLinkCopied, setMenuLinkCopied] = useState(false);

  // Pizza config
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaDoughs, setPizzaDoughs] = useState<PizzaDough[]>([]);
  const [pizzaEdges, setPizzaEdges] = useState<PizzaEdge[]>([]);
  const [showFormSize, setShowFormSize] = useState(false);
  const [showFormDough, setShowFormDough] = useState(false);
  const [showFormEdge, setShowFormEdge] = useState(false);
  const [formSize, setFormSize] = useState({ name: '', max_flavors: 1, price_multiplier: 1, order_index: 0 });
  const [formDough, setFormDough] = useState({ name: '', extra_price: '' });
  const [formEdge, setFormEdge] = useState({ name: '', price: '' });

  // Marmita config
  const [marmitaSizes, setMarmitaSizes] = useState<MarmitaSize[]>([]);
  const [marmitaProteins, setMarmitaProteins] = useState<MarmitaProtein[]>([]);
  const [marmitaSides, setMarmitaSides] = useState<MarmitaSide[]>([]);
  const [showFormMarmitaSize, setShowFormMarmitaSize] = useState(false);
  const [showFormMarmitaProtein, setShowFormMarmitaProtein] = useState(false);
  const [showFormMarmitaSide, setShowFormMarmitaSide] = useState(false);
  const [formMarmitaSize, setFormMarmitaSize] = useState({ name: '', weight_grams: 500, base_price: '', price_per_gram: '', order_index: 0 });
  const [formMarmitaProtein, setFormMarmitaProtein] = useState({ name: '', description: '', price_per_gram: '' });
  const [formMarmitaSide, setFormMarmitaSide] = useState({ name: '', description: '', price_per_gram: '', category: '' });

  // Upsell
  const [upsellSearch, setUpsellSearch] = useState('');
  const [selectedUpsellIds, setSelectedUpsellIds] = useState<string[]>([]);
  const { data: existingUpsells } = useProductUpsells(editingProduct?.id ?? null);
  const saveUpsellsMutation = useSaveProductUpsells(restaurantId);

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
    setMenuConfigLoading(true);
    try {
      const [sizesRes, doughsRes, edgesRes, marmitaSizesRes, marmitaProteinsRes, marmitaSidesRes] = await Promise.all([
        supabase.from('pizza_sizes').select('*').eq('restaurant_id', restaurantId).order('order_index'),
        supabase.from('pizza_doughs').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.from('pizza_edges').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.from('marmita_sizes').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('order_index'),
        supabase.from('marmita_proteins').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('name'),
        supabase.from('marmita_sides').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('category', { ascending: true }).order('name'),
      ]);
      if (sizesRes.data) setPizzaSizes(sizesRes.data);
      if (doughsRes.data) setPizzaDoughs(doughsRes.data);
      if (edgesRes.data) setPizzaEdges(edgesRes.data);
      if (marmitaSizesRes.data) setMarmitaSizes(marmitaSizesRes.data);
      if (marmitaProteinsRes.data) setMarmitaProteins(marmitaProteinsRes.data);
      if (marmitaSidesRes.data) setMarmitaSides(marmitaSidesRes.data);
    } catch (e) { console.error('Erro ao carregar config:', e); }
    finally { setMenuConfigLoading(false); }
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
    setEditingProduct(null);
    const catId = preselectedCategoryId || selectedCategoryId || categories[0]?.id || '';
    const cat = categories.find((c) => c.id === catId);
    setForm({ ...formDefaults, categoryId: catId, is_pizza: cat?.is_pizza ?? false, is_marmita: cat?.is_marmita ?? false, subcategoryId: null });
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

    // Valores base
    let invQuantity = '';
    let invMinQuantity = '5';
    let invUnit = 'un';
    let invExpiry = '';

    // Se a categoria tem estoque, carrega dados do item de estoque
    if (cat?.has_inventory && restaurantId) {
      try {
        const { data: inv } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('product_id', product.id)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        if (inv) {
          invQuantity    = String(Number(inv.quantity));
          invMinQuantity = String(Number(inv.min_quantity));
          invUnit        = inv.unit ?? 'un';
          invExpiry      = inv.expiry_date ?? '';
        }
      } catch { /* silencioso — campos ficam vazios */ }
    }

    setForm({
      name: product.name,
      categoryId: cat?.id ?? '',
      description: description?.trim() || '',
      price: convertPriceFromStorage(Number(product.price), currency),
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      image_url: product.image_url || '',
      categoryDetail: categoryDetail?.trim() || '',
      subcategoryId: product.subcategory_id ?? null,
      invQuantity,
      invMinQuantity,
      invUnit,
      invExpiry,
    });
    setModalOpen(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId) ?? null;
    setForm((f) => ({
      ...f,
      categoryId,
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      categoryDetail: cat?.extra_field != null ? f.categoryDetail : '',
      subcategoryId: null,
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
      const payload = {
        restaurant_id: restaurantId,
        name,
        category: categoryName,
        description: descriptionFinal,
        price,
        is_pizza: cfg.isPizza,
        is_marmita: cfg.isMarmita,
        image_url: form.image_url.trim() || null,
        is_active: true,
        subcategory_id: form.subcategoryId || null,
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

      // Upsert de estoque quando categoria tem controle ativo
      if (formCat?.has_inventory && savedProductId) {
        const invQty    = parseFloat((form.invQuantity || '0').replace(',', '.')) || 0;
        const invMinQty = parseFloat((form.invMinQuantity || '5').replace(',', '.')) || 0;
        await supabase.from('inventory_items').upsert({
          restaurant_id: restaurantId,
          product_id:    savedProductId,
          quantity:      invQty,
          min_quantity:  invMinQty,
          unit:          form.invUnit || 'un',
          expiry_date:   form.invExpiry || null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'restaurant_id,product_id' });
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
          price_sale: product.price_sale ?? null, price_cost: product.price_cost ?? null, image_url: product.image_url ?? null,
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

  const handleToggleCategoryInventory = async (categoryId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ has_inventory: !currentValue })
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      await loadCategoriesAndSubcategories();
      toast({
        title: !currentValue ? 'Estoque ativado!' : 'Estoque desativado',
        description: !currentValue
          ? 'Gerencie o estoque desta categoria em Controle de Estoque.'
          : 'Esta categoria não terá mais controle de estoque.',
      });
    } catch {
      toast({ title: 'Erro ao atualizar categoria', variant: 'destructive' });
    }
  };

  const handleChangeCategoryDest = async (categoryId: string, dest: 'kitchen' | 'bar') => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ print_destination: dest })
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      await loadCategoriesAndSubcategories();
      toast({ title: dest === 'kitchen' ? 'Destino: Cozinha Central' : 'Destino: Garçom / Bar' });
    } catch {
      toast({ title: 'Erro ao atualizar destino de impressão', variant: 'destructive' });
    }
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

  // ─── CSV ──────────────────────────────────────────────────────────────────────

  // ─── Pizza CRUD ───────────────────────────────────────────────────────────────

  const handleSubmitSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      const { error } = await supabase.from('pizza_sizes').insert({ restaurant_id: restaurantId, ...formSize });
      if (error) throw error;
      setFormSize({ name: '', max_flavors: 1, price_multiplier: 1, order_index: pizzaSizes.length });
      setShowFormSize(false);
      loadMenuConfig();
      toast({ title: 'Tamanho adicionado!' });
    } catch { toast({ title: 'Erro ao salvar tamanho', variant: 'destructive' }); }
  };

  const handleSubmitDough = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const extra_price = convertPriceToStorage(String(formDough.extra_price), currency);
    try {
      const { error } = await supabase.from('pizza_doughs').insert({ restaurant_id: restaurantId, name: formDough.name, extra_price, is_active: true });
      if (error) throw error;
      setFormDough({ name: '', extra_price: '' });
      setShowFormDough(false);
      loadMenuConfig();
      toast({ title: 'Massa adicionada!' });
    } catch { toast({ title: 'Erro ao salvar massa', variant: 'destructive' }); }
  };

  const handleSubmitEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price = convertPriceToStorage(String(formEdge.price), currency);
    try {
      const { error } = await supabase.from('pizza_edges').insert({ restaurant_id: restaurantId, name: formEdge.name, price, is_active: true });
      if (error) throw error;
      setFormEdge({ name: '', price: '' });
      setShowFormEdge(false);
      loadMenuConfig();
      toast({ title: 'Borda adicionada!' });
    } catch { toast({ title: 'Erro ao salvar borda', variant: 'destructive' }); }
  };

  const deleteSize = async (id: string) => {
    if (!confirm('Excluir este tamanho?')) return;
    await supabase.from('pizza_sizes').delete().eq('id', id);
    loadMenuConfig();
    toast({ title: 'Tamanho excluído!' });
  };

  const deleteDough = async (id: string) => {
    if (!confirm('Excluir esta massa?')) return;
    await supabase.from('pizza_doughs').delete().eq('id', id);
    loadMenuConfig();
    toast({ title: 'Massa excluída!' });
  };

  const deleteEdge = async (id: string) => {
    if (!confirm('Excluir esta borda?')) return;
    await supabase.from('pizza_edges').delete().eq('id', id);
    loadMenuConfig();
    toast({ title: 'Borda excluída!' });
  };

  // ─── Marmita CRUD ─────────────────────────────────────────────────────────────

  const handleSubmitMarmitaSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const base_price = convertPriceToStorage(String(formMarmitaSize.base_price), currency);
    const price_per_gram = convertPriceToStorage(String(formMarmitaSize.price_per_gram), currency);
    try {
      const { error } = await supabase.from('marmita_sizes').insert({ restaurant_id: restaurantId, name: formMarmitaSize.name, weight_grams: formMarmitaSize.weight_grams, base_price, price_per_gram, order_index: formMarmitaSize.order_index, is_active: true });
      if (error) throw error;
      setFormMarmitaSize({ name: '', weight_grams: 500, base_price: '', price_per_gram: '', order_index: marmitaSizes.length });
      setShowFormMarmitaSize(false);
      loadMenuConfig();
      toast({ title: 'Tamanho de marmita adicionado!' });
    } catch { toast({ title: 'Erro ao salvar tamanho', variant: 'destructive' }); }
  };

  const handleSubmitMarmitaProtein = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price_per_gram = convertPriceToStorage(String(formMarmitaProtein.price_per_gram), currency);
    try {
      const { error } = await supabase.from('marmita_proteins').insert({ restaurant_id: restaurantId, name: formMarmitaProtein.name, description: formMarmitaProtein.description || null, price_per_gram, is_active: true });
      if (error) throw error;
      setFormMarmitaProtein({ name: '', description: '', price_per_gram: '' });
      setShowFormMarmitaProtein(false);
      loadMenuConfig();
      toast({ title: 'Proteína adicionada!' });
    } catch { toast({ title: 'Erro ao salvar proteína', variant: 'destructive' }); }
  };

  const handleSubmitMarmitaSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price_per_gram = convertPriceToStorage(String(formMarmitaSide.price_per_gram), currency);
    try {
      const { error } = await supabase.from('marmita_sides').insert({ restaurant_id: restaurantId, name: formMarmitaSide.name, description: formMarmitaSide.description || null, price_per_gram, category: formMarmitaSide.category || null, is_active: true });
      if (error) throw error;
      setFormMarmitaSide({ name: '', description: '', price_per_gram: '', category: '' });
      setShowFormMarmitaSide(false);
      loadMenuConfig();
      toast({ title: 'Acompanhamento adicionado!' });
    } catch { toast({ title: 'Erro ao salvar acompanhamento', variant: 'destructive' }); }
  };

  const deleteMarmitaSize = async (id: string) => { if (!confirm('Excluir?')) return; await supabase.from('marmita_sizes').delete().eq('id', id); loadMenuConfig(); };
  const deleteMarmitaProtein = async (id: string) => { if (!confirm('Excluir?')) return; await supabase.from('marmita_proteins').delete().eq('id', id); loadMenuConfig(); };
  const deleteMarmitaSide = async (id: string) => { if (!confirm('Excluir?')) return; await supabase.from('marmita_sides').delete().eq('id', id); loadMenuConfig(); };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central do Cardápio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalProducts} produto{totalProducts !== 1 ? 's' : ''} · {activeProducts} ativo{activeProducts !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-8 h-8 w-44 text-sm"
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

          {/* Settings */}
          <Button variant="outline" size="sm" onClick={() => setShowConfigModal(true)} className="h-8 gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurações</span>
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

      {/* ── Two-column master-detail layout ──────────────────────────────────── */}
      <div className="flex gap-4 items-start min-h-[500px]">

        {/* ── Left: Category Sidebar ──────────────────────────────────────────── */}
        <div className="w-56 xl:w-64 flex-shrink-0">
          <Card className="dark:bg-slate-900 sticky top-4">
            <CardHeader className="pb-2 pt-4 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categorias</CardTitle>
                {savingCategoryOrder && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3 space-y-0.5">

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
                        onToggleInventory={handleToggleCategoryInventory}
                        onChangeDest={handleChangeCategoryDest}
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
          <div className="flex items-center justify-between mb-3">
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
                    const catObj = categories.find((c) => c.name === categoryName);
                    return (
                      <div key={categoryName} className="space-y-1.5">
                        {/* Show category header only in "All" mode */}
                        {!selectedCategoryId && (
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-sm font-semibold text-foreground">{categoryName}</span>
                            {catObj?.is_pizza && <Badge variant="secondary" className="text-xs">Pizza</Badge>}
                            {catObj?.is_marmita && <Badge variant="secondary" className="text-xs">Marmita</Badge>}
                            <Badge variant="outline" className="text-xs">{catProducts.length}</Badge>
                          </div>
                        )}
                        <div className="rounded-lg border border-border overflow-hidden">
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
                                    showInventory={showInventory}
                                    onEdit={openEdit}
                                    onDuplicate={duplicateProduct}
                                    onDelete={deleteProduct}
                                    onToggleActive={toggleProductStatus}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Nome *</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={categoryConfig.isPizza ? 'Ex: Margherita, Calabresa' : 'Ex: nome do produto'} required />
              </div>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={form.categoryId} onValueChange={handleCategoryChange} required>
                  <SelectTrigger><SelectValue placeholder={categories.length ? 'Selecione' : 'Crie uma categoria'} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}{cat.is_pizza && ' (pizza)'}{cat.is_marmita && ' (marmita)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {subcategoriesOfSelected.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select value={form.subcategoryId ?? 'none'} onValueChange={(v) => setForm((f) => ({ ...f, subcategoryId: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {subcategoriesOfSelected.map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {categoryConfig.isPizza && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Produto configurado como <strong>pizza</strong>. Configure tamanhos e bordas em <strong>Configurações Avançadas</strong>.</span>
              </div>
            )}
            {categoryConfig.isMarmita && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Produto configurado como <strong>marmita</strong>. Configure proteínas e acompanhamentos em <strong>Configurações Avançadas</strong>.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryConfig.extraField && (
                <div className="space-y-2">
                  <Label>{categoryConfig.extraLabel}</Label>
                  <Input value={form.categoryDetail} onChange={(e) => setForm((f) => ({ ...f, categoryDetail: e.target.value }))}
                    placeholder={categoryConfig.extraPlaceholder} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="p-price">{categoryConfig.priceLabel || 'Preço'} ({getCurrencySymbol(currency)}) *</Label>
                <Input id="p-price" type="text" inputMode="decimal" value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))}
                  placeholder={currency === 'PYG' ? '25.000' : '0,00'} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-desc">Descrição</Label>
              <Textarea id="p-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={categoryConfig.isPizza ? 'Ex: Molho de tomate, mussarela e manjericão' : 'Descrição opcional do produto'}
                rows={3} className="resize-none" />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Imagem do produto</Label>
              {form.image_url ? (
                <div className="flex gap-4 p-3 border rounded-lg bg-muted/30 items-start">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input type="url" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="URL da imagem" />
                    <div className="flex gap-2">
                      <label className="cursor-pointer flex-1">
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
                        <Button type="button" variant="outline" size="sm" className="w-full" disabled={imageUploading}>
                          {imageUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Upload className="h-4 w-4 mr-2" />Trocar imagem</>}
                        </Button>
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, image_url: '' }))}>Remover</Button>
                    </div>
                  </div>
                </div>
              ) : (
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
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                    {imageUploading ? (
                      <div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Enviando...</span></div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5"><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm font-medium">Clique para fazer upload</span></div>
                    )}
                  </div>
                  <Input type="url" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="Ou cole uma URL de imagem" className="mt-2" />
                </label>
              )}
            </div>

            {/* Seção de Estoque — visível quando categoria tem has_inventory = true */}
            {(() => {
              const formCatInv = categories.find((c) => c.id === form.categoryId);
              if (!formCatInv?.has_inventory) return null;
              return (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/70">
                    <Boxes className="h-3.5 w-3.5" />
                    Estoque
                    <span className="font-normal normal-case text-muted-foreground ml-1">— categoria com controle ativo</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Quantidade atual</Label>
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
                      <Label className="text-xs">Qtd. mínima</Label>
                      <Input
                        type="text" inputMode="decimal"
                        value={form.invMinQuantity}
                        onChange={(e) => setForm((f) => ({ ...f, invMinQuantity: e.target.value }))}
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Validade</Label>
                      <Input
                        type="date"
                        value={form.invExpiry}
                        onChange={(e) => setForm((f) => ({ ...f, invExpiry: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Seção Sugestões de Upsell ── */}
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
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugestões de Upsell
                    <span className="font-normal normal-case text-muted-foreground ml-1">— até 3 produtos</span>
                  </div>

                  {/* Produtos já selecionados */}
                  {selectedUpsellProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedUpsellProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1 text-xs"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                          ) : (
                            <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">🍽</span>
                          )}
                          <span className="font-medium text-foreground max-w-[120px] truncate">{p.name}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => setSelectedUpsellIds((ids) => ids.filter((id) => id !== p.id))}
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Seletor com busca */}
                  {selectedUpsellIds.length < 3 && (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          value={upsellSearch}
                          onChange={(e) => setUpsellSearch(e.target.value)}
                          placeholder="Buscar produto para sugerir..."
                          className="pl-8 h-8 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                      {upsellSearch.trim() !== '' && (
                        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-white dark:bg-slate-900 divide-y divide-border/60">
                          {upsellCandidates.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                          ) : (
                            upsellCandidates.slice(0, 8).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                                onClick={() => {
                                  setSelectedUpsellIds((ids) => ids.length < 3 ? [...ids, p.id] : ids);
                                  setUpsellSearch('');
                                }}
                              >
                                {p.image_url ? (
                                  <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">🍽</div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{p.category}</p>
                                </div>
                                <Plus className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {upsellSearch.trim() === '' && selectedUpsellIds.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Digite para buscar produtos que aparecerão como sugestão quando este item for adicionado ao carrinho.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : editingProduct ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
              </Button>
            </DialogFooter>
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

      {/* ── Advanced Config Modal (Pizza / Marmita) ──────────────────────────── */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações Avançadas do Cardápio</DialogTitle>
          </DialogHeader>
          {menuConfigLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : (
            <Tabs defaultValue="pizza" className="mt-2">
              <TabsList>
                <TabsTrigger value="pizza">🍕 Pizza</TabsTrigger>
                <TabsTrigger value="marmita">🥘 Marmita</TabsTrigger>
              </TabsList>

              {/* Pizza tab */}
              <TabsContent value="pizza" className="space-y-5 mt-4">
                {/* Sizes */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Tamanhos</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormSize(!showFormSize)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormSize && (
                      <form onSubmit={handleSubmitSize} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-3 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formSize.name} onChange={(e) => setFormSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Média" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Máx. Sabores</Label><Input type="number" min={1} value={formSize.max_flavors} onChange={(e) => setFormSize((f) => ({ ...f, max_flavors: +e.target.value }))} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Multiplicador</Label><Input type="number" step="0.01" min={0.1} value={formSize.price_multiplier} onChange={(e) => setFormSize((f) => ({ ...f, price_multiplier: +e.target.value }))} className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {pizzaSizes.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum tamanho cadastrado.</p>}
                      {pizzaSizes.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{s.name}</strong> · {s.max_flavors} sabor(es) · ×{s.price_multiplier}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteSize(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Doughs */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Massas</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormDough(!showFormDough)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormDough && (
                      <form onSubmit={handleSubmitDough} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formDough.name} onChange={(e) => setFormDough((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Fina, Grossa" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço extra ({getCurrencySymbol(currency)})</Label><Input type="text" value={formDough.extra_price} onChange={(e) => setFormDough((f) => ({ ...f, extra_price: e.target.value }))} placeholder="0,00" required className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {pizzaDoughs.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma massa cadastrada.</p>}
                      {pizzaDoughs.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{d.name}</strong> · +{formatCurrency(Number(d.extra_price), currency)}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteDough(d.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Edges */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Bordas</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormEdge(!showFormEdge)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormEdge && (
                      <form onSubmit={handleSubmitEdge} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formEdge.name} onChange={(e) => setFormEdge((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Catupiry" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço ({getCurrencySymbol(currency)})</Label><Input type="text" value={formEdge.price} onChange={(e) => setFormEdge((f) => ({ ...f, price: e.target.value }))} placeholder="0,00" required className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {pizzaEdges.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma borda cadastrada.</p>}
                      {pizzaEdges.map((edge) => (
                        <li key={edge.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{edge.name}</strong> · {formatCurrency(Number(edge.price), currency)}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteEdge(edge.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Marmita tab */}
              <TabsContent value="marmita" className="space-y-5 mt-4">
                {/* Sizes */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Tamanhos de Marmita</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormMarmitaSize(!showFormMarmitaSize)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormMarmitaSize && (
                      <form onSubmit={handleSubmitMarmitaSize} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formMarmitaSize.name} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: P, M, G" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Peso (g)</Label><Input type="number" value={formMarmitaSize.weight_grams} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, weight_grams: +e.target.value }))} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço base ({getCurrencySymbol(currency)})</Label><Input type="text" value={formMarmitaSize.base_price} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, base_price: e.target.value }))} placeholder="0,00" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço/g ({getCurrencySymbol(currency)})</Label><Input type="text" value={formMarmitaSize.price_per_gram} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,02" required className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSize(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {marmitaSizes.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum tamanho cadastrado.</p>}
                      {marmitaSizes.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{s.name}</strong> · {s.weight_grams}g · base {formatCurrency(Number(s.base_price), currency)}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSize(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Proteins */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Proteínas</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormMarmitaProtein(!showFormMarmitaProtein)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormMarmitaProtein && (
                      <form onSubmit={handleSubmitMarmitaProtein} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formMarmitaProtein.name} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Frango" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço/g ({getCurrencySymbol(currency)})</Label><Input type="text" value={formMarmitaProtein.price_per_gram} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,02" required className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaProtein(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {marmitaProteins.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma proteína cadastrada.</p>}
                      {marmitaProteins.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{p.name}</strong> · {formatCurrency(Number(p.price_per_gram), currency)}/g</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaProtein(p.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Sides */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Acompanhamentos</CardTitle>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormMarmitaSide(!showFormMarmitaSide)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {showFormMarmitaSide && (
                      <form onSubmit={handleSubmitMarmitaSide} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-xs">Nome</Label><Input value={formMarmitaSide.name} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Arroz Branco" required className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Categoria</Label><Input value={formMarmitaSide.category} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Arroz" className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Preço/g ({getCurrencySymbol(currency)})</Label><Input type="text" value={formMarmitaSide.price_per_gram} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,02" required className="h-8 text-sm" /></div>
                        </div>
                        <div className="flex gap-2"><Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSide(false)} className="flex-1 h-7 text-xs">Cancelar</Button></div>
                      </form>
                    )}
                    <ul className="space-y-1.5">
                      {marmitaSides.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum acompanhamento cadastrado.</p>}
                      {marmitaSides.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                          <span className="text-xs"><strong>{s.name}</strong> {s.category && `(${s.category})`} · {formatCurrency(Number(s.price_per_gram), currency)}/g</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSide(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>Fechar</Button>
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
