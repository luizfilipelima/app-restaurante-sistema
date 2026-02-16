import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { ShoppingCart, Phone, MapPin, Clock, Star, Search, ChevronRight, Utensils, Coffee, IceCream } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import ProductCard from '@/components/public/ProductCard';
import CartDrawer from '@/components/public/CartDrawer';
import PizzaModal from '@/components/public/PizzaModal';

// MOCK DATA PARA VISUALIZAÇÃO DE DESIGN (Caso banco vazio)
const MOCK_PRODUCTS: Product[] = [
  { id: 'm1', restaurant_id: '1', category: 'Pizza', name: 'Pizza Margherita Premium', description: 'Molho de tomate artesanal, mozzarella di bufala, manjericão fresco e azeite trufado.', price: 45.90, image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm2', restaurant_id: '1', category: 'Pizza', name: 'Pepperoni Speciale', description: 'Pepperoni crocante, queijo mozzarella e orégano.', price: 49.90, image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm3', restaurant_id: '1', category: 'Pizza', name: 'Quatro Queijos', description: 'Mozzarella, gorgonzola, parmesão e catupiry original.', price: 52.90, image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', is_pizza: true, is_active: true, created_at: '', updated_at: '' },
  { id: 'm4', restaurant_id: '1', category: 'Bebidas', name: 'Coca-Cola 2L', description: 'Refrigerante gelado.', price: 12.00, image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80', is_pizza: false, is_active: true, created_at: '', updated_at: '' },
  { id: 'm5', restaurant_id: '1', category: 'Sobremesas', name: 'Petit Gâteau', description: 'Bolo de chocolate com recheio cremoso e sorvete de creme.', price: 24.90, image_url: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80', is_pizza: false, is_active: true, created_at: '', updated_at: '' },
];

const CATEGORY_ICONS: Record<string, any> = {
  'Pizza': Utensils,
  'Bebidas': Coffee,
  'Sobremesas': IceCream,
  'default': Utensils
};

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
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', restaurantSlug)
        .eq('is_active', true)
        .single();

      if (restaurantData) {
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

        if (productsData && productsData.length > 0) {
          setProducts(productsData);
          const uniqueCategories = Array.from(new Set(productsData.map((p) => p.category)));
          setCategories(uniqueCategories);
        } else {
          // Fallback para Mock Data se não houver produtos no banco
          setProducts(MOCK_PRODUCTS);
          setCategories(['Pizza', 'Bebidas', 'Sobremesas']);
        }

        // Buscar dados de pizza
        const [sizesRes, flavorsRes, doughsRes, edgesRes] = await Promise.all([
          supabase.from('pizza_sizes').select('*').eq('restaurant_id', restaurantData.id).order('order_index'),
          supabase.from('pizza_flavors').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
          supabase.from('pizza_doughs').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
          supabase.from('pizza_edges').select('*').eq('restaurant_id', restaurantData.id).eq('is_active', true).order('name'),
        ]);

        if (sizesRes.data) setPizzaSizes(sizesRes.data);
        if (flavorsRes.data) setPizzaFlavors(flavorsRes.data);
        if (doughsRes.data) setPizzaDoughs(doughsRes.data);
        if (edgesRes.data) setPizzaEdges(edgesRes.data);
      }
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
      useCartStore.getState().addItem({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      });
      
      toast({
        title: "✅ Adicionado ao carrinho!",
        description: `${product.name} foi adicionado`,
        className: "bg-green-50 border-green-200",
      });
    }
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-64 bg-slate-200 animate-pulse" />
        <div className="container mx-auto px-4 -mt-20 relative z-10">
          <div className="bg-white rounded-xl p-6 shadow-md space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl h-64 shadow-sm p-4 space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) return <div>Restaurante não encontrado</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Hero Banner / Header */}
      <div className="relative h-[280px] md:h-[350px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        <img 
          src="https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=1600&q=80" 
          alt="Banner Pizzaria" 
          className="w-full h-full object-cover"
        />
        
        {/* Top Bar Floating */}
        <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center">
          <div className="bg-white/90 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-2 shadow-lg">
            <div className={`w-2 h-2 rounded-full ${restaurant.is_active ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-xs font-bold text-slate-800">{restaurant.is_active ? 'ABERTO' : 'FECHADO'}</span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-white/90 backdrop-blur-md text-orange-500 hover:bg-white shadow-lg relative"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            {getItemsCount() > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white border-2 border-white">
                {getItemsCount()}
              </Badge>
            )}
          </Button>
        </div>

        {/* Restaurant Info Card */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 transform translate-y-8 md:translate-y-10">
          <div className="container mx-auto">
            <div className="bg-white rounded-2xl shadow-premium p-4 md:p-6 flex items-start gap-4">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-slate-100">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-500 font-bold text-2xl">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate mb-1">{restaurant.name}</h1>
                <div className="flex flex-wrap gap-y-1 gap-x-3 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-slate-900">4.8</span>
                    <span className="text-slate-400">(120+)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>30-45 min</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <span className="text-xs px-2 py-0.5 bg-green-100 rounded-full">Entrega Grátis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-16 md:mt-20 space-y-8">
        
        {/* Search & Categories */}
        <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm py-2 -mx-4 px-4 border-b border-slate-200/50">
          <div className="relative mb-4 container mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="O que você procura hoje?" 
              className="pl-10 bg-white border-slate-200 shadow-sm rounded-xl focus-visible:ring-orange-500"
            />
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide container mx-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex flex-col items-center gap-1 min-w-[70px] p-2 rounded-xl transition-all ${
                selectedCategory === 'all' 
                  ? 'bg-orange-500 text-white shadow-md scale-105' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-200'
              }`}
            >
              <div className={`p-2 rounded-full ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>
                <Utensils className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold">Todos</span>
            </button>

            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex flex-col items-center gap-1 min-w-[70px] p-2 rounded-xl transition-all ${
                    selectedCategory === category
                      ? 'bg-orange-500 text-white shadow-md scale-105'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-200'
                  }`}
                >
                  <div className={`p-2 rounded-full ${selectedCategory === category ? 'bg-white/20' : 'bg-slate-100'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap">{category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Destaques / Ofertas (Simulado) */}
        {selectedCategory === 'all' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">🔥 Ofertas do Dia</h2>
              <button className="text-sm text-orange-600 font-semibold flex items-center">
                Ver todas <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
              {filteredProducts.slice(0, 3).map((product) => (
                <div key={product.id} className="min-w-[280px] snap-center">
                  <ProductCard 
                    product={product} 
                    onClick={() => handleProductClick(product)} 
                    featured 
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lista de Produtos */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {selectedCategory === 'all' ? 'Cardápio Completo' : selectedCategory}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => handleProductClick(product)}
              />
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500">Nenhum produto encontrado nesta categoria.</p>
            </div>
          )}
        </section>
      </div>

      {/* Cart FAB (Mobile only when scroll) */}
      {getItemsCount() > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40 md:hidden">
          <Button
            className="w-full h-14 rounded-full bg-orange-600 text-white shadow-xl hover:bg-orange-700 flex items-center justify-between px-6 transition-transform active:scale-95"
            onClick={() => navigate(`/${restaurantSlug}/checkout`)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                {getItemsCount()}
              </div>
              <span className="font-semibold text-lg">Ver Carrinho</span>
            </div>
            <span className="font-bold text-lg">
              {/* Preço total seria calculado aqui */}
              Ir <ChevronRight className="inline h-5 w-5 ml-1" />
            </span>
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