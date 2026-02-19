import { useState, useEffect, useRef } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { convertPriceToStorage, convertPriceFromStorage, formatPriceInputPyG } from '@/lib/priceHelper';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Upload, Download, Trash2, Edit, Check, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export default function ProductsInventory() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    price_sale: '',
    price_cost: '',
    sku: '',
    description: '',
    is_by_weight: false,
    is_active: true,
  });

  useEffect(() => {
    if (restaurantId) {
      loadProducts();
    }
  }, [restaurantId]);

  const loadProducts = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({ title: 'Erro ao carregar produtos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        price: convertPriceFromStorage(Number(product.price), currency),
        price_sale: convertPriceFromStorage(Number(product.price_sale || product.price), currency),
        price_cost: product.price_cost ? convertPriceFromStorage(Number(product.price_cost), currency) : '',
        sku: product.sku || '',
        description: product.description || '',
        is_by_weight: product.is_by_weight || false,
        is_active: product.is_active,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: '',
        price: '',
        price_sale: '',
        price_cost: '',
        sku: '',
        description: '',
        is_by_weight: false,
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!restaurantId) return;

    try {
      const price = convertPriceToStorage(formData.price, currency);
      const priceSale = convertPriceToStorage(formData.price_sale || formData.price, currency);
      const priceCost = formData.price_cost ? convertPriceToStorage(formData.price_cost, currency) : null;

      const productData = {
        restaurant_id: restaurantId,
        name: formData.name.trim(),
        category: formData.category.trim(),
        price,
        price_sale: priceSale,
        price_cost: priceCost,
        sku: formData.sku.trim() || null,
        description: formData.description.trim() || null,
        is_by_weight: formData.is_by_weight,
        is_active: formData.is_active,
        is_pizza: false,
        is_marmita: false,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) throw error;
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) throw error;
        toast({ title: 'Produto cadastrado com sucesso!' });
      }

      setShowDialog(false);
      await loadProducts();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      toast({ 
        title: 'Erro ao salvar produto', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      toast({ title: 'Produto excluído com sucesso!' });
      await loadProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({ title: 'Arquivo CSV inválido', variant: 'destructive' });
        return;
      }

      // Cabeçalho esperado: name,category,price,price_sale,price_cost,sku,description,is_by_weight
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const productsToImport: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < headers.length) continue;

        const product: any = {
          restaurant_id: restaurantId,
          is_pizza: false,
          is_marmita: false,
          is_active: true,
        };

        headers.forEach((header, index) => {
          const value = values[index];
          if (header === 'name') product.name = value;
          else if (header === 'category') product.category = value;
          else if (header === 'price') product.price = parseFloat(value) || 0;
          else if (header === 'price_sale') product.price_sale = parseFloat(value) || product.price;
          else if (header === 'price_cost') product.price_cost = parseFloat(value) || null;
          else if (header === 'sku') product.sku = value || null;
          else if (header === 'description') product.description = value || null;
          else if (header === 'is_by_weight') product.is_by_weight = value.toLowerCase() === 'true' || value === '1';
        });

        if (product.name) {
          productsToImport.push(product);
        }
      }

      if (productsToImport.length === 0) {
        toast({ title: 'Nenhum produto válido encontrado no CSV', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('products')
        .insert(productsToImport);

      if (error) throw error;

      toast({ title: `${productsToImport.length} produto(s) importado(s) com sucesso!` });
      setShowImportDialog(false);
      await loadProducts();
    } catch (error: any) {
      console.error('Erro ao importar CSV:', error);
      toast({ 
        title: 'Erro ao importar CSV', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ['name', 'category', 'price', 'price_sale', 'price_cost', 'sku', 'description', 'is_by_weight'];
    const rows = products.map(p => [
      p.name,
      p.category,
      p.price.toString(),
      (p.price_sale || p.price).toString(),
      (p.price_cost || '').toString(),
      p.sku || '',
      p.description || '',
      p.is_by_weight ? 'true' : 'false',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cadastro de Produtos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie produtos, bebidas e itens do buffet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="inline-flex"
          >
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800">
          Cadastre o preço de custo para desbloquear a inteligência artificial do seu cardápio.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="dark:bg-slate-900">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preço de Venda</span>
                    <span className="font-bold">{formatCurrency(product.price_sale || product.price, currency)}</span>
                  </div>
                  {product.price_cost && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Custo</span>
                      <span className="text-sm">{formatCurrency(product.price_cost, currency)}</span>
                    </div>
                  )}
                  {product.sku && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">SKU</span>
                      <span className="text-sm font-mono">{product.sku}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {product.is_by_weight && (
                      <Badge variant="secondary">Por Peso</Badge>
                    )}
                    {product.is_active ? (
                      <Badge variant="default" className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" />
                        Inativo
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Refrigerante"
                />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Bebidas"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Preço Base *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    })
                  }
                  placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                />
              </div>
              <div>
                <Label>Preço de Venda</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.price_sale}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_sale: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    })
                  }
                  placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                />
              </div>
              <div>
                <Label>Custo (CMV)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.price_cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_cost: currency === 'PYG' ? formatPriceInputPyG(e.target.value) : e.target.value,
                    })
                  }
                  placeholder={currency === 'PYG' ? '25.000' : '0,00'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SKU</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Código do produto"
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="is_by_weight"
                  checked={formData.is_by_weight}
                  onCheckedChange={(checked: boolean) => 
                    setFormData({ ...formData, is_by_weight: checked === true })
                  }
                />
                <Label htmlFor="is_by_weight" className="cursor-pointer">
                  Vendido por peso (Buffet)
                </Label>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) => 
                  setFormData({ ...formData, is_active: checked === true })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Produto ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingProduct ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação CSV */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Produtos via CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Formato esperado (separado por vírgulas):<br />
              <code className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded block mt-2">
                name,category,price,price_sale,price_cost,sku,description,is_by_weight<br />
                Refrigerante,Bebidas,5.00,6.00,3.50,REF001,Refrigerante gelado,false
              </code>
              <span className="block mt-2 text-muted-foreground">Os valores (price, price_sale, price_cost) devem estar na moeda configurada do restaurante ({currency === 'PYG' ? 'Guaraní' : 'Real'}).</span>
            </p>
            <div>
              <Label>Arquivo CSV</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
