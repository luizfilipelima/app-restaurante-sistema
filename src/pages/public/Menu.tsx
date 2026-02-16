import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { ShoppingCart, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProductCard from '@/components/public/ProductCard';
import CartDrawer from '@/components/public/CartDrawer';
import PizzaModal from '@/components/public/PizzaModal';

export default function PublicMenu() {
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  
  // Estados para pizza
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaFlavors, setPizzaFlavors] = useState<PizzaFlavor[]>([]);
  const [pizzaDoughs, setPizzaDoughs] = useState<PizzaDough[]>([]);
  const [pizzaEdges, setPizzaEdges] = useState<PizzaEdge[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pizzaModalOpen, setPizzaModalOpen] = useState(false);

  const { getItemsCount, setRestaurant: setCartRestaurant } = useCartStore();
  const { setCurrentRestaurant } = useRestaurantStore();

  useEffect(() => {
    loadRestaurantData();
  }, [restaurantSlug]);

  const loadRestaurantData = async () => {
    if (!restaurantSlug) return;

    try {
      setLoading(true);

      // Buscar restaurante
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', restaurantSlug)
        .eq('is_active', true)
        .single();

      if (restaurantError || !restaurantData) {
        console.error('Restaurante não encontrado');
        return;
      }

      setRestaurant(restaurantData);
      setCurrentRestaurant(restaurantData);
      setCartRestaurant(restaurantData.id);

      // Buscar produtos
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (productsData) {
        setProducts(productsData);
        
        // Extrair categorias únicas
        const uniqueCategories = Array.from(
          new Set(productsData.map((p) => p.category))
        );
        setCategories(uniqueCategories);
      }

      // Buscar dados de pizza
      const [sizesRes, flavorsRes, doughsRes, edgesRes] = await Promise.all([
        supabase
          .from('pizza_sizes')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .order('order_index'),
        supabase
          .from('pizza_flavors')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pizza_doughs')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('pizza_edges')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (sizesRes.data) setPizzaSizes(sizesRes.data);
      if (flavorsRes.data) setPizzaFlavors(flavorsRes.data);
      if (doughsRes.data) setPizzaDoughs(doughsRes.data);
      if (edgesRes.data) setPizzaEdges(edgesRes.data);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.is_pizza) {
      setSelectedProduct(product);
      setPizzaModalOpen(true);
    } else {
      // Adicionar produto simples direto ao carrinho
      useCartStore.getState().addItem({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      });
    }
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Restaurante não encontrado</h1>
        <p className="text-muted-foreground">
          Verifique se o link está correto.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground sticky top-0 z-40 shadow-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {restaurant.logo && (
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  className="h-12 w-12 rounded-full object-cover bg-white"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{restaurant.name}</h1>
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-1 text-sm opacity-90 hover:opacity-100"
                >
                  <Phone className="h-3 w-3" />
                  {restaurant.phone}
                </a>
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="relative"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {getItemsCount() > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0"
                >
                  {getItemsCount()}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filtro de Categorias */}
      <div className="bg-background border-b sticky top-[88px] z-30">
        <div className="container mx-auto px-4 py-3 overflow-x-auto">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              Todos
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Produtos */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => handleProductClick(product)}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum produto encontrado nesta categoria.
            </p>
          </div>
        )}
      </div>

      {/* Botão flutuante de ir para o carrinho */}
      {getItemsCount() > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
          <Button
            className="w-full max-w-md mx-auto shadow-lg"
            size="lg"
            onClick={() => navigate(`/${restaurantSlug}/checkout`)}
          >
            Ver Carrinho ({getItemsCount()} {getItemsCount() === 1 ? 'item' : 'itens'})
          </Button>
        </div>
      )}

      {/* Modais */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => navigate(`/${restaurantSlug}/checkout`)}
      />

      {selectedProduct && (
        <PizzaModal
          open={pizzaModalOpen}
          onClose={() => {
            setPizzaModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          sizes={pizzaSizes}
          flavors={pizzaFlavors}
          doughs={pizzaDoughs}
          edges={pizzaEdges}
        />
      )}
    </div>
  );
}
