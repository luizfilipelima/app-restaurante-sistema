/**
 * Modal unificado de produto — design padrão do cardápio.
 * Suporta produtos simples, com addons e pizza (opções de pizza no topo, sem imagem).
 */
import { useState, useEffect } from 'react';
import { Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge, PizzaExtra } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, ArrowLeft, X, Check } from 'lucide-react';
import ProductAllergensLabelsBadges from './ProductAllergensLabelsBadges';
import ExpandableDescription from './ExpandableDescription';

interface AddonGroup {
  id: string;
  name: string;
  items: { id: string; name: string; price: number; maxQuantity?: number; max_quantity?: number }[];
  extrasMode?: 'padrao' | 'quantidade';
  extrasMin?: number;
  extrasMax?: number;
  extrasRequired?: boolean;
  addon_mode?: 'padrao' | 'quantidade';
  addon_min?: number;
  addon_max?: number;
  addon_required?: boolean;
}

export interface PizzaConfig {
  sizes: PizzaSize[];
  flavors: PizzaFlavor[];
  doughs: PizzaDough[];
  edges: PizzaEdge[];
  extras?: PizzaExtra[];
  isSpecial: boolean;
}

interface UnifiedProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  basePrice: number;
  addonGroups?: AddonGroup[];
  pizzaConfig?: PizzaConfig | null;
  /** Produtos de pizza do cardápio (exceto o principal) para Meio a Meio */
  pizzaProducts?: Product[];
  currency?: CurrencyCode;
  convertForDisplay?: (value: number) => number;
}

