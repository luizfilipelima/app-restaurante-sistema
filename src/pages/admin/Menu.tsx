import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { convertPriceToStorage, convertPriceFromStorage, formatPriceInputPyG, getCurrencySymbol } from '@/lib/priceHelper';
import { Product, Restaurant, PizzaSize, PizzaDough, PizzaEdge, MarmitaSize, MarmitaProtein, MarmitaSide, Category, Subcategory } from '@/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2, Loader2, Info, Upload, Copy, Check, Sparkles, Search, UtensilsCrossed, LayoutGrid, Settings, QrCode, ExternalLink } from 'lucide-react';
import MenuQRCodeCard from '@/components/admin/MenuQRCodeCard';
import CategoryManager from '@/components/admin/CategoryManager';
import ProductRow from '@/components/admin/ProductRow';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper: config do produto a partir da categoria do BD
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
};

export default function AdminMenu() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState(formDefaults);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, Subcategory[]>>({});

  // Estados para Cardápio Digital
  const [slug, setSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuLinkCopied, setMenuLinkCopied] = useState(false);

  // Busca de produtos
  const [productSearch, setProductSearch] = useState('');
  
  // Estados para configurações de cardápio (Pizza)
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaDoughs, setPizzaDoughs] = useState<PizzaDough[]>([]);
  const [pizzaEdges, setPizzaEdges] = useState<PizzaEdge[]>([]);
  const [menuConfigLoading, setMenuConfigLoading] = useState(false);
  const [showFormSize, setShowFormSize] = useState(false);
  const [showFormDough, setShowFormDough] = useState(false);
  const [showFormEdge, setShowFormEdge] = useState(false);
  const [formSize, setFormSize] = useState({ name: '', max_flavors: 1, price_multiplier: 1, order_index: 0 });
  const [formDough, setFormDough] = useState({ name: '', extra_price: '' });
  const [formEdge, setFormEdge] = useState({ name: '', price: '' });

  // Estados para configurações de cardápio (Marmitas)
  const [marmitaSizes, setMarmitaSizes] = useState<MarmitaSize[]>([]);
  const [marmitaProteins, setMarmitaProteins] = useState<MarmitaProtein[]>([]);
  const [marmitaSides, setMarmitaSides] = useState<MarmitaSide[]>([]);
  const [showFormMarmitaSize, setShowFormMarmitaSize] = useState(false);
  const [showFormMarmitaProtein, setShowFormMarmitaProtein] = useState(false);
  const [showFormMarmitaSide, setShowFormMarmitaSide] = useState(false);
  const [formMarmitaSize, setFormMarmitaSize] = useState({ name: '', weight_grams: 500, base_price: '', price_per_gram: '', order_index: 0 });
  const [formMarmitaProtein, setFormMarmitaProtein] = useState({ name: '', description: '', price_per_gram: '' });
  const [formMarmitaSide, setFormMarmitaSide] = useState({ name: '', description: '', price_per_gram: '', category: '' });

  useEffect(() => {
    if (restaurantId) {
      loadRestaurant();
      loadProducts();
      loadMenuConfig();
      loadCategoriesAndSubcategories();
    }
  }, [restaurantId]);

  const loadCategoriesAndSubcategories = async () => {
    if (!restaurantId) return;
    try {
      const catRes = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true });
      if (catRes.data) setCategories(catRes.data);
      try {
        const subRes = await supabase.from('subcategories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true });
        const byCat: Record<string, Subcategory[]> = {};
        (subRes.data || []).forEach((s) => {
          if (!byCat[s.category_id]) byCat[s.category_id] = [];
          byCat[s.category_id].push(s);
        });
        setSubcategoriesByCategory(byCat);
      } catch {
        setSubcategoriesByCategory({});
      }
    } catch (e) {
      console.error('Erro ao carregar categorias:', e);
    }
  };

  const loadRestaurant = async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      if (error) throw error;
      setRestaurant(data);
      setSlug(data?.slug || '');
    } catch (error) {
      console.error('Erro ao carregar restaurante:', error);
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
    } catch (e) {
      console.error('Erro ao carregar configuração do cardápio:', e);
    } finally {
      setMenuConfigLoading(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!restaurantId) return;
    const slugNormalized = generateSlug(slug) || generateSlug(restaurant?.name || '');
    if (!slugNormalized) {
      toast({ title: 'Slug inválido', description: 'O slug não pode ficar vazio.', variant: 'destructive' });
      return;
    }
    setSlugSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ slug: slugNormalized })
        .eq('id', restaurantId);
      if (error) throw error;
      setSlug(slugNormalized);
      toast({ title: 'Slug salvo com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar slug:', error);
      toast({ title: 'Erro ao salvar slug', variant: 'destructive' });
    } finally {
      setSlugSaving(false);
    }
  };

  const copyCardapioLink = () => {
    const url = getCardapioPublicUrl(slug || restaurant?.slug || '');
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null;
  const categoryConfig = getCategoryConfigFromCategory(selectedCategory);
  const subcategoriesOfSelected = (form.categoryId && subcategoriesByCategory[form.categoryId]) || [];

  const openNew = () => {
    setEditingProduct(null);
    const firstCatId = categories[0]?.id ?? '';
    const firstCat = categories[0];
    setForm({
      ...formDefaults,
      categoryId: firstCatId,
      is_pizza: firstCat?.is_pizza ?? false,
      is_marmita: firstCat?.is_marmita ?? false,
      subcategoryId: null,
    });
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    const cat = categories.find((c) => c.name === product.category);
    const desc = product.description || '';
    const hasDetail = cat?.extra_field && desc.includes(' - ');
    const [categoryDetail, description] = hasDetail
      ? (desc.split(/ - (.+)/).slice(0, 2) as [string, string])
      : ['', desc];
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
    });
    setModalOpen(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId) ?? null;
    setForm((f) => ({
      ...f,
      categoryId: categoryId,
      is_pizza: cat?.is_pizza ?? false,
      is_marmita: cat?.is_marmita ?? false,
      categoryDetail: cat?.extra_field != null ? f.categoryDetail : '',
      subcategoryId: null,
    }));
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
      toast({
        title: 'Erro ao carregar cardápio',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    const name = form.name.trim();
    const categoryName = selectedCategory?.name ?? '';
    const price = convertPriceToStorage(form.price, currency);

    if (!name) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (!form.categoryId || !categoryName) {
      toast({ title: 'Selecione uma categoria. Crie uma na aba Categorias se necessário.', variant: 'destructive' });
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }

    const isPizza = categoryConfig.isPizza || false;
    const isMarmita = categoryConfig.isMarmita || false;
    const descriptionFinal =
      form.categoryDetail.trim()
        ? form.description.trim()
          ? `${form.categoryDetail.trim()} - ${form.description.trim()}`
          : form.categoryDetail.trim()
        : form.description.trim() || null;

    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        name,
        category: categoryName,
        description: descriptionFinal,
        price,
        is_pizza: isPizza,
        is_marmita: isMarmita,
        image_url: form.image_url.trim() || null,
        is_active: true,
        subcategory_id: form.subcategoryId || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Produto atualizado!', variant: 'success' });
      } else {
        const { data: nextOrder } = await supabase.rpc('get_next_product_order_index', {
          p_restaurant_id: restaurantId,
          p_category: categoryName,
        });
        const order_index = nextOrder ?? 0;
        const { error } = await supabase.from('products').insert({ ...payload, order_index });

        if (error) throw error;
        toast({ title: 'Produto adicionado ao cardápio!', variant: 'success' });
      }

      setModalOpen(false);
      loadProducts();
      loadCategoriesAndSubcategories();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      const msg = error instanceof Error ? error.message : 'Verifique as permissões no Supabase.';
      toast({
        title: 'Erro ao salvar produto',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !isActive })
        .eq('id', productId);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, is_active: !isActive } : p
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
    }
  };

  const duplicateProduct = async (product: Product) => {
    if (!restaurantId) return;
    try {
      const { data: nextOrder } = await supabase.rpc('get_next_product_order_index', {
        p_restaurant_id: restaurantId,
        p_category: product.category,
      });
      const order_index = nextOrder ?? 0;
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert({
          restaurant_id: product.restaurant_id,
          category: product.category,
          subcategory_id: product.subcategory_id ?? null,
          name: `${product.name} (Cópia)`,
          description: product.description ?? null,
          price: product.price,
          price_sale: product.price_sale ?? null,
          price_cost: product.price_cost ?? null,
          image_url: product.image_url ?? null,
          is_pizza: product.is_pizza,
          is_marmita: product.is_marmita ?? false,
          is_active: product.is_active,
          order_index,
        })
        .select('*')
        .single();

      if (error) throw error;
      setProducts((prev) =>
        [...prev, { ...newProduct, order_index }].sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category);
          return (a.order_index ?? 0) - (b.order_index ?? 0);
        })
      );
      toast({ title: 'Produto duplicado!', description: `${newProduct.name} adicionado ao final da categoria.` });
      openEdit(newProduct);
      setModalOpen(true);
    } catch (err) {
      console.error('Erro ao duplicar:', err);
      toast({
        title: 'Erro ao duplicar produto',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
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
      const updatePromises = withNewOrder.map((p) =>
        supabase.from('products').update({ order_index: p.order_index }).eq('id', p.id)
      );
      const results = await Promise.all(updatePromises);
      const err = results.find((r) => r.error);
      if (err?.error) {
        toast({ title: 'Erro ao salvar ordem', variant: 'destructive' });
        loadProducts();
      }
    })();
  };

  // Funções CRUD para Pizza
  const handleSubmitSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      const { error } = await supabase.from('pizza_sizes').insert({
        restaurant_id: restaurantId,
        name: formSize.name,
        max_flavors: formSize.max_flavors,
        price_multiplier: formSize.price_multiplier,
        order_index: formSize.order_index,
      });
      if (error) throw error;
      setFormSize({ name: '', max_flavors: 1, price_multiplier: 1, order_index: pizzaSizes.length });
      setShowFormSize(false);
      loadMenuConfig();
      toast({ title: 'Tamanho adicionado!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar tamanho', variant: 'destructive' });
    }
  };

  const handleSubmitDough = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const extra_price = convertPriceToStorage(String(formDough.extra_price), currency);
    try {
      const { error } = await supabase.from('pizza_doughs').insert({
        restaurant_id: restaurantId,
        name: formDough.name,
        extra_price,
        is_active: true,
      });
      if (error) throw error;
      setFormDough({ name: '', extra_price: '' });
      setShowFormDough(false);
      loadMenuConfig();
      toast({ title: 'Massa adicionada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar massa', variant: 'destructive' });
    }
  };

  const handleSubmitEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price = convertPriceToStorage(String(formEdge.price), currency);
    try {
      const { error } = await supabase.from('pizza_edges').insert({
        restaurant_id: restaurantId,
        name: formEdge.name,
        price,
        is_active: true,
      });
      if (error) throw error;
      setFormEdge({ name: '', price: '' });
      setShowFormEdge(false);
      loadMenuConfig();
      toast({ title: 'Borda adicionada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar borda', variant: 'destructive' });
    }
  };

  const deleteSize = async (id: string) => {
    if (!confirm('Excluir este tamanho?')) return;
    try {
      await supabase.from('pizza_sizes').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Tamanho excluído!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const deleteDough = async (id: string) => {
    if (!confirm('Excluir esta massa?')) return;
    try {
      await supabase.from('pizza_doughs').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Massa excluída!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const deleteEdge = async (id: string) => {
    if (!confirm('Excluir esta borda?')) return;
    try {
      await supabase.from('pizza_edges').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Borda excluída!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const toggleDoughActive = async (id: string, isActive: boolean) => {
    try {
      await supabase.from('pizza_doughs').update({ is_active: !isActive }).eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleEdgeActive = async (id: string, isActive: boolean) => {
    try {
      await supabase.from('pizza_edges').update({ is_active: !isActive }).eq('id', id);
      loadMenuConfig();
    } catch (e) {
      console.error(e);
    }
  };

  // Funções CRUD para Marmitas
  const handleSubmitMarmitaSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const base_price = convertPriceToStorage(String(formMarmitaSize.base_price), currency);
    // price_per_gram: manter como decimal por enquanto (valor muito pequeno)
    const price_per_gram = parseFloat(String(formMarmitaSize.price_per_gram).replace(',', '.')) || 0;
    try {
      const { error } = await supabase.from('marmita_sizes').insert({
        restaurant_id: restaurantId,
        name: formMarmitaSize.name,
        weight_grams: formMarmitaSize.weight_grams,
        base_price,
        price_per_gram,
        order_index: formMarmitaSize.order_index,
        is_active: true,
      });
      if (error) throw error;
      setFormMarmitaSize({ name: '', weight_grams: 500, base_price: '', price_per_gram: '', order_index: marmitaSizes.length });
      setShowFormMarmitaSize(false);
      loadMenuConfig();
      toast({ title: 'Tamanho de marmita adicionado!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar tamanho', variant: 'destructive' });
    }
  };

  const handleSubmitMarmitaProtein = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price_per_gram = parseFloat(String(formMarmitaProtein.price_per_gram).replace(',', '.')) || 0;
    try {
      const { error } = await supabase.from('marmita_proteins').insert({
        restaurant_id: restaurantId,
        name: formMarmitaProtein.name,
        description: formMarmitaProtein.description || null,
        price_per_gram,
        is_active: true,
      });
      if (error) throw error;
      setFormMarmitaProtein({ name: '', description: '', price_per_gram: '' });
      setShowFormMarmitaProtein(false);
      loadMenuConfig();
      toast({ title: 'Proteína adicionada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar proteína', variant: 'destructive' });
    }
  };

  const handleSubmitMarmitaSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const price_per_gram = parseFloat(String(formMarmitaSide.price_per_gram).replace(',', '.')) || 0;
    try {
      const { error } = await supabase.from('marmita_sides').insert({
        restaurant_id: restaurantId,
        name: formMarmitaSide.name,
        description: formMarmitaSide.description || null,
        price_per_gram,
        category: formMarmitaSide.category || null,
        is_active: true,
      });
      if (error) throw error;
      setFormMarmitaSide({ name: '', description: '', price_per_gram: '', category: '' });
      setShowFormMarmitaSide(false);
      loadMenuConfig();
      toast({ title: 'Acompanhamento adicionado!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar acompanhamento', variant: 'destructive' });
    }
  };

  const deleteMarmitaSize = async (id: string) => {
    if (!confirm('Excluir este tamanho de marmita?')) return;
    try {
      await supabase.from('marmita_sizes').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Tamanho excluído!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const deleteMarmitaProtein = async (id: string) => {
    if (!confirm('Excluir esta proteína?')) return;
    try {
      await supabase.from('marmita_proteins').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Proteína excluída!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const deleteMarmitaSide = async (id: string) => {
    if (!confirm('Excluir este acompanhamento?')) return;
    try {
      await supabase.from('marmita_sides').delete().eq('id', id);
      loadMenuConfig();
      toast({ title: 'Acompanhamento excluído!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };


  // Agrupar produtos por categoria (ordem da tabela categories)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);
  Object.keys(groupedProducts).forEach((cat) => {
    groupedProducts[cat].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  });
  const categoryOrder = categories.map((c) => c.name);
  const sortedCategoryNames = categoryOrder.length > 0
    ? categoryOrder.filter((name) => groupedProducts[name]?.length)
    : Object.keys(groupedProducts);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs principais */}
      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="h-auto flex flex-wrap gap-1 p-1 mb-2">
          <TabsTrigger value="produtos" className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            <span>Produtos</span>
            {totalProducts > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">{totalProducts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            <span>Categorias</span>
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="online" className="flex items-center gap-1.5">
            <QrCode className="h-4 w-4" />
            <span>Cardápio Online</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Produtos ── */}
        <TabsContent value="produtos" className="space-y-5 mt-4">
          {/* Banner IA */}
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              Cadastre o preço de custo para desbloquear a inteligência artificial do seu cardápio.
            </p>
          </div>

          {/* Barra de ações */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {totalProducts} produto{totalProducts !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeProducts} ativo{activeProducts !== 1 ? 's' : ''} · {totalProducts - activeProducts} inativo{totalProducts - activeProducts !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="pl-8 h-9"
                />
              </div>
              <Button onClick={openNew} size="sm" className="shrink-0">
                <Plus className="h-4 w-4 mr-1.5" />
                Novo produto
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Cardápio vazio</p>
                  <p className="text-sm text-muted-foreground">
                    Comece adicionando o primeiro produto ao seu cardápio.
                  </p>
                </div>
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeiro produto
                </Button>
              </CardContent>
            </Card>
          ) : sortedCategoryNames.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <p className="text-muted-foreground text-sm">Nenhum produto encontrado para <strong>"{productSearch}"</strong>.</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProductsDragEnd}
            >
              <div className="space-y-6">
                {sortedCategoryNames.map((category) => {
                  const categoryProducts = groupedProducts[category] ?? [];
                  const catObj = categories.find((c) => c.name === category);
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold capitalize text-foreground">{category}</h3>
                        {catObj?.is_pizza && <Badge variant="secondary" className="text-xs">Pizza</Badge>}
                        {catObj?.is_marmita && <Badge variant="secondary" className="text-xs">Marmita</Badge>}
                        <Badge variant="outline" className="text-xs">{categoryProducts.length}</Badge>
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-10" />
                              <TableHead className="w-[52px]" />
                              <TableHead>Nome</TableHead>
                              <TableHead className="text-right">Preço</TableHead>
                              <TableHead className="w-20 text-center">Status</TableHead>
                              <TableHead className="w-[180px] text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <SortableContext
                              items={categoryProducts.map((p) => p.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {categoryProducts.map((product) => (
                                <ProductRow
                                  key={product.id}
                                  product={product}
                                  currency={currency}
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
              </div>
            </DndContext>
          )}
        </TabsContent>

        {/* ── Aba Categorias ── */}
        <TabsContent value="categorias" className="space-y-5 mt-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Categorias e Subcategorias</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Adicione, remova ou reordene categorias. Expanda para gerenciar subcategorias.
            </p>
          </div>
          {restaurantId && (
            <CategoryManager restaurantId={restaurantId} onCategoriesChange={loadCategoriesAndSubcategories} />
          )}
        </TabsContent>

        {/* ── Aba Configurações ── */}
        <TabsContent value="configuracoes" className="space-y-8 mt-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Configurações do Cardápio</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure as opções especiais por tipo de produto.
            </p>
          </div>

          {menuConfigLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* ─ Seção Pizza ─ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <span className="text-lg">🍕</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Pizza</h3>
                    <p className="text-xs text-muted-foreground">Tamanhos, massas e bordas para categorias do tipo Pizza</p>
                  </div>
                </div>
                <div className="h-px bg-border my-2" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Tamanhos */}
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
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs">Nome</Label>
                              <Input value={formSize.name} onChange={(e) => setFormSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Broto, Média" required className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Máx. sabores</Label>
                              <Input type="number" min={1} value={formSize.max_flavors} onChange={(e) => setFormSize((f) => ({ ...f, max_flavors: parseInt(e.target.value, 10) || 1 }))} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Multiplicador</Label>
                              <Input type="number" step="0.01" min="0" value={formSize.price_multiplier} onChange={(e) => setFormSize((f) => ({ ...f, price_multiplier: parseFloat(e.target.value) || 1 }))} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {pizzaSizes.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum tamanho cadastrado.</p>}
                        {pizzaSizes.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{s.name}</strong> · {s.max_flavors} sabor(es) · {Number(s.price_multiplier)}x</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteSize(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Massas */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Tipos de Massa</CardTitle>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormDough(!showFormDough)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {showFormDough && (
                        <form onSubmit={handleSubmitDough} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input value={formDough.name} onChange={(e) => setFormDough((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Tradicional" required className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Acréscimo ({getCurrencySymbol(currency)})</Label>
                            <Input type="text" value={formDough.extra_price} onChange={(e) => setFormDough((f) => ({ ...f, extra_price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {pizzaDoughs.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum tipo cadastrado.</p>}
                        {pizzaDoughs.map((d) => (
                          <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{d.name}</strong> {Number(d.extra_price) > 0 ? `+${formatCurrency(Number(d.extra_price), currency)}` : ''}{!d.is_active && ' · inativo'}</span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => toggleDoughActive(d.id, d.is_active)} className="h-6 text-xs px-1.5">{d.is_active ? 'Desativar' : 'Ativar'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => deleteDough(d.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Bordas */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Bordas Recheadas</CardTitle>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormEdge(!showFormEdge)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {showFormEdge && (
                        <form onSubmit={handleSubmitEdge} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input value={formEdge.name} onChange={(e) => setFormEdge((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Catupiry" required className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Preço ({getCurrencySymbol(currency)})</Label>
                            <Input type="text" value={formEdge.price} onChange={(e) => setFormEdge((f) => ({ ...f, price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))} placeholder={currency === 'PYG' ? '8.000' : '8,00'} required className="h-8 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {pizzaEdges.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma borda cadastrada.</p>}
                        {pizzaEdges.map((e) => (
                          <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{e.name}</strong> · {formatCurrency(Number(e.price), currency)}{!e.is_active && ' · inativo'}</span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => toggleEdgeActive(e.id, e.is_active)} className="h-6 text-xs px-1.5">{e.is_active ? 'Desativar' : 'Ativar'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => deleteEdge(e.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ─ Seção Marmitas ─ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="text-lg">🍱</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Marmitas</h3>
                    <p className="text-xs text-muted-foreground">Tamanhos, proteínas e acompanhamentos para categorias do tipo Marmita</p>
                  </div>
                </div>
                <div className="h-px bg-border my-2" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Tamanhos de Marmita */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Tamanhos (Pesos)</CardTitle>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setShowFormMarmitaSize(!showFormMarmitaSize)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {showFormMarmitaSize && (
                        <form onSubmit={handleSubmitMarmitaSize} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <Label className="text-xs">Nome</Label>
                              <Input value={formMarmitaSize.name} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: 300g, 500g" required className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Peso (g)</Label>
                              <Input type="number" min={100} step={50} value={formMarmitaSize.weight_grams} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, weight_grams: parseInt(e.target.value, 10) || 500 }))} required className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Preço base</Label>
                              <Input type="text" value={formMarmitaSize.base_price} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, base_price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value }))} placeholder={currency === 'PYG' ? '15.000' : '15,00'} required className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSize(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {marmitaSizes.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum tamanho cadastrado.</p>}
                        {marmitaSizes.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{s.name}</strong> · {s.weight_grams}g · {formatCurrency(Number(s.base_price), currency)}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSize(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Proteínas */}
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
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input value={formMarmitaProtein.name} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Frango Grelhado" required className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição (opcional)</Label>
                            <Input value={formMarmitaProtein.description} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Peito grelhado" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Preço/g ({getCurrencySymbol(currency)})</Label>
                            <Input type="text" value={formMarmitaProtein.price_per_gram} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,08" required className="h-8 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaProtein(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {marmitaProteins.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma proteína cadastrada.</p>}
                        {marmitaProteins.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{p.name}</strong> · {formatCurrency(Number(p.price_per_gram), currency)}/g{!p.is_active && ' · inativo'}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaProtein(p.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Acompanhamentos */}
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
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input value={formMarmitaSide.name} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Arroz Branco" required className="h-8 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Categoria</Label>
                              <Input value={formMarmitaSide.category} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Arroz" className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Preço/g ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formMarmitaSide.price_per_gram} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,02" required className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1 h-7 text-xs">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSide(false)} className="flex-1 h-7 text-xs">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-1.5">
                        {marmitaSides.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum acompanhamento cadastrado.</p>}
                        {marmitaSides.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-muted/50">
                            <span className="text-xs"><strong>{s.name}</strong> {s.category && `(${s.category})`} · {formatCurrency(Number(s.price_per_gram), currency)}/g{!s.is_active && ' · inativo'}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSide(s.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Aba Cardápio Online ── */}
        <TabsContent value="online" className="space-y-6 mt-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Cardápio Online</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure e compartilhe o link público do seu cardápio.
            </p>
          </div>

          {/* Slug config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endereço do cardápio</CardTitle>
              <p className="text-sm text-muted-foreground">
                Defina o slug único que aparece no URL do seu cardápio.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                    placeholder="ex: minha-pizzaria"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas letras minúsculas, números e hífens.
                  </p>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSaveSlug} disabled={slugSaving} className="w-full sm:w-auto">
                    {slugSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </div>

              {(slug || restaurant?.slug) && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Link interativo */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label className="text-sm font-medium">Cardápio interativo</Label>
                      <Badge variant="secondary" className="text-xs">Pedidos habilitados</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input readOnly value={getCardapioPublicUrl(slug || restaurant?.slug || '')} className="flex-1 text-sm bg-muted/30" />
                      <Button type="button" variant="outline" size="sm" onClick={copyCardapioLink} className="shrink-0">
                        {linkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {linkCopied ? 'Copiado!' : 'Copiar'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => window.open(getCardapioPublicUrl(slug || restaurant?.slug || ''), '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Link somente visualização */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label className="text-sm font-medium">Cardápio somente leitura</Label>
                      <Badge variant="outline" className="text-xs">Sem pedidos</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input readOnly value={getCardapioPublicUrl(slug || restaurant?.slug || '') + '/menu'} className="flex-1 text-sm bg-muted/30" />
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        const url = getCardapioPublicUrl(slug || restaurant?.slug || '') + '/menu';
                        navigator.clipboard.writeText(url).then(() => {
                          setMenuLinkCopied(true);
                          toast({ title: 'Link copiado!' });
                          setTimeout(() => setMenuLinkCopied(false), 2000);
                        });
                      }} className="shrink-0">
                        {menuLinkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {menuLinkCopied ? 'Copiado!' : 'Copiar'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => window.open(getCardapioPublicUrl(slug || restaurant?.slug || '') + '/menu', '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ideal para substituir o cardápio físico — sem opção de fazer pedidos.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code */}
          <MenuQRCodeCard slug={slug || restaurant?.slug || ''} />
        </TabsContent>
      </Tabs>

      {/* Modal Adicionar/Editar Produto - Melhorado para Mobile */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-5">
            {/* Nome e Categoria em Grid Responsivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={
                    categoryConfig.isPizza
                      ? 'Ex: Margherita, Calabresa'
                      : categoryConfig.extraField === 'volume'
                      ? 'Ex: Refrigerante, Suco'
                      : 'Ex: nome do produto'
                  }
                  className="text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={handleCategoryChange}
                  required
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder={categories.length ? 'Selecione' : 'Crie uma categoria na aba Categorias'} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                        {cat.is_pizza && ' (tamanhos e sabores)'}
                        {cat.is_marmita && ' (monte sua marmita)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {subcategoriesOfSelected.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select
                  value={form.subcategoryId ?? 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, subcategoryId: v === 'none' ? null : v }))}
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {subcategoriesOfSelected.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Mensagens informativas */}
            {categoryConfig.isPizza && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>pizza</strong>. O cliente poderá escolher tamanho, sabores e borda na hora do pedido. Configure nas <strong>Configurações</strong>.
                </span>
              </div>
            )}

            {categoryConfig.isMarmita && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>marmita</strong>. O cliente poderá escolher tamanho (peso), proteínas e acompanhamentos na hora do pedido. Configure nas <strong>Configurações</strong>.
                </span>
              </div>
            )}

            {/* Campo extra e Descrição em Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryConfig.extraField && (
                <div className="space-y-2">
                  <Label htmlFor="categoryDetail">
                    {categoryConfig.extraLabel}
                  </Label>
                  <Input
                    id="categoryDetail"
                    value={form.categoryDetail}
                    onChange={(e) => setForm((f) => ({ ...f, categoryDetail: e.target.value }))}
                    placeholder={categoryConfig.extraPlaceholder}
                    className="text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="price">
                  {categoryConfig.priceLabel ? `${categoryConfig.priceLabel} (${getCurrencySymbol(currency)}) *` : `Preço (${getCurrencySymbol(currency)}) *`}
                </Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    }))
                  }
                  placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                  className="text-base"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={
                  categoryConfig.isPizza
                    ? 'Ex: Molho de tomate, mussarela e manjericão'
                    : 'Descrição opcional do produto'
                }
                rows={3}
                className="resize-none text-base"
              />
            </div>

            {/* Imagem - Layout Melhorado */}
            <div className="space-y-3">
              <Label>Imagem do produto</Label>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF ou WebP. Será convertida para WebP (80%) automaticamente.
              </p>
              
              {form.image_url ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                    <img
                      src={form.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="url"
                      value={form.image_url}
                      onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                      placeholder="Ou cole uma URL"
                      className="text-base"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="cursor-pointer flex-1">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          className="sr-only"
                          disabled={imageUploading || !restaurantId}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !restaurantId) return;
                            setImageUploading(true);
                            try {
                              const url = await uploadProductImage(restaurantId, file);
                              setForm((f) => ({ ...f, image_url: url }));
                              toast({ title: 'Imagem enviada e otimizada!' });
                            } catch (err) {
                              toast({
                                title: 'Erro ao enviar imagem',
                                description: err instanceof Error ? err.message : 'Tente outro arquivo.',
                                variant: 'destructive',
                              });
                            } finally {
                              setImageUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button type="button" variant="outline" className="w-full" disabled={imageUploading}>
                          {imageUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Trocar imagem
                            </>
                          )}
                        </Button>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                        className="w-full sm:w-auto"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="sr-only"
                    disabled={imageUploading || !restaurantId}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !restaurantId) return;
                      setImageUploading(true);
                      try {
                        const url = await uploadProductImage(restaurantId, file);
                        setForm((f) => ({ ...f, image_url: url }));
                        toast({ title: 'Imagem enviada e otimizada!' });
                      } catch (err) {
                        toast({
                          title: 'Erro ao enviar imagem',
                          description: err instanceof Error ? err.message : 'Tente outro arquivo.',
                          variant: 'destructive',
                        });
                      } finally {
                        setImageUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                    {imageUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Enviando e otimizando...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-medium">Clique para fazer upload</span>
                        <span className="text-xs text-muted-foreground">Ou cole uma URL abaixo</span>
                      </div>
                    )}
                  </div>
                  <Input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="Ou cole uma URL da imagem aqui"
                    className="mt-2 text-base"
                  />
                </label>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingProduct ? (
                  'Salvar Alterações'
                ) : (
                  'Adicionar ao Cardápio'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
