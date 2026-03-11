import { useState, useEffect } from 'react';
import { Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Check, Pizza as PizzaIcon, Minus, Plus, X } from 'lucide-react';

interface AddonGroup {
  id: string;
  name: string;
  items: { id: string; name: string; price: number }[];
}

interface PizzaModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  basePrice: number;
  sizes: PizzaSize[];
  flavors?: PizzaFlavor[];
  doughs: PizzaDough[];
  edges: PizzaEdge[];
  addonGroups?: AddonGroup[];
  isSpecial?: boolean;
  currency?: CurrencyCode;
  convertForDisplay?: (value: number) => number;
}

export default function PizzaModal({
  open,
  onClose,
  product,
  basePrice,
  sizes,
  flavors = [],
  doughs,
  edges,
  addonGroups = [],
  isSpecial = false,
  currency = 'BRL',
  convertForDisplay,
}: PizzaModalProps) {
  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<PizzaFlavor[]>([]);
  const [selectedDough, setSelectedDough] = useState<PizzaDough | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PizzaEdge | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Array<{ addonItemId: string; name: string; price: number; quantity: number }>>([]);
  const [observations, setObservations] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);

  const singleSize = sizes.length === 1;
  const effectiveSize = singleSize ? sizes[0] ?? null : selectedSize;

  useEffect(() => {
    if (open) {
      setSelectedSize(singleSize ? sizes[0] ?? null : sizes[0] ?? null);
      setSelectedFlavors([]);
      setSelectedDough(doughs[0] || null);
      setSelectedEdge(null);
      setSelectedAddons([]);
      setObservations('');
      setQuantity(1);
    }
  }, [open, sizes, doughs, singleSize]);

  // maxFlavors: Especial = 1, Padrão = até 2 (ou o limite do tamanho)
  const maxFlavors = isSpecial ? 1 : Math.min(2, effectiveSize?.max_flavors ?? 2);

  useEffect(() => {
    if (effectiveSize && selectedFlavors.length > maxFlavors) {
      setSelectedFlavors((prev) => prev.slice(0, maxFlavors));
    }
  }, [effectiveSize, maxFlavors]);

  const hasFlavors = flavors.length > 0;

  const toggleFlavor = (flavor: PizzaFlavor) => {
    const isSelected = selectedFlavors.some((f) => f.id === flavor.id);
    if (isSelected) {
      setSelectedFlavors((prev) => prev.filter((f) => f.id !== flavor.id));
    } else if (maxFlavors === 1) {
      setSelectedFlavors([flavor]);
    } else if (selectedFlavors.length < maxFlavors) {
      setSelectedFlavors((prev) => [...prev, flavor]);
    }
  };

  const getAddonQty = (addonItemId: string) =>
    selectedAddons.find((a) => a.addonItemId === addonItemId)?.quantity ?? 0;

  const changeAddonQty = (item: { id: string; name: string; price: number }, delta: number) => {
    setSelectedAddons((prev) => {
      const existing = prev.find((a) => a.addonItemId === item.id);
      const currentQty = existing?.quantity ?? 0;
      const nextQty = Math.max(0, currentQty + delta);
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

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price * a.quantity, 0);
  const flavorExtras = selectedFlavors.reduce((s, f) => s + (f.price ?? 0), 0);

  // Todos os preços em formato de armazenamento (centavos BRL, inteiro PYG)
  const calculatePrice = () => {
    return basePrice + (selectedDough?.extra_price ?? 0) + (selectedEdge?.price ?? 0) + flavorExtras + addonsTotal;
  };

  const handleAddToCart = () => {
    if (!effectiveSize) return;
    if (hasFlavors && selectedFlavors.length === 0) return;

    const unitPrice = calculatePrice();

    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url ?? undefined,
      quantity,
      unitPrice,
      isPizza: true,
      pizzaSize: effectiveSize.name,
      pizzaFlavors: selectedFlavors.map((f) => f.name),
      pizzaDough: selectedDough?.name,
      pizzaEdge: selectedEdge?.name,
      pizzaDoughPrice: selectedDough?.extra_price ?? 0,
      pizzaEdgePrice: selectedEdge?.price ?? 0,
      addons: selectedAddons.length > 0 ? selectedAddons.map((a) => ({ addonItemId: a.addonItemId, name: a.name, price: a.price, quantity: a.quantity })) : undefined,
      observations,
    });

    onClose();
  };

  const canAddToCart = effectiveSize !== null && (!hasFlavors || selectedFlavors.length > 0);

  const fmt = (v: number) => formatPrice(convertForDisplay ? convertForDisplay(v) : v, currency);

  // Numeração dinâmica de passos (tamanho oculto quando único)
  let step = 1;
  const stepSize = singleSize ? 0 : step++;
  const stepFlavors = hasFlavors ? step++ : 0;
  const stepDoughEdge = (doughs.length > 0 || edges.length > 0) ? step++ : 0;
  const stepAddons = addonGroups.length > 0 ? step++ : 0;
  const stepObs = step++;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent hideClose className="max-w-2xl w-[calc(100vw-24px)] sm:w-full h-[100dvh] md:h-auto md:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl border-0 sm:border shadow-none sm:shadow-xl bg-card">

        {/* Header Fixo — mobile first */}
        <div className="pt-6 pb-5 px-5 sm:pt-6 sm:pb-4 sm:px-6 border-b border-border bg-card z-10 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-primary/20">
              <PizzaIcon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground truncate leading-tight">{product.name}</DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t('pizzaModal.stepsTitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-11 w-11 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 touch-manipulation active:scale-95 flex-shrink-0"
              aria-label={t('pizzaModal.close')}
            >
              <X className="h-5 w-5 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth py-6 px-5 sm:py-6 sm:px-6 space-y-8">

          {/* Aviso quando não há tamanhos configurados */}
          {sizes.length === 0 && (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-5 text-amber-800 shadow-sm">
              <p className="font-semibold mb-2 text-base">{t('pizzaModal.menuConfigTitle')}</p>
              <p className="text-sm leading-relaxed">{t('pizzaModal.menuConfigDesc')}</p>
            </div>
          )}

          {/* PASSO 1: Tamanho (oculto quando único) */}
          {!singleSize && sizes.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">{stepSize}</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('pizzaModal.chooseSize')}</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {sizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setSelectedSize(size)}
                    className={`group relative p-4 sm:p-5 rounded-2xl text-left transition-all duration-200 border-2 touch-manipulation min-h-[100px] sm:min-h-[110px] ${
                      selectedSize?.id === size.id
                        ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex-1">
                        <div className={`font-bold text-lg sm:text-xl mb-1 ${selectedSize?.id === size.id ? 'text-primary' : 'text-foreground'}`}>
                          {size.name}
                        </div>
                        {size.max_flavors > 1 && (
                          <div className={`text-xs font-medium mb-1 ${selectedSize?.id === size.id ? 'text-primary' : 'text-muted-foreground'}`}>
                            até {size.max_flavors} sabores
                          </div>
                        )}
                        <div className={`text-sm font-semibold ${selectedSize?.id === size.id ? 'text-primary' : 'text-muted-foreground'}`}>
                          {fmt(basePrice)}
                        </div>
                      </div>
                      {selectedSize?.id === size.id && (
                        <div className="mt-3 flex justify-end">
                          <div className="bg-primary rounded-full p-1.5 flex-shrink-0 shadow-sm">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* PASSO 2: Sabores */}
          {effectiveSize && hasFlavors && (
            <section className="space-y-4 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">{stepFlavors}</div>
                <div className="flex-1 min-w-0">
                  <Label className="text-lg sm:text-xl font-bold text-foreground">{t('pizzaModal.chooseFlavor')}</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {maxFlavors === 1
                      ? t('pizzaModal.chooseOneFlavor')
                      : t('pizzaModal.chooseUpToFlavors', { max: maxFlavors, count: selectedFlavors.length })}
                  </p>
                </div>
                {selectedFlavors.length > 0 && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-1 flex-shrink-0">
                    {selectedFlavors.length}/{maxFlavors}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {flavors.map((flavor) => {
                  const isSelected = selectedFlavors.some((f) => f.id === flavor.id);
                  const isDisabled = !isSelected && selectedFlavors.length >= maxFlavors;
                  return (
                    <button
                      key={flavor.id}
                      onClick={() => toggleFlavor(flavor)}
                      disabled={isDisabled}
                      className={`relative flex items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200 border-2 touch-manipulation min-h-[68px] ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : isDisabled
                          ? 'border-border bg-muted/60 opacity-50 cursor-not-allowed'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]'
                      }`}
                    >
                      {/* Checkbox visual */}
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border bg-card'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm sm:text-base leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {flavor.name}
                        </div>
                        {flavor.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{flavor.description}</div>
                        )}
                        {flavor.price > 0 && (
                          <div className={`text-xs font-semibold mt-1 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                            +{fmt(flavor.price)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedFlavors.length === 0 && (
                <p className="text-xs text-red-500 font-medium px-1">
                  {t('pizzaModal.selectAtLeastOneFlavor')}
                </p>
              )}
            </section>
          )}

          {/* PASSO 3 (ou 2): Massa e Borda — borda sempre opcional */}
          {effectiveSize && (doughs.length > 0 || edges.length > 0) && (
            <section className="space-y-5 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">{stepDoughEdge}</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('pizzaModal.doughAndEdge')}</Label>
              </div>

              {doughs.length > 0 && (
                <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-sm space-y-3">
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('pizzaModal.doughType')}</span>
                  <div className="flex flex-wrap gap-2.5 sm:gap-3">
                    {doughs.map((dough) => (
                      <button
                        key={dough.id}
                        onClick={() => setSelectedDough(dough)}
                        className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold border-2 transition-all duration-200 touch-manipulation min-h-[44px] ${
                          selectedDough?.id === dough.id
                            ? 'bg-gradient-to-br bg-primary text-primary-foreground border-primary shadow-md scale-105'
                            : 'bg-card text-foreground border-border hover:border-border hover:bg-muted/50 active:scale-95'
                        }`}
                      >
                        {dough.name}{' '}
                        {dough.extra_price > 0 && (
                          <span className="text-xs opacity-90">(+{fmt(dough.extra_price)})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {edges.length > 0 && (
                <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-sm space-y-3">
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{t('pizzaModal.stuffedEdge')} {isSpecial && <span className="normal-case font-normal text-muted-foreground">({t('pizzaModal.optional')})</span>}</span>
                  <div className="space-y-2.5">
                    <button
                      onClick={() => setSelectedEdge(null)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left touch-manipulation min-h-[52px] transition-all duration-200 ${
                        !selectedEdge
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-border hover:bg-muted/50 active:scale-[0.98]'
                      }`}
                    >
                      <span className="font-semibold text-base text-foreground">{t('pizzaModal.noEdge')}</span>
                      {!selectedEdge && (
                        <div className="bg-primary rounded-full p-1.5 flex-shrink-0">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                    {edges.map((edge) => (
                      <button
                        key={edge.id}
                        onClick={() => setSelectedEdge(edge)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left touch-manipulation min-h-[52px] transition-all duration-200 ${
                          selectedEdge?.id === edge.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-card hover:border-border hover:bg-muted/50 active:scale-[0.98]'
                        }`}
                      >
                        <span className="font-semibold text-base text-foreground">{edge.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-muted-foreground">+{fmt(edge.price)}</span>
                          {selectedEdge?.id === edge.id && (
                            <div className="bg-primary rounded-full p-1.5 flex-shrink-0">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Adicionais */}
          {effectiveSize && addonGroups.length > 0 && (
            <section className="space-y-5 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">{stepAddons}</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('pizzaModal.addons')}</Label>
              </div>
              <div className="space-y-4">
                {addonGroups.map((group) => (
                  <div key={group.id} className="bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-sm space-y-3">
                    <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider block">
                      {group.name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => {
                        const qty = getAddonQty(item.id);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-1 rounded-xl border-2 border-border overflow-hidden bg-card"
                          >
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, -1)}
                              disabled={qty === 0}
                              className="px-3 py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground touch-manipulation"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="px-3 py-2 text-sm font-medium min-w-[2.5rem] text-center">{qty}</span>
                            <button
                              type="button"
                              onClick={() => changeAddonQty(item, 1)}
                              className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground touch-manipulation"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <span className="px-3 py-2 text-sm font-semibold text-muted-foreground border-l border-border">
                              {item.name} {item.price > 0 && `+${fmt(item.price)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Observações */}
          {effectiveSize && (
            <section className="space-y-4 pb-4 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">{stepObs}</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('pizzaModal.observations')}</Label>
              </div>
              <Textarea
                placeholder=""
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={4}
                className="bg-card border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-base p-4 touch-manipulation resize-none min-h-[100px] transition-all duration-200"
              />
            </section>
          )}
        </div>

        {/* Footer Actions — sticky, safe area */}
        <div className="pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-5 sm:pt-6 sm:pb-6 sm:px-6 bg-card border-t border-border/80 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)] z-20 flex-shrink-0">
          {/* Sabores selecionados (resumo) */}
          {selectedFlavors.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selectedFlavors.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary border border-primary/30 rounded-full px-2.5 py-1"
                >
                  {f.name}
                  <button
                    onClick={() => toggleFlavor(f)}
                    className="text-primary hover:text-primary/80 leading-none"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center border-2 border-border rounded-xl overflow-hidden bg-card shadow-sm">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 bg-muted hover:bg-muted/80 active:bg-muted text-foreground touch-manipulation active:scale-95 min-w-[44px] flex items-center justify-center transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-5 w-5" />
                </button>
                <div className="px-5 py-3 font-bold text-lg text-foreground bg-card min-w-[3rem] text-center border-x border-border">{quantity}</div>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-3 bg-muted hover:bg-muted/80 active:bg-muted text-foreground touch-manipulation active:scale-95 min-w-[44px] flex items-center justify-center transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="text-right min-w-0 flex-shrink-0">
              <span className="text-xs text-muted-foreground block mb-1">{t('pizzaModal.total')}</span>
              <span className="text-xl sm:text-2xl font-bold text-foreground whitespace-nowrap">
                {fmt(calculatePrice() * quantity)}
              </span>
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 sm:h-14 rounded-2xl shadow-lg touch-manipulation active:scale-[0.98] text-base sm:text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!canAddToCart && hasFlavors && selectedFlavors.length === 0
              ? t('pizzaModal.selectAtLeastOneFlavor')
              : t('pizzaModal.addToCart')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
