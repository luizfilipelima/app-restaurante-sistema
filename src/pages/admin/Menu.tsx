import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { uploadProductImage } from '@/lib/imageUpload';
import { Plus, Edit, Trash2, Pizza, Loader2, Info, Upload } from 'lucide-react';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState(formDefaults);

  useEffect(() => {
    if (restaurantId) {
      loadProducts();
    }
  }, [restaurantId]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cardápio</h1>
            <p className="text-muted-foreground">
              Gerencie os produtos do seu cardápio
            </p>
          </div>
          <Button onClick={openNew}>
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
                <h2 className="text-2xl font-semibold capitalize">{category}</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryProducts.map((product) => (
                    <Card key={product.id}>
                      <div className="relative">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
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
                          <Badge
                            variant="destructive"
                            className="absolute top-2 left-2"
                          >
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-lg mb-1">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              toggleProductStatus(product.id, product.is_active)
                            }
                          >
                            {product.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => deleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Modal Adicionar/Editar Produto */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4">
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria do cardápio *</Label>
              <Select
                value={form.category}
                onValueChange={handleCategoryChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
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

            {getCategoryConfig(form.category).isPizza && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>pizza</strong>. O cliente poderá escolher tamanho, sabores e borda na hora do pedido. Configure tamanhos, sabores e bordas nas configurações do restaurante.
                </span>
              </div>
            )}

            {getCategoryConfig(form.category).isMarmita && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Produto configurado como <strong>marmita</strong>. O cliente poderá escolher tamanho (peso), proteínas e acompanhamentos na hora do pedido. Configure tamanhos, proteínas e acompanhamentos nas configurações do restaurante.
                </span>
              </div>
            )}

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
                />
              </div>
            )}

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
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">
                {getCategoryConfig(form.category).priceLabel || 'Preço (R$) *'}
              </Label>
              <Input
                id="price"
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Imagem do produto</Label>
              <p className="text-xs text-muted-foreground mb-2">
                PNG, JPG ou GIF. Será convertida para WebP (80%) para ficar leve e em boa qualidade.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <label className="cursor-pointer">
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
                        toast({ title: 'Imagem enviada e otimizada (WebP 80%)' });
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
                  <Button
                    type="button"
                    variant="outline"
                    className="pointer-events-none"
                    asChild
                  >
                    <span>
                      {imageUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando e otimizando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Escolher arquivo
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                {form.image_url && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    >
                      Remover imagem
                    </Button>
                  </div>
                )}
              </div>
              <div className="pt-1">
                <Label htmlFor="image_url_optional" className="text-xs text-muted-foreground">
                  Ou cole uma URL (link) da imagem
                </Label>
                <Input
                  id="image_url_optional"
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingProduct ? (
                  'Salvar'
                ) : (
                  'Adicionar ao cardápio'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
