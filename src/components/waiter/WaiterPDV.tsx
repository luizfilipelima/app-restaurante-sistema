/**
 * PDV de Bolso do Garçom — Interface otimizada para celular/tablet
 *
 * Layout: categorias em scroll horizontal, grid de produtos, carrinho em bottom sheet.
 * Input opcional "Nome do Cliente na Mesa" para divisão de conta.
 * Botão gigante "Enviar para Cozinha".
 */

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/priceHelper';
import { ArrowLeft, Send, Plus, Minus, Trash2, Loader2, User } from 'lucide-react';
import { toast } from '@/hooks/shared/use-toast';
import type { Product } from '@/types';
import type { TableWithStatus } from '@/hooks/queries';
import { cn } from '@/lib/core/utils';

export interface WaiterPDVItem {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  observations?: string;
  pizzaSize?: string;
  pizzaFlavors?: string[];
  pizzaDough?: string;
  pizzaEdge?: string;
  addons?: Array<{ addonItemId: string; name: string; price: number }>;
}

interface WaiterPDVProps {
  table: TableWithStatus;
  restaurantId: string;
  currency: string;
  products: Product[];
  onOrderPlaced: () => void;
  onBack: () => void;
}

export function WaiterPDV({ table, restaurantId, currency, products, onOrderPlaced, onBack }: WaiterPDVProps) {
  const [cart, setCart] = useState<WaiterPDVItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category || 'Outros'))].sort();
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => (p.category || 'Outros') === selectedCategory);
  }, [products, selectedCategory]);

  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const customerNameForItems = customerName.trim() || null;

  const addSimpleProduct = (p: Product) => {
    const price = Number(p.price_sale ?? p.price);
    const existing = cart.find(
      (i) =>
        i.productId === p.id &&
        !i.pizzaSize &&
        !i.addons?.length &&
        !i.observations
    );
    if (existing) {
      setCart((prev) =>
        prev.map((item) =>
          item === existing
            ? {
                ...item,
                imageUrl: item.imageUrl ?? p.image_url ?? undefined,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice,
              }
            : item
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          imageUrl: p.image_url ?? undefined,
          quantity: 1,
          unitPrice: price,
          totalPrice: price,
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      const newQty = Math.max(0, item.quantity + delta);
      if (newQty === 0) return prev.filter((_, i) => i !== index);
      return prev.map((it, i) =>
        i === index
          ? { ...it, quantity: newQty, totalPrice: newQty * it.unitPrice }
          : it
      );
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      toast({ title: 'Adicione itens ao carrinho', variant: 'destructive' });
      return;
    }
    setPlacingOrder(true);
    try {
      const { data, error } = await supabase.rpc('place_order', {
        p_order: {
          restaurant_id: restaurantId,
          customer_name: `Mesa ${table.number}`,
          customer_phone: '5511999999999',
          delivery_type: 'pickup',
          delivery_fee: 0,
          subtotal,
          total: subtotal,
          payment_method: 'table',
          order_source: 'table',
          table_id: table.id,
          status: 'pending',
          notes: null,
          is_paid: false,
          loyalty_redeemed: false,
          discount_coupon_id: null,
          discount_amount: 0,
        },
        p_items: cart.map((i) => ({
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          total_price: i.totalPrice,
          observations: i.observations ?? null,
          pizza_size: i.pizzaSize ?? null,
          pizza_flavors: i.pizzaFlavors ?? null,
          pizza_dough: i.pizzaDough ?? null,
          pizza_edge: i.pizzaEdge ?? null,
          is_upsell: false,
          addons: i.addons?.length ? i.addons : null,
          customer_name: customerNameForItems,
        })),
      });
      if (error) throw error;
      if (data && !(data as { ok?: boolean }).ok) throw new Error((data as { error?: string }).error);
      onOrderPlaced();
      toast({ title: 'Pedido enviado para a cozinha!' });
    } catch {
      toast({ title: 'Erro ao enviar pedido', variant: 'destructive' });
    } finally {
      setPlacingOrder(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b bg-white px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900">Mesa {table.number}</h2>
          <p className="text-xs text-muted-foreground">PDV — Adicione itens e envie para a cozinha</p>
        </div>
      </header>

      {/* Categorias — scroll horizontal */}
      {categories.length > 0 && (
        <div className="shrink-0 overflow-x-auto border-b bg-white px-4 py-2 scrollbar-thin">
          <div className="flex gap-2 min-w-max pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                  selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Produtos + Carrinho lado a lado em desktop, empilhado em mobile */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Grid de Produtos */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const price = Number(p.price_sale ?? p.price);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addSimpleProduct(p)}
                  className="flex items-stretch gap-3 rounded-xl border bg-white p-3 text-left shadow-sm hover:shadow-md active:scale-[0.98] transition-all touch-manipulation overflow-hidden"
                >
                  <div className="w-14 h-14 min-w-14 min-h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xl opacity-25">🍽</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="font-medium text-slate-900 line-clamp-2 text-sm">{p.name}</span>
                    <span className="mt-1 text-base font-bold text-primary">
                      {formatPrice(price, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto nesta categoria.</p>
          )}
        </div>

        {/* Carrinho — sidebar em tablet, bottom sheet em mobile */}
        <div
          className={cn(
            'shrink-0 border-t md:border-t-0 md:border-l bg-white flex flex-col',
            isMobile ? 'max-h-[45vh]' : 'w-[340px]'
          )}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Nome do cliente na mesa
            </Label>
            <Input
              placeholder="Ex: Carlos (opcional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-11"
            />

            <div>
              <h3 className="font-semibold text-sm mb-2">Carrinho ({cart.length} itens)</h3>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Toque nos produtos para adicionar.</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((item, i) => (
                    <li
                      key={`${item.productId}-${i}`}
                      className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5 text-sm overflow-hidden"
                    >
                      <div className="w-12 h-12 min-w-12 min-h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover object-center"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-lg opacity-25">🍽</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{item.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatPrice(item.unitPrice, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')} × {item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(i, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-6 text-center font-medium tabular-nums">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(i, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="shrink-0 p-4 border-t space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}</span>
            </div>
            <Button
              className="w-full h-14 text-lg font-bold touch-manipulation"
              disabled={cart.length === 0 || placingOrder}
              onClick={handleSendToKitchen}
            >
              {placingOrder ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Send className="h-6 w-6 mr-2" />
                  Enviar para Cozinha
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