export default function UnifiedProductModal({
  open,
  onClose,
  product,
  basePrice,
  addonGroups = [],
  pizzaConfig,
  pizzaProducts = [],
  currency = 'BRL',
  convertForDisplay,
}: UnifiedProductModalProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);
  const isPizza = !!pizzaConfig;

  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Array<{ addonItemId: string; name: string; price: number; quantity: number }>>([]);

  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);
  const [selectedSecondProduct, setSelectedSecondProduct] = useState<Product | null>(null);
  const [selectedDough, setSelectedDough] = useState<PizzaDough | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PizzaEdge | null>(null);

  const singleSize = pizzaConfig && pizzaConfig.sizes.length === 1;
  const effectiveSize = pizzaConfig && (singleSize ? pizzaConfig.sizes[0] ?? null : selectedSize);
  const canAddSecondFlavor = pizzaProducts.length > 0;

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setObservations('');
      setSelectedAddons([]);
      setSelectedSecondProduct(null);
      if (pizzaConfig) {
        setSelectedSize(singleSize ? pizzaConfig.sizes[0] ?? null : pizzaConfig.sizes[0] ?? null);
        setSelectedDough(pizzaConfig.doughs[0] || null);
        setSelectedEdge(null);
      }
    }
  }, [open, pizzaConfig, singleSize]);

  const getAddonQty = (addonItemId: string) =>
    selectedAddons.find((a) => a.addonItemId === addonItemId)?.quantity ?? 0;

  const changeAddonQty = (item: { id: string; name: string; price: number; maxQuantity?: number }, delta: number) => {
    const max = item.maxQuantity ?? 99;
    setSelectedAddons((prev) => {
      const existing = prev.find((a) => a.addonItemId === item.id);
      const currentQty = existing?.quantity ?? 0;
      const nextQty = Math.max(0, Math.min(max, currentQty + delta));
      if (nextQty === 0) return prev.filter((a) => a.addonItemId !== item.id);
      const entry = { addonItemId: item.id, name: item.name, price: item.price, quantity: nextQty };
      if (existing) return prev.map((a) => (a.addonItemId === item.id ? entry : a));
      return [...prev, entry];
    });
  };

  /** Toggle extra selection (modo Padrão) — "Sem Extras" = id especial, quantity 0 */
  const togglePadraoExtra = (group: AddonGroup, item: { id: string; name: string; price: number }) => {
    if (addonGroupMode(group) !== 'padrao') return;
    const max = addonGroupMax(group);
    const selected = selectedAddons.filter((a) => group.items.some((i) => i.id === a.addonItemId));
    const isSelected = selected.some((a) => a.addonItemId === item.id);
    if (isSelected) {
      setSelectedAddons((prev) => prev.filter((a) => a.addonItemId !== item.id));
      return;
    }
    if (selected.length >= max) return;
    setSelectedAddons((prev) => [...prev.filter((a) => a.addonItemId !== item.id), { addonItemId: item.id, name: item.name, price: item.price, quantity: 1 }]);
  };

  const selectSemExtras = (group: AddonGroup) => {
    if (addonGroupMode(group) !== 'padrao') return;
    setSelectedAddons((prev) => prev.filter((a) => !group.items.some((i) => i.id === a.addonItemId)));
  };

  const addonGroupMode = (g: AddonGroup) => g.extrasMode ?? g.addon_mode ?? 'quantidade';
  const addonGroupMin = (g: AddonGroup) => g.extrasMin ?? g.addon_min ?? 0;
  const addonGroupMax = (g: AddonGroup) => g.extrasMax ?? g.addon_max ?? 5;
  const addonGroupRequired = (g: AddonGroup) => g.extrasRequired ?? g.addon_required ?? false;

  const isPadraoExtrasSelected = (group: AddonGroup) =>
    addonGroupMode(group) === 'padrao' && selectedAddons.filter((a) => group.items.some((i) => i.id === a.addonItemId)).length === 0;

  const isPadraoExtraItemSelected = (group: AddonGroup, itemId: string) =>
    addonGroupMode(group) === 'padrao' && selectedAddons.some((a) => a.addonItemId === itemId);

  const padraoSelectedCount = (group: AddonGroup) =>
    selectedAddons.filter((a) => group.items.some((i) => i.id === a.addonItemId)).length;

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price * a.quantity, 0);
  const doughExtra = selectedDough?.extra_price ?? 0;
  const edgePrice = selectedEdge?.price ?? 0;

  const sizeMultiplier = effectiveSize?.price_multiplier ?? 1;
  const mainPrice = isPizza ? basePrice * sizeMultiplier : basePrice;
  const secondPrice = selectedSecondProduct
    ? Number(selectedSecondProduct.price_sale ?? selectedSecondProduct.price) * sizeMultiplier
    : 0;
  const basePizzaPrice = selectedSecondProduct ? (mainPrice + secondPrice) / 2 : mainPrice;
  const unitPrice = isPizza
    ? basePizzaPrice + doughExtra + edgePrice + addonsTotal
    : basePrice + addonsTotal;
  const total = unitPrice * quantity;
  const fmt = (v: number) => formatPrice(convertForDisplay ? convertForDisplay(v) : v, currency);

  const padraoValidationFailed = addonGroups.some(
    (g) =>
      addonGroupMode(g) === 'padrao' &&
      addonGroupRequired(g) &&
      addonGroupMin(g) > 0 &&
      padraoSelectedCount(g) < addonGroupMin(g)
  );
  const canAdd = isPizza ? effectiveSize !== null && !padraoValidationFailed : true;

  const handleAdd = () => {
    if (isPizza) {
      if (!effectiveSize) return;
      const pizzaFlavors = selectedSecondProduct ? [product.name, selectedSecondProduct.name] : [product.name];
      addItem({
        productId: product.id,
        productName: product.name,
        imageUrl: product.image_url ?? undefined,
        quantity,
        unitPrice,
        isPizza: true,
        pizzaSize: effectiveSize.name,
        pizzaFlavors,
        pizzaDough: selectedDough?.name ?? undefined,
        pizzaEdge: selectedEdge?.name ?? undefined,
        pizzaDoughPrice: doughExtra,
        pizzaEdgePrice: edgePrice,
        addons: selectedAddons.length > 0 ? selectedAddons.map((a) => ({ addonItemId: a.addonItemId, name: a.name, price: a.price, quantity: a.quantity })) : undefined,
        observations: observations.trim() || undefined,
      });
    } else {
      addItem({
        productId: product.id,
        productName: product.name,
        imageUrl: product.image_url ?? undefined,
        quantity,
        unitPrice,
        addons: selectedAddons.length > 0 ? selectedAddons.map((a) => ({ addonItemId: a.addonItemId, name: a.name, price: a.price, quantity: a.quantity })) : undefined,
        observations: observations.trim() || undefined,
      });
    }
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

        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4 sm:p-5 space-y-5">
            {/* Imagem */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted flex justify-center items-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover object-center" loading="lazy" />
              ) : (
                <span className="text-5xl opacity-25">🍽</span>
              )}
            </div>

            {/* Nome, preço e alérgenos */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground leading-snug">{product.name}</h3>
              <p className="text-base font-semibold text-primary tabular-nums">
                {fmt(isPizza ? basePrice * (effectiveSize?.price_multiplier ?? 1) : basePrice)}
              </p>
              {(product.allergens?.length || product.labels?.length) ? (
                <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} className="pt-2" />
              ) : null}
            </div>

            {/* Descrição */}
            {product.description && (
              <ExpandableDescription>{product.description}</ExpandableDescription>
            )}

            {/* Opções de pizza (quando config de pizza) */}
            {isPizza && (
              <div className="space-y-4">
                {pizzaConfig!.sizes.length === 0 && (
                  <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-4 text-amber-800 text-sm">
                    {t('customModal.menuConfigDesc')}
                  </div>
                )}

                {!singleSize && (pizzaConfig!.sizes.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('customModal.chooseSize')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {pizzaConfig!.sizes.map((size) => (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            selectedSize?.id === size.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          {size.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {effectiveSize && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('customModal.mainFlavor')}</h4>
                    <div className="px-3 py-2 rounded-lg border-2 border-primary bg-primary/5 text-primary font-medium">
                      {product.name}
                    </div>
                    {canAddSecondFlavor && (
                      <div className="space-y-2">
                        {selectedSecondProduct ? (
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-2 border-primary bg-primary/10 text-primary">
                            <span className="text-sm font-medium">
                              {selectedSecondProduct.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedSecondProduct(null)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label={t('customModal.removeSecondFlavor')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <Select
                            value=""
                            onValueChange={(id) => {
                              const p = pizzaProducts.find((x) => x.id === id);
                              if (p) setSelectedSecondProduct(p);
                            }}
                          >
                            <SelectTrigger className="w-full rounded-lg border-2 border-border hover:bg-muted/50">
                              <SelectValue placeholder={t('customModal.addSecondFlavor')} />
                            </SelectTrigger>
                            <SelectContent>
                              {pizzaProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.category})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {effectiveSize && (pizzaConfig!.doughs.length > 0 || pizzaConfig!.edges.length > 0) && (
                  <div className="space-y-4">
                    {pizzaConfig!.doughs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('customModal.doughType')}</h4>
                        <div className="flex flex-col gap-2">
                          {pizzaConfig!.doughs.map((dough) => {
                            const isSelected = selectedDough?.id === dough.id;
                            return (
                              <button
                                key={dough.id}
                                type="button"
                                onClick={() => setSelectedDough(dough)}
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium">{dough.name}</span>
                                  {dough.extra_price > 0 && <span className="text-xs text-muted-foreground ml-1">+{fmt(dough.extra_price)}</span>}
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {pizzaConfig!.edges.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase">{t('customModal.stuffedEdge')}</h4>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEdge(null)}
                            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                              !selectedEdge ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                            }`}
                          >
                            <span className="text-sm font-medium">{t('customModal.noEdge')}</span>
                            {!selectedEdge && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                          {pizzaConfig!.edges.map((edge) => {
                            const isSelected = selectedEdge?.id === edge.id;
                            return (
                              <button
                                key={edge.id}
                                type="button"
                                onClick={() => setSelectedEdge(edge)}
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium">{edge.name}</span>
                                  <span className="text-xs text-muted-foreground ml-1">+{fmt(edge.price)}</span>
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Addons (extras) — antes do Total */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">{group.name}</h4>
                {addonGroupMode(group) === 'padrao' ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => selectSemExtras(group)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                        isPadraoExtrasSelected(group) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">Sem Extras</span>
                      {isPadraoExtrasSelected(group) && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                    {group.items.map((item) => {
                      const sel = isPadraoExtraItemSelected(group, item.id);
                      const max = addonGroupMax(group);
                      const count = padraoSelectedCount(group);
                      const canAdd = !sel && count < max;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => (sel || canAdd) && togglePadraoExtra(group, item)}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                            sel ? 'border-primary bg-primary/5' : canAdd ? 'border-border bg-card hover:bg-muted/50' : 'border-border bg-muted/30 opacity-60 cursor-default'
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
                    {addonGroupRequired(group) && padraoSelectedCount(group) < addonGroupMin(group) && (
                      <p className="text-xs text-amber-600">Selecione ao menos {addonGroupMin(group)} extra(s)</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => {
                      const qty = getAddonQty(item.id);
                      const max = item.maxQuantity ?? item.max_quantity ?? 99;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-card">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.price > 0 && <span className="text-xs text-muted-foreground ml-1">+{fmt(item.price)}</span>}
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-muted overflow-hidden">
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, -1)}
                              disabled={qty <= 0}
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 touch-manipulation"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, 1)}
                              disabled={qty >= max}
                              className="h-9 w-9 flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-40 touch-manipulation"
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

            {/* Observações — placeholder no campo */}
            <Textarea
                placeholder={t('productCard.observationsPlaceholder')}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="rounded-lg border-border bg-muted/50 focus:bg-card focus:ring-1 focus:ring-primary/30 min-h-[64px] resize-none text-sm touch-manipulation"
              />

            {/* Total e seletor de quantidade — por último, acima do botão */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {t('menu.total')}: {fmt(total)}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 disabled:opacity-40 touch-manipulation"
                  aria-label="Diminuir"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 touch-manipulation"
                  aria-label="Aumentar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex-shrink-0 p-4 bg-card border-t border-border" style={{ paddingTop: 'max(16px, env(safe-area-inset-bottom))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-colors active:scale-[0.99] touch-manipulation shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('productCard.addToCart')}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
