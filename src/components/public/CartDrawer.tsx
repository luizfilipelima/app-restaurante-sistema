import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Trash2, MessageCircle, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { fetchUpsellsForProducts, type UpsellRow } from '@/hooks/queries';
import type { CartItem } from '@/types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  currency?: CurrencyCode;
}

export default function CartDrawer({ open, onClose, onCheckout, currency = 'BRL' }: CartDrawerProps) {
  const { t } = useTranslation();
  const { items, addItem, updateQuantity, removeItem, getSubtotal } = useCartStore();
  const [upsellRows, setUpsellRows] = useState<UpsellRow[]>([]);

  useEffect(() => {
    if (!open || items.length === 0) { setUpsellRows([]); return; }
    const cartProductIds = items
      .filter((i) => !!i.productId)
      .map((i) => i.productId as string);
    if (!cartProductIds.length) { setUpsellRows([]); return; }

    fetchUpsellsForProducts(cartProductIds).then((byProduct) => {
      // Priorizar: produto mais caro → último adicionado
      const mostExpensive = [...items]
        .filter((i) => !!i.productId)
        .sort((a, b) => b.unitPrice * b.quantity - a.unitPrice * a.quantity)[0];
      const lastAdded = [...items].filter((i) => !!i.productId).slice(-1)[0];
      const priorityId = mostExpensive?.productId || lastAdded?.productId;

      const alreadyInCart = new Set(items.map((i) => i.productId).filter(Boolean) as string[]);

      let suggestions: UpsellRow[] = [];
      if (priorityId && byProduct[priorityId]) {
        suggestions = byProduct[priorityId].filter(
          (r) => r.upsell_product && r.upsell_product.is_active && !alreadyInCart.has(r.upsell_product_id)
        );
      }
      // Complementar com outros produtos se < 3
      if (suggestions.length < 3) {
        for (const pid of cartProductIds) {
          if (pid === priorityId) continue;
          const extra = (byProduct[pid] || []).filter(
            (r) => r.upsell_product && r.upsell_product.is_active && !alreadyInCart.has(r.upsell_product_id) &&
              !suggestions.some((s) => s.upsell_product_id === r.upsell_product_id)
          );
          suggestions = [...suggestions, ...extra];
          if (suggestions.length >= 3) break;
        }
      }
      setUpsellRows(suggestions.slice(0, 3));
    }).catch(() => setUpsellRows([]));
  }, [open, items]);

  const addUpsellToCart = (row: UpsellRow) => {
    const p = row.upsell_product;
    if (!p) return;
    const cartItem: CartItem = {
      productId: p.id,
      productName: p.name,
      quantity: 1,
      unitPrice: Number(p.price_sale || p.price),
      isUpsell: true,
    };
    addItem(cartItem);
    // Remove da lista de sugestões
    setUpsellRows((prev) => prev.filter((r) => r.upsell_product_id !== row.upsell_product_id));
  };

  const handleCheckout = () => {
    onClose();
    onCheckout();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 safe-area-inset-bottom">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <DialogTitle className="text-lg sm:text-xl">{t('cart.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-6 scroll-smooth">
          {items.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <p className="text-muted-foreground text-sm sm:text-base">{t('cart.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* ── Aproveite Também (Upsell) ── */}
              {upsellRows.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('cart.upsellTitle')}
                  </div>
                  <div className="space-y-1.5">
                    {upsellRows.map((row) => {
                      const p = row.upsell_product;
                      if (!p) return null;
                      const price = Number(p.price_sale || p.price);
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-800 p-2"
                        >
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
                              🍽
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(price, currency)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-full border-amber-300 text-amber-700 hover:bg-amber-100 active:scale-95 touch-manipulation flex-shrink-0"
                            onClick={() => addUpsellToCart(row)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {items.map((item, index) => {
                const itemTotal = item.unitPrice * item.quantity;

                return (
                  <div
                    key={index}
                    className="border rounded-xl sm:rounded-lg p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-white"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base leading-tight">{item.productName}</h4>
                        
                        {item.isPizza && (
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                            {item.pizzaSize && <p>{t('cart.size')}: {item.pizzaSize}</p>}
                            {item.pizzaFlavors && item.pizzaFlavors.length > 0 && (
                              <p className="line-clamp-2">
                                {t('cart.flavors')}: {item.pizzaFlavors.join(', ')}
                              </p>
                            )}
                            {item.pizzaDough && <p>{t('cart.dough')}: {item.pizzaDough}</p>}
                            {item.pizzaEdge && <p>{t('cart.edge')}: {item.pizzaEdge}</p>}
                          </div>
                        )}
                        
                        {item.observations && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 line-clamp-2">
                            {t('cart.obs')}: {item.observations}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 touch-manipulation active:scale-95"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                        >
                          <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <span className="w-8 sm:w-10 text-center text-sm sm:text-base font-semibold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                      <span className="font-semibold text-sm sm:text-base">
                        {formatCurrency(itemTotal, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <DialogFooter className="flex flex-col md:flex-row md:items-start gap-4 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t bg-slate-50/50">
            <div className="flex-1 min-w-0 md:max-w-sm rounded-xl bg-sky-50 border border-sky-200 p-3 sm:p-4 flex gap-2 sm:gap-3">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs sm:text-sm text-sky-800">
                <p className="font-semibold">{t('cart.sendLocationTitle')}</p>
                <p className="text-sky-700 mt-0.5 leading-relaxed">{t('cart.sendLocationDesc')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:min-w-[200px] md:shrink-0">
              <div className="flex justify-between items-center text-base sm:text-lg font-bold">
                <span>{t('cart.subtotal')}:</span>
                <span>{formatCurrency(getSubtotal(), currency)}</span>
              </div>
              <Button 
                size="lg" 
                onClick={handleCheckout} 
                className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl touch-manipulation active:scale-[0.98]"
              >
                {t('cart.finalize')}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
