/**
 * Modal de produto com addons — design clean e minimalista.
 * Imagem 4:3 centralizada, addons, seletor de quantidade, botão único "Adicionar ao Carrinho".
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus, ArrowLeft, Check } from 'lucide-react';
import ProductAllergensLabelsBadges from './ProductAllergensLabelsBadges';
import ExpandableDescription from './ExpandableDescription';

interface AddonItem {
  id: string;
  name: string;
  price: number;
  max_quantity?: number;
}

interface AddonGroup {
  id: string;
  name: string;
  items: AddonItem[];
  addon_mode?: 'padrao' | 'quantidade';
  addon_min?: number;
  addon_max?: number;
  addon_required?: boolean;
}

interface ProductAddonModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  addonGroups: AddonGroup[];
  currency: CurrencyCode;
  basePrice: number;
  convertForDisplay?: (value: number) => number;
  onAddToCart: (params: {
    quantity: number;
    unitPrice: number;
    addons: Array<{ addonItemId: string; name: string; price: number; quantity?: number }>;
    observations?: string;
  }) => void;
}

export default function ProductAddonModal({
  open,
  onClose,
  product,
  addonGroups,
  currency,
  basePrice,
  convertForDisplay,
  onAddToCart,
}: ProductAddonModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<
    Array<{ addonItemId: string; name: string; price: number; quantity: number }>
  >([]);
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (open) {
      setObservations('');
    }
  }, [open]);

  const getAddonQty = (addonItemId: string) =>
    selectedAddons.find((a) => a.addonItemId === addonItemId)?.quantity ?? 0;

  const mode = (g: AddonGroup) => g.addon_mode ?? 'quantidade';

  const padraoSelectedCount = (g: AddonGroup) =>
    selectedAddons.filter((a) => g.items.some((i) => i.id === a.addonItemId)).length;

  const isPadraoExtrasSelected = (g: AddonGroup) =>
    mode(g) === 'padrao' && padraoSelectedCount(g) === 0;

  const isPadraoItemSelected = (g: AddonGroup, itemId: string) =>
    mode(g) === 'padrao' && selectedAddons.some((a) => a.addonItemId === itemId);

  const selectSemExtras = (g: AddonGroup) => {
    setSelectedAddons((prev) => prev.filter((a) => !g.items.some((i) => i.id === a.addonItemId)));
  };

  const togglePadraoItem = (g: AddonGroup, item: AddonItem) => {
    if (mode(g) !== 'padrao') return;
    const sel = isPadraoItemSelected(g, item.id);
    const max = g.addon_max ?? 5;
    if (sel) {
      setSelectedAddons((prev) => prev.filter((a) => a.addonItemId !== item.id));
      return;
    }
    if (padraoSelectedCount(g) >= max) return;
    setSelectedAddons((prev) => [...prev.filter((a) => a.addonItemId !== item.id), { addonItemId: item.id, name: item.name, price: item.price, quantity: 1 }]);
  };

  const changeAddonQty = (item: AddonItem, delta: number, maxQty = 99) => {
    setSelectedAddons((prev) => {
      const existing = prev.find((a) => a.addonItemId === item.id);
      const currentQty = existing?.quantity ?? 0;
      const nextQty = Math.max(0, Math.min(maxQty, currentQty + delta));
      if (nextQty === 0) {
        return prev.filter((a) => a.addonItemId !== item.id);
      }
      const entry = { addonItemId: item.id, name: item.name, price: item.price, quantity: nextQty };
      if (existing) {
        return prev.map((a) => (a.addonItemId === item.id ? entry : a));
      }
      return [...prev, entry];
    });
  };

  const padraoValidationFailed = addonGroups.some(
    (g) =>
      mode(g) === 'padrao' &&
      (g.addon_required ?? false) &&
      (g.addon_min ?? 0) > 0 &&
      padraoSelectedCount(g) < (g.addon_min ?? 0)
  );

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price * (a.quantity ?? 1), 0);
  const unitPrice = basePrice + addonsTotal;
  const total = unitPrice * quantity;
  const fmt = (v: number) => formatPrice(convertForDisplay ? convertForDisplay(v) : v, currency);

  const handleAdd = () => {
    onAddToCart({
      quantity,
      unitPrice,
      addons: selectedAddons.map((a) => ({
        addonItemId: a.addonItemId,
        name: a.name,
        price: a.price,
        ...(a.quantity !== 1 && { quantity: a.quantity }),
      })),
      observations: observations.trim() || undefined,
    });
    setSelectedAddons([]);
    setQuantity(1);
    setObservations('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        className="max-w-md w-[calc(100vw-24px)] sm:w-full max-h-[calc(100dvh-24px)] sm:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl border border-border shadow-xl bg-card"
      >
        {/* Header minimalista */}
        <header className="flex-shrink-0 flex items-center h-12 px-4 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all touch-manipulation"
            aria-label={t('productCard.details')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4 sm:p-5 space-y-5">
            {/* Imagem 4:3 centralizada */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted flex justify-center items-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                />
              ) : (
                <span className="text-5xl opacity-25">🍽</span>
              )}
            </div>

            {/* Nome, preço e alérgenos */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground leading-snug">
                {product.name}
              </h3>
              <p className="text-base font-semibold text-primary tabular-nums">
                {fmt(basePrice)}
              </p>
              {(product.allergens?.length || product.labels?.length) ? (
                <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} className="pt-2" />
              ) : null}
            </div>

            {/* Descrição */}
            {product.description && (
              <ExpandableDescription>{product.description}</ExpandableDescription>
            )}

            {/* Addons — Padrão (lista) ou Quantidade (+/-) */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.name}
                </h4>
                {mode(group) === 'padrao' ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => selectSemExtras(group)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                        isPadraoExtrasSelected(group) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">Sem Extras</span>
                      {isPadraoExtrasSelected(group) && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                    {group.items.map((item) => {
                      const sel = isPadraoItemSelected(group, item.id);
                      const max = group.addon_max ?? 5;
                      const count = padraoSelectedCount(group);
                      const canAdd = !sel && count < max;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => (sel || canAdd) && togglePadraoItem(group, item)}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                            sel ? 'border-primary bg-primary/5' : canAdd ? 'border-border bg-card hover:bg-muted/50' : 'border-border bg-muted/30 opacity-60'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.price > 0 && <span className="text-xs text-muted-foreground ml-1">+{fmt(item.price)}</span>}
                          </div>
                          {sel && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                    {(group.addon_required ?? false) && padraoSelectedCount(group) < (group.addon_min ?? 0) && (
                      <p className="text-xs text-amber-600">Selecione ao menos {group.addon_min} extra(s)</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => {
                      const qty = getAddonQty(item.id);
                      const max = item.max_quantity ?? 10;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-card">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">{item.name}</span>
                            {item.price > 0 && <span className="text-xs text-muted-foreground ml-1">+{fmt(item.price)}</span>}
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-muted overflow-hidden">
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, -1, max)}
                              disabled={qty <= 0}
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, 1, max)}
                              disabled={qty >= max}
                              className="h-9 w-9 flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-40 touch-manipulation"
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Total e seletor de quantidade */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {t('menu.total')}: {fmt(total)}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 disabled:opacity-40 disabled:hover:bg-muted touch-manipulation transition-colors"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-semibold text-foreground tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 touch-manipulation transition-all"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Observações — placeholder no campo */}
            <Textarea
                placeholder={t('productCard.observationsPlaceholder')}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="rounded-lg border-border bg-muted/50 focus:bg-card focus:ring-1 focus:ring-primary/30 min-h-[64px] resize-none text-sm touch-manipulation"
              />
          </div>
        </div>

        {/* Rodapé — botão único "Adicionar ao Carrinho" */}
        <footer
          className="flex-shrink-0 p-4 bg-card border-t border-border"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-bottom))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleAdd}
            disabled={padraoValidationFailed}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-colors active:scale-[0.99] touch-manipulation shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('productCard.addToCart')}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
