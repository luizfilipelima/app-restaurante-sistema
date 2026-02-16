import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { ShoppingCart, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
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
      
      toast({
        title: "✅ Adicionado ao carrinho!",
        description: `${product.name} foi adicionado`,
        variant: "success",
      });
    }
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        {/* Header Skeleton */}
        <div className="bg-gradient-primary text-white">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Skeleton */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24" />
              ))}
            </div>
          </div>
        </div>

        {/* Products Skeleton */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">Restaurante não encontrado</h1>
          <p className="text-muted-foreground text-lg">
            Verifique se o link está correto ou entre em contato com o estabelecimento.
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-6"
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 pb-24">
      {/* Hero Header */}
      <div className="gradient-primary text-white sticky top-0 z-40 shadow-premium-lg">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              {restaurant.logo && (
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-2xl object-cover bg-white ring-4 ring-white/30 shadow-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl md:text-3xl font-bold truncate mb-1">
                  {restaurant.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-white/90">
                  <a
                    href={`tel:${restaurant.phone}`}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                  <Phone className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">{restaurant.phone}</span>
                </a>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="relative h-12 w-12 md:h-14 md:w-14 rounded-xl shadow-lg hover:scale-105 transition-transform flex-shrink-0"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              {getItemsCount() > 0 && (
                <Badge
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 gradient-secondary text-white border-2 border-white font-bold"
                >
                  {getItemsCount()}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filtro de Categorias */}
      <div className="bg-white/80 backdrop-blur-sm border-b shadow-sm sticky top-[104px] md:top-[120px] z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={`whitespace-nowrap transition-all ${
                selectedCategory === 'all' 
                  ? 'gradient-primary shadow-md scale-105' 
                  : 'hover:border-primary hover:text-primary'
              }`}
            >
              🍽️ Todos
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap transition-all ${
                  selectedCategory === category 
                    ? 'gradient-primary shadow-md scale-105' 
                    : 'hover:border-primary hover:text-primary'
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Produtos */}
      <div className="container mx-auto px-4 py-8">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <div 
                key={product.id}
                className="animate-slide-in-bottom"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <ProductCard
                  product={product}
                  onClick={() => handleProductClick(product)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Não há produtos disponíveis nesta categoria no momento.
            </p>
            <Button 
              variant="outline"
              onClick={() => setSelectedCategory('all')}
            >
              Ver todos os produtos
            </Button>
          </div>
        )}
      </div>

      {/* Botão flutuante de ir para o carrinho */}
      {getItemsCount() > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-50 px-4 animate-slide-in-bottom">
          <Button
            className="w-full max-w-md mx-auto gradient-primary shadow-premium-lg hover:shadow-premium-lg hover:scale-[1.02] transition-all text-base md:text-lg font-semibold"
            size="lg"
            onClick={() => navigate(`/${restaurantSlug}/checkout`)}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Ver Carrinho • {getItemsCount()} {getItemsCount() === 1 ? 'item' : 'itens'}
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
