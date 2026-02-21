import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Trash2, Sparkles, ShoppingBag, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUpsellsForProducts, type UpsellRow, useLoyaltyStatus } from '@/hooks/queries';
import type { CartItem } from '@/types';
import LoyaltyCard, { LoyaltyInvite } from './LoyaltyCard';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  currency?: CurrencyCode;
  restaurantId?: string | null;
  customerPhone?: string;
}

export default function CartDrawer({ open, onClose, onCheckout, currency = 'BRL', restaurantId, customerPhone }: CartDrawerProps) {
  const { t } = useTranslation();
  const { items, addItem, updateQuantity, removeItem, getSubtotal } = useCartStore();
  const [upsellRows, setUpsellRows] = useState<UpsellRow[]>([]);

  const { data: loyaltyStatus } = useLoyaltyStatus(
    open ? (restaurantId ?? null) : null,
    open ? (customerPhone ?? null) : null
  );

  useEffect(() => {
    if (!open || items.length === 0) { setUpsellRows([]); return; }
    const cartProductIds = items
      .filter((i) => !!i.productId)
      .map((i) => i.productId as string);
    if (!cartProductIds.length) { setUpsellRows([]); return; }

    fetchUpsellsForProducts(cartProductIds).then((byProduct) => {
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
    setUpsellRows((prev) => prev.filter((r) => r.upsell_product_id !== row.upsell_product_id));
  };

  const handleCheckout = () => {
    onClose();
    onCheckout();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 touch-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-[28px] shadow-2xl overflow-hidden"
            style={{ maxHeight: '92svh', paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.8 }}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing" onClick={onClose}>
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-500/20">
                  <ShoppingBag className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{t('cart.title')}</h2>
                {items.length > 0 && (
                  <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all"
              >
                <span className="text-sm font-bold">✕</span>
              </button>
            </div>

            {/* Loyalty banner */}
            {items.length > 0 && (
              loyaltyStatus
                ? <LoyaltyCard status={loyaltyStatus} compact />
                : loyaltyStatus === null && restaurantId
                  ? <LoyaltyInvite enabled={true} />
                  : null
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShoppingBag className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">{t('cart.empty')}</p>
                </div>
              ) : (
                <>
                  {/* Upsell */}
                  {upsellRows.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('cart.upsellTitle')}
                      </div>
                      <div className="space-y-1.5">
                        {upsellRows.map((row) => {
                          const p = row.upsell_product;
                          if (!p) return null;
                          const price = Number(p.price_sale || p.price);
                          return (
                            <div key={row.id} className="flex items-center gap-3 rounded-xl bg-white border border-amber-100 p-2.5">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} width={44} height={44} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">🍽</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                                <p className="text-xs text-amber-700 font-semibold mt-0.5">{formatCurrency(price, currency)}</p>
                              </div>
                              <Button
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white active:scale-95 touch-manipulation flex-shrink-0 border-0"
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

                  {/* Cart Items */}
                  {items.map((item, index) => {
                    const itemTotal = item.unitPrice * item.quantity;
                    return (
                      <div key={index} className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 text-sm leading-snug">{item.productName}</h4>
                            {item.isPizza && (
                              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                {item.pizzaSize && <p>{t('cart.size')}: {item.pizzaSize}</p>}
                                {item.pizzaFlavors && item.pizzaFlavors.length > 0 && (
                                  <p className="line-clamp-1">{t('cart.flavors')}: {item.pizzaFlavors.join(', ')}</p>
                                )}
                                {item.pizzaDough && <p>{t('cart.dough')}: {item.pizzaDough}</p>}
                                {item.pizzaEdge && <p>{t('cart.edge')}: {item.pizzaEdge}</p>}
                              </div>
                            )}
                            {item.addons && item.addons.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                {item.addons.map((a, i) => (
                                  <p key={i}>+ {a.name} {a.price > 0 ? `(+${formatCurrency(a.price, currency)})` : ''}</p>
                                ))}
                              </div>
                            )}
                            {item.observations && (
                              <p className="text-xs text-orange-500 mt-1 italic line-clamp-1">Obs: {item.observations}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(index)}
                            className="h-7 w-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 active:scale-95 touch-manipulation transition-all flex-shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                            <button
                              className="h-9 w-9 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 touch-manipulation transition-all"
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-900">{item.quantity}</span>
                            <button
                              className="h-9 w-9 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 touch-manipulation transition-all"
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="font-bold text-slate-900 text-sm">
                            {formatCurrency(itemTotal, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-4 space-y-3">
                {/* Subtotal + CTA */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-500 font-medium">{t('cart.subtotal')}</span>
                  <span className="text-xl font-bold text-slate-900">{formatCurrency(getSubtotal(), currency)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  data-testid="cart-checkout"
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 active:scale-[0.98] text-white font-bold text-base flex items-center justify-between px-5 shadow-lg shadow-orange-500/25 transition-all touch-manipulation"
                >
                  <span>{t('cart.finalize')}</span>
                  <ChevronRight className="h-5 w-5 opacity-90" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
