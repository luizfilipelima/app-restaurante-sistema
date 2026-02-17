import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { Product, Restaurant, PizzaSize, PizzaDough, PizzaEdge, MarmitaSize, MarmitaProtein, MarmitaSide } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Edit, Trash2, Pizza, Loader2, Info, Upload, Copy, Check } from 'lucide-react';
import MenuQRCodeCard from '@/components/admin/MenuQRCodeCard';
import CategoryReorder from '@/components/admin/CategoryReorder';

// Categorias fixas do cardápio com configurações específicas por tipo
interface CategoryConfig {
  id: string;
  label: string;
  isPizza: boolean;
  isMarmita?: boolean;
  priceLabel?: string;
  extraField?: string;
  extraLabel?: string;
  extraPlaceholder?: string;
}

const CATEGORIAS_CARDAPIO: CategoryConfig[] = [
  { id: 'Marmitas', label: 'Marmitas', isPizza: false, isMarmita: true, priceLabel: 'Preço base' },
  { id: 'Pizza', label: 'Pizza', isPizza: true, priceLabel: 'Preço base (por sabor)' },
  { id: 'Bebidas', label: 'Bebidas', isPizza: false, extraField: 'volume', extraLabel: 'Volume ou medida', extraPlaceholder: 'Ex: 350ml, 1L, 2L' },
  { id: 'Sobremesas', label: 'Sobremesas', isPizza: false, extraField: 'portion', extraLabel: 'Porção', extraPlaceholder: 'Ex: individual, fatia, 500g' },
  { id: 'Aperitivos', label: 'Aperitivos', isPizza: false },
  { id: 'Massas', label: 'Massas', isPizza: false },
  { id: 'Lanches', label: 'Lanches', isPizza: false },
  { id: 'Combos', label: 'Combos', isPizza: false, extraField: 'detail', extraLabel: 'Detalhe do combo', extraPlaceholder: 'Ex: Pizza + Refrigerante' },
  { id: 'Outros', label: 'Outros', isPizza: false },
];

type CategoryId = (typeof CATEGORIAS_CARDAPIO)[number]['id'];

const getCategoryConfig = (categoryId: string): CategoryConfig =>
  CATEGORIAS_CARDAPIO.find((c) => c.id === categoryId) ?? CATEGORIAS_CARDAPIO[CATEGORIAS_CARDAPIO.length - 1];

/** Símbolo da moeda para labels (R$ ou Gs.) conforme configuração do restaurante */
const getCurrencySymbol = (currency: 'BRL' | 'PYG') => (currency === 'PYG' ? 'Gs.' : 'R$');

