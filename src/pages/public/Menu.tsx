import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Restaurant, Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useRestaurantStore } from '@/store/restaurantStore';
import { ShoppingCart, Clock, Search, ChevronRight, Utensils, Coffee, IceCream } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { isWithinOpeningHours } from '@/lib/utils';
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

  const hasHours = restaurant.opening_hours && Object.keys(restaurant.opening_hours).length > 0;
  const isOpen = restaurant.is_manually_closed
    ? false
    : hasHours
      ? isWithinOpeningHours(restaurant.opening_hours as Record<string, { open: string; close: string } | null>)
      : restaurant.is_active;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header compacto sem banner */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-slate-100">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-500 font-bold text-xl">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{restaurant.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  <span className="text-sm font-medium text-slate-600">{isOpen ? 'Aberto' : 'Fechado'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> 30–45 min
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg border-0 px-5 py-6 h-auto gap-2 font-bold text-base relative min-w-[140px] flex-shrink-0"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="hidden sm:inline">Ver Carrinho</span>
              {getItemsCount() > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-6 min-w-6 flex items-center justify-center px-1.5 py-0 bg-red-600 text-white border-2 border-white text-xs font-bold">
                  {getItemsCount()}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Search & Categories */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-white border-b border-slate-200 rounded-b-2xl shadow-sm">
          {/* Faixa laranja no topo */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-orange-400 to-orange-500" aria-hidden />
          <div className="container mx-auto space-y-4">
            {/* Campo de busca: lupa dentro do input */}
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500 pointer-events-none z-10" />
              <Input
                placeholder="O que você procura hoje?"
                className="w-full h-12 pl-11 pr-4 bg-slate-50 border-slate-200 rounded-xl border-2 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Categorias */}
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex flex-col items-center gap-1 min-w-[72px] p-3 rounded-xl transition-all flex-shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-200 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-orange-50 hover:border-orange-200'
                }`}
              >
                <div className={`p-2 rounded-full ${selectedCategory === 'all' ? 'bg-white/25' : 'bg-white'}`}>
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
                    className={`flex flex-col items-center gap-1 min-w-[72px] p-3 rounded-xl transition-all flex-shrink-0 ${
                      selectedCategory === category
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-200 scale-[1.02]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-orange-50 hover:border-orange-200'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${selectedCategory === category ? 'bg-white/25' : 'bg-white'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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

      {/* Cart FAB (Mobile) */}
      {getItemsCount() > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40 md:hidden">
          <Button
            className="w-full h-16 rounded-2xl bg-orange-500 text-white shadow-2xl hover:bg-orange-600 flex items-center justify-between px-6 transition-transform active:scale-98 font-bold text-lg border-0"
            onClick={() => navigate(`/${restaurantSlug}/checkout`)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/25 px-3 py-1.5 rounded-xl text-sm font-bold">
                {getItemsCount()} {getItemsCount() === 1 ? 'item' : 'itens'}
              </div>
              <span>Ver Carrinho</span>
            </div>
            <span className="flex items-center gap-1">Finalizar <ChevronRight className="h-5 w-5" /></span>
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