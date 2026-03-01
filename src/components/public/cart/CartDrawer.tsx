import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Trash2, Sparkles, ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUpsellsForProducts, type UpsellRow, useLoyaltyStatus } from '@/hooks/queries';
import type { CartItem } from '@/types';
import LoyaltyCard, { LoyaltyInvite } from '../loyalty/LoyaltyCard';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  currency?: CurrencyCode;
  /** Converte valor da moeda base para moeda de exibição. Se não informado, usa valor direto. */
  convertForDisplay?: (value: number) => number;
  restaurantId?: string | null;
  customerPhone?: string;
  /** Nome do cliente na mesa (pedidos via QR) — exibido no header para reforçar identificação. */
  tableCustomerName?: string | null;
  /** Número da mesa — exibido junto ao nome quando pedido de mesa. */
  tableNumber?: number | null;
}

export default function CartDrawer({ open, onClose, onCheckout, currency = 'BRL', convertForDisplay, restaurantId, customerPhone, tableCustomerName, tableNumber }: CartDrawerProps) {
  const { t } = useTranslation();
  const { items, orderedTableItems, addItem, updateQuantity, removeItem, getSubtotal, getOrderedSubtotal } = useCartStore();
  const isTableOrder = tableNumber != null;
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
      imageUrl: p.image_url ?? undefined,
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

  const fmt = (v: number) => formatPrice(convertForDisplay ? convertForDisplay(v) : v, currency);

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
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-card rounded-t-[28px] shadow-2xl overflow-hidden"
            style={{ maxHeight: '92svh', paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.8 }}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing" onClick={onClose}>
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex flex-col gap-1.5 px-5 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                    <ShoppingBag className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{t('cart.title')}</h2>
                  {(items.length > 0 || (isTableOrder && orderedTableItems.length > 0)) && (
                    <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {items.length > 0 ? items.reduce((s, i) => s + i.quantity, 0) : orderedTableItems.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
              </div>
              {tableCustomerName?.trim() && tableNumber != null && (
                <p className="text-xs text-primary font-medium">Pedindo como: {tableCustomerName} · Mesa {tableNumber}</p>
              )}
            </div>

            {/* Scrollable content — plano de fidelidade e itens com mesmo padrão visual */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              {items.length === 0 && (!isTableOrder || orderedTableItems.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">{t('cart.empty')}</p>
                </div>
              ) : (
                <>
                  {/* Itens já pedidos (mesa) — read-only */}
                  {isTableOrder && orderedTableItems.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-success" />
                        {t('cart.orderedItems')}
                      </h3>
                      <div className="space-y-2">
                        {orderedTableItems.map((item, index) => {
                          const itemTotal =
                            item.unitPrice * item.quantity +
                            (item.pizzaEdgePrice ?? 0) * item.quantity +
                            (item.pizzaDoughPrice ?? 0) * item.quantity;
                          return (
                            <div key={`ordered-${index}`} className="bg-muted/50 border border-border rounded-2xl overflow-hidden">
                              <div className="flex gap-3 p-3.5">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 min-w-16 min-h-16 sm:min-w-20 sm:min-h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border opacity-90">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-2xl opacity-25">🍽</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-foreground/90 text-sm leading-snug">{item.productName}</h4>
                                  {item.isPizza && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {item.pizzaSize && <p>{t('cart.size')}: {item.pizzaSize}</p>}
                                      {item.pizzaFlavors && item.pizzaFlavors.length > 0 && (
                                        <p className="line-clamp-1">{t('cart.flavors')}: {item.pizzaFlavors.join(', ')}</p>
                                      )}
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.quantity}× {fmt(item.unitPrice)}
                                  </p>
                                </div>
                                <span className="font-bold text-foreground/90 text-sm self-center">{fmt(itemTotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Plano de fidelidade — mesmo padrão de card que os itens */}
                  {loyaltyStatus ? (
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <LoyaltyCard status={loyaltyStatus} compact noMargin />
                    </div>
                  ) : loyaltyStatus === null && restaurantId ? (
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <LoyaltyInvite enabled={true} noMargin />
                    </div>
                  ) : null}

                  {/* Upsell (order bump) — usa cores do tema do restaurante */}
                  {upsellRows.length > 0 && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('cart.upsellTitle')}
                      </div>
                      <div className="space-y-1.5">
                        {upsellRows.map((row) => {
                          const p = row.upsell_product;
                          if (!p) return null;
                          const price = Number(p.price_sale || p.price);
                          return (
                            <div key={row.id} className="flex items-center gap-3 rounded-xl bg-card border border-border p-2.5">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} width={44} height={44} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">🍽</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                                <p className="text-xs text-primary font-semibold mt-0.5">{fmt(price)}</p>
                              </div>
                              <Button
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 touch-manipulation flex-shrink-0 border-0"
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

                  {/* Novos itens (pendentes) — quando mesa e há itens pedidos + novos */}
                  {isTableOrder && orderedTableItems.length > 0 && items.length > 0 && (
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-1">
                      {t('cart.newItems')}
                    </h3>
                  )}

                  {/* Cart Items — layout alinhado aos cards do cardápio (imagem à esquerda, bordas arredondadas) */}
                  {items.map((item, index) => {
                    const itemTotal = item.unitPrice * item.quantity;
                    return (
                      <div key={index} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex gap-3 p-3.5">
                          {/* Imagem à esquerda — mesmo padrão visual do cardápio */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 min-w-16 min-h-16 sm:min-w-20 sm:min-h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-full h-full object-cover object-center"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-2xl opacity-25">🍽</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground text-sm leading-snug">{item.productName}</h4>
                            {item.isPizza && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {item.pizzaSize && <p>{t('cart.size')}: {item.pizzaSize}</p>}
                                {item.pizzaFlavors && item.pizzaFlavors.length > 0 && (
                                  <p className="line-clamp-1">{t('cart.flavors')}: {item.pizzaFlavors.join(', ')}</p>
                                )}
                                {item.pizzaDough && <p>{t('cart.dough')}: {item.pizzaDough}</p>}
                                {item.pizzaEdge && <p>{t('cart.edge')}: {item.pizzaEdge}</p>}
                              </div>
                            )}
                            {item.addons && item.addons.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {item.addons.map((a, i) => (
                                  <p key={i}>+ {a.name} {a.price > 0 ? `(+${fmt(a.price)})` : ''}</p>
                                ))}
                              </div>
                            )}
                            {item.observations && (
                              <p className="text-xs text-primary mt-1 italic line-clamp-1">Obs: {item.observations}</p>
                            )}
                              </div>
                              <button
                                onClick={() => removeItem(index)}
                                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 touch-manipulation transition-all flex-shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex items-center bg-muted rounded-xl overflow-hidden">
                                <button
                                  className="h-9 w-9 flex items-center justify-center text-foreground hover:bg-muted-foreground/20 active:scale-95 touch-manipulation transition-all"
                                  onClick={() => updateQuantity(index, item.quantity - 1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                                <button
                                  className="h-9 w-9 flex items-center justify-center text-foreground hover:bg-muted-foreground/20 active:scale-95 touch-manipulation transition-all"
                                  onClick={() => updateQuantity(index, item.quantity + 1)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <span className="font-bold text-foreground text-sm">
                                {fmt(itemTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer — botão de enviar só aparece quando há itens pendentes (novos) */}
            {items.length > 0 && (
              <div className="flex-shrink-0 border-t border-border bg-card px-4 pt-3 pb-4 space-y-3">
                {/* Subtotal + CTA */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground font-medium">{t('cart.subtotal')}</span>
                  <span className="text-xl font-bold text-foreground">{fmt(getSubtotal())}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  data-testid="cart-checkout"
                  className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-base flex items-center justify-between px-5 shadow-lg transition-all touch-manipulation"
                >
                  <span>{isTableOrder ? t('cart.sendToKitchen') : t('cart.finalize')}</span>
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