const formDefaults = {
  name: '',
  category: 'Marmitas' as CategoryId,
  description: '',
  price: '',
  is_pizza: false,
  is_marmita: true, // Marmitas é padrão na primeira categoria
  image_url: '',
  categoryDetail: '', // Campo extra conforme categoria (volume, porção, etc.)
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
  
  // Estados para Cardápio Digital
  const [slug, setSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
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
    }
  }, [restaurantId]);

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

  const openNew = () => {
    setEditingProduct(null);
    setForm(formDefaults);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    const config = getCategoryConfig(product.category);
    const desc = product.description || '';
    const hasDetail = config.extraField && desc.includes(' - ');
    const [categoryDetail, description] = hasDetail
      ? (desc.split(/ - (.+)/).slice(0, 2) as [string, string])
      : ['', desc];
    setForm({
      name: product.name,
      category: (config.id as CategoryId) || 'Outros',
      description: description?.trim() || '',
      price: String(product.price),
      is_pizza: config.isPizza || false,
      is_marmita: config.isMarmita || false,
      image_url: product.image_url || '',
      categoryDetail: categoryDetail?.trim() || '',
    });
    setModalOpen(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    const config = getCategoryConfig(categoryId);
    setForm((f) => ({
      ...f,
      category: categoryId as CategoryId,
      is_pizza: config.isPizza || false,
      is_marmita: config.isMarmita || false,
      categoryDetail: config.extraField != null ? f.categoryDetail : '',
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
    const category = form.category.trim();
    const price = parseFloat(form.price.replace(',', '.'));

    if (!name) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (!category) {
      toast({ title: 'Categoria obrigatória', variant: 'destructive' });
      return;
    }
    if (isNaN(price) || price < 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }

    const config = getCategoryConfig(category);
    const isPizza = config.isPizza || false;
    const isMarmita = config.isMarmita || false;
    const descriptionFinal =
      form.categoryDetail.trim()
        ? form.description.trim()
          ? `${form.categoryDetail.trim()} - ${form.description.trim()}`
          : form.categoryDetail.trim()
        : form.description.trim() || null;

      setSaving(true);
    try {
      // Garantir que a categoria existe na tabela categories
      if (restaurantId) {
        const { data: existingCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('name', category)
          .single();

        if (!existingCategory) {
          // Criar categoria se não existir
          const { data: nextOrderIndex } = await supabase.rpc('get_next_category_order_index', {
            restaurant_uuid: restaurantId,
          });

          await supabase.from('categories').insert({
            restaurant_id: restaurantId,
            name: category,
            order_index: nextOrderIndex ?? 0,
          });
        }
      }

      const payload = {
        restaurant_id: restaurantId,
        name,
        category,
        description: descriptionFinal,
        price,
        is_pizza: isPizza,
        is_marmita: isMarmita,
        image_url: form.image_url.trim() || null,
        is_active: true,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Produto atualizado!', variant: 'success' });
      } else {
        const { error } = await supabase.from('products').insert(payload);

        if (error) throw error;
        toast({ title: 'Produto adicionado ao cardápio!', variant: 'success' });
      }

      setModalOpen(false);
      loadProducts();
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
    const extra_price = parseFloat(String(formDough.extra_price).replace(',', '.')) || 0;
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
    const price = parseFloat(String(formEdge.price).replace(',', '.')) || 0;
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
    const base_price = parseFloat(String(formMarmitaSize.base_price).replace(',', '.')) || 0;
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


  // Agrupar produtos por categoria
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção Cardápio Digital */}
      <Card>
        <CardHeader>
          <CardTitle>Cardápio Digital</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure o endereço público do seu cardápio. Em produção será acessível em <strong>slug.quiero.food</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="slug">Slug do cardápio</Label>
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
                Salvar Slug
              </Button>
            </div>
          </div>
          {(slug || restaurant?.slug) && (
            <>
              <div>
                <Label>Link público do cardápio (interativo):</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Input
                    readOnly
                    value={getCardapioPublicUrl(slug || restaurant?.slug || '')}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyCardapioLink}
                    className="w-full sm:w-auto"
                  >
                    {linkCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {linkCopied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Link do cardápio (somente visualização):</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Input
                    readOnly
                    value={getCardapioPublicUrl(slug || restaurant?.slug || '') + '/menu'}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const url = getCardapioPublicUrl(slug || restaurant?.slug || '') + '/menu';
                      navigator.clipboard.writeText(url).then(() => {
                        toast({ title: 'Link copiado!' });
                      });
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cardápio sem opção de pedidos, ideal para substituir cardápio físico
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Code do Cardápio */}
      <MenuQRCodeCard slug={slug || restaurant?.slug || ''} />

      {/* Tabs: Produtos, Categorias e Configurações */}
      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* Aba Produtos */}
        <TabsContent value="produtos" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Produtos do Cardápio</h2>
              <p className="text-muted-foreground text-sm">
                Gerencie os produtos do seu cardápio
              </p>
            </div>
            <Button onClick={openNew} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>

          {Object.keys(groupedProducts).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem produtos cadastrados
                </p>
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Produto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-xl font-semibold capitalize">{category}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryProducts.map((product) => (
                      <Card key={product.id} className="overflow-hidden">
                        <div className="relative">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-48 object-cover"
                            />
                          ) : (
                            <div className="w-full h-48 bg-muted flex items-center justify-center">
                              <Pizza className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          {product.is_pizza && (
                            <Badge className="absolute top-2 right-2">Pizza</Badge>
                          )}
                          {product.is_marmita && (
                            <Badge className="absolute top-2 right-2">Marmita</Badge>
                          )}
                          {!product.is_active && (
                            <Badge variant="destructive" className="absolute top-2 left-2">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-lg mb-1">{product.name}</h4>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(product.price, currency)}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => toggleProductStatus(product.id, product.is_active)}
                            >
                              {product.is_active ? 'Desativar' : 'Ativar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openEdit(product)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteProduct(product.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aba Categorias */}
        <TabsContent value="categorias" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reordenar Categorias</h2>
            <p className="text-muted-foreground text-sm">
              Arraste as categorias para definir a ordem de exibição no cardápio público.
            </p>
          </div>
          {restaurantId && <CategoryReorder restaurantId={restaurantId} />}
        </TabsContent>

        {/* Aba Configurações */}
        <TabsContent value="configuracoes" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Configurações do Cardápio</h2>
            <p className="text-muted-foreground text-sm">
              Defina opções por categoria. A categoria <strong>Pizza</strong> usa tamanhos, massas e bordas. A categoria <strong>Marmitas</strong> usa tamanhos (pesos), proteínas e acompanhamentos.
            </p>
          </div>

          <Tabs defaultValue="pizza" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="pizza">Pizza</TabsTrigger>
              <TabsTrigger value="marmitas">Marmitas</TabsTrigger>
            </TabsList>

            {/* Configurações Pizza */}
            <TabsContent value="pizza" className="space-y-8 mt-6">
              {menuConfigLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Tamanhos */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Tamanhos de Pizza</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(!showFormSize)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormSize && (
                        <form onSubmit={handleSubmitSize} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formSize.name} onChange={(e) => setFormSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Broto, Média, Grande" required />
                            </div>
                            <div>
                              <Label>Máx. sabores</Label>
                              <Input type="number" min={1} value={formSize.max_flavors} onChange={(e) => setFormSize((f) => ({ ...f, max_flavors: parseInt(e.target.value, 10) || 1 }))} />
                            </div>
                            <div>
                              <Label>Multiplicador de preço</Label>
                              <Input type="number" step="0.01" min="0" value={formSize.price_multiplier} onChange={(e) => setFormSize((f) => ({ ...f, price_multiplier: parseFloat(e.target.value) || 1 }))} placeholder="1.0" />
                            </div>
                            <div>
                              <Label>Ordem</Label>
                              <Input type="number" min={0} value={formSize.order_index} onChange={(e) => setFormSize((f) => ({ ...f, order_index: parseInt(e.target.value, 10) || 0 }))} />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormSize(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {pizzaSizes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tamanho. Adicione para o cliente escolher no cardápio.</p>}
                        {pizzaSizes.map((s) => (
                          <li key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{s.name}</strong> — até {s.max_flavors} sabor(es) — multiplicador {Number(s.price_multiplier)}x</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteSize(s.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Massas */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Tipos de Massa</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(!showFormDough)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormDough && (
                        <form onSubmit={handleSubmitDough} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formDough.name} onChange={(e) => setFormDough((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Tradicional" required />
                            </div>
                            <div>
                              <Label>Acréscimo ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formDough.extra_price} onChange={(e) => setFormDough((f) => ({ ...f, extra_price: e.target.value }))} placeholder="0" />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormDough(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {pizzaDoughs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tipo. Adicione (ex: Tradicional, Integral).</p>}
                        {pizzaDoughs.map((d) => (
                          <li key={d.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{d.name}</strong> {Number(d.extra_price) > 0 ? `+ ${formatCurrency(Number(d.extra_price), currency)}` : '(sem acréscimo)'}{!d.is_active && ' (inativo)'}</span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => toggleDoughActive(d.id, d.is_active)}>{d.is_active ? 'Desativar' : 'Ativar'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => deleteDough(d.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Bordas */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Bordas Recheadas</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(!showFormEdge)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormEdge && (
                        <form onSubmit={handleSubmitEdge} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formEdge.name} onChange={(e) => setFormEdge((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Catupiry" required />
                            </div>
                            <div>
                              <Label>Preço ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formEdge.price} onChange={(e) => setFormEdge((f) => ({ ...f, price: e.target.value }))} placeholder="8,00" required />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormEdge(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {pizzaEdges.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma borda. Adicione (ex: Catupiry, Cheddar).</p>}
                        {pizzaEdges.map((e) => (
                          <li key={e.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{e.name}</strong> — {formatCurrency(Number(e.price), currency)}{!e.is_active && ' (inativo)'}</span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => toggleEdgeActive(e.id, e.is_active)}>{e.is_active ? 'Desativar' : 'Ativar'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => deleteEdge(e.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Configurações Marmitas */}
            <TabsContent value="marmitas" className="space-y-8 mt-6">
              {menuConfigLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Tamanhos de Marmita */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Tamanhos (Pesos)</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSize(!showFormMarmitaSize)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormMarmitaSize && (
                        <form onSubmit={handleSubmitMarmitaSize} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formMarmitaSize.name} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: 300g, 500g, 700g" required />
                            </div>
                            <div>
                              <Label>Peso (gramas)</Label>
                              <Input type="number" min={100} step={50} value={formMarmitaSize.weight_grams} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, weight_grams: parseInt(e.target.value, 10) || 500 }))} required />
                            </div>
                            <div>
                              <Label>Preço Base ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formMarmitaSize.base_price} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, base_price: e.target.value }))} placeholder="15,00" required />
                            </div>
                            <div>
                              <Label>Preço por Grama ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formMarmitaSize.price_per_gram} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,05" />
                            </div>
                            <div>
                              <Label>Ordem</Label>
                              <Input type="number" min={0} value={formMarmitaSize.order_index} onChange={(e) => setFormMarmitaSize((f) => ({ ...f, order_index: parseInt(e.target.value, 10) || 0 }))} />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSize(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {marmitaSizes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tamanho. Adicione para o cliente escolher no cardápio.</p>}
                        {marmitaSizes.map((s) => (
                          <li key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{s.name}</strong> — {s.weight_grams}g — Base: {formatCurrency(Number(s.base_price), currency)} {Number(s.price_per_gram) > 0 && `— ${formatCurrency(Number(s.price_per_gram), currency)}/g`}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSize(s.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Proteínas */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Proteínas</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaProtein(!showFormMarmitaProtein)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormMarmitaProtein && (
                        <form onSubmit={handleSubmitMarmitaProtein} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="space-y-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formMarmitaProtein.name} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Frango Grelhado" required />
                            </div>
                            <div>
                              <Label>Descrição (opcional)</Label>
                              <Input value={formMarmitaProtein.description} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Peito de frango temperado e grelhado" />
                            </div>
                            <div>
                              <Label>Preço por Grama ({getCurrencySymbol(currency)})</Label>
                              <Input type="text" value={formMarmitaProtein.price_per_gram} onChange={(e) => setFormMarmitaProtein((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,08" required />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaProtein(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {marmitaProteins.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma proteína. Adicione (ex: Frango, Carne, Peixe).</p>}
                        {marmitaProteins.map((p) => (
                          <li key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{p.name}</strong> — {formatCurrency(Number(p.price_per_gram), currency)}/g{!p.is_active && ' (inativo)'}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaProtein(p.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Acompanhamentos */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Acompanhamentos</CardTitle>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSide(!showFormMarmitaSide)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showFormMarmitaSide && (
                        <form onSubmit={handleSubmitMarmitaSide} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="space-y-3">
                            <div>
                              <Label>Nome</Label>
                              <Input value={formMarmitaSide.name} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Arroz Branco" required />
                            </div>
                            <div>
                              <Label>Descrição (opcional)</Label>
                              <Input value={formMarmitaSide.description} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Arroz soltinho" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label>Categoria</Label>
                                <Input value={formMarmitaSide.category} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Arroz, Feijão, Salada" />
                              </div>
                              <div>
                                <Label>Preço por Grama ({getCurrencySymbol(currency)})</Label>
                                <Input type="text" value={formMarmitaSide.price_per_gram} onChange={(e) => setFormMarmitaSide((f) => ({ ...f, price_per_gram: e.target.value }))} placeholder="0,02" required />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="submit" size="sm" className="flex-1">Salvar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowFormMarmitaSide(false)} className="flex-1">Cancelar</Button>
                          </div>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {marmitaSides.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acompanhamento. Adicione (ex: Arroz, Feijão, Salada).</p>}
                        {marmitaSides.map((s) => (
                          <li key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                            <span className="text-sm"><strong>{s.name}</strong> {s.category && `(${s.category})`} — {formatCurrency(Number(s.price_per_gram), currency)}/g{!s.is_active && ' (inativo)'}</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteMarmitaSide(s.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
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
                    form.category === 'Pizza'
                      ? 'Ex: Margherita, Calabresa'
                      : form.category === 'Bebidas'
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
                  value={form.category}
                  onValueChange={handleCategoryChange}
                  required
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_CARDAPIO.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                        {cat.isPizza && ' (tamanhos e sabores)'}
                        {cat.isMarmita && ' (monte sua marmita)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mensagens informativas */}
            {getCategoryConfig(form.category).isPizza && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>pizza</strong>. O cliente poderá escolher tamanho, sabores e borda na hora do pedido. Configure nas <strong>Configurações</strong>.
                </span>
              </div>
            )}

            {getCategoryConfig(form.category).isMarmita && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>marmita</strong>. O cliente poderá escolher tamanho (peso), proteínas e acompanhamentos na hora do pedido. Configure nas <strong>Configurações</strong>.
                </span>
              </div>
            )}

            {/* Campo extra e Descrição em Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getCategoryConfig(form.category).extraField && (
                <div className="space-y-2">
                  <Label htmlFor="categoryDetail">
                    {getCategoryConfig(form.category).extraLabel}
                  </Label>
                  <Input
                    id="categoryDetail"
                    value={form.categoryDetail}
                    onChange={(e) => setForm((f) => ({ ...f, categoryDetail: e.target.value }))}
                    placeholder={getCategoryConfig(form.category).extraPlaceholder}
                    className="text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="price">
                  {getCategoryConfig(form.category).priceLabel ? `${getCategoryConfig(form.category).priceLabel} (${getCurrencySymbol(currency)}) *` : `Preço (${getCurrencySymbol(currency)}) *`}
                </Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0,00"
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
                  form.category === 'Pizza'
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
