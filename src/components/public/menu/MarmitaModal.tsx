import { useState, useEffect } from 'react';
import { Product, MarmitaSize, MarmitaProtein, MarmitaSide } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Check, UtensilsCrossed, Minus, Plus, ArrowLeft } from 'lucide-react';
import ProductAllergensLabelsBadges from './ProductAllergensLabelsBadges';
import ExpandableDescription from './ExpandableDescription';

interface MarmitaModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  sizes: MarmitaSize[];
  proteins: MarmitaProtein[];
  sides: MarmitaSide[];
  currency?: CurrencyCode;
}

interface SelectedProtein {
  protein: MarmitaProtein;
  grams: number; // Quantidade em gramas selecionada
}

export default function MarmitaModal({
  open,
  onClose,
  product,
  sizes,
  proteins,
  sides,
  currency = 'BRL',
}: MarmitaModalProps) {
  const [selectedSize, setSelectedSize] = useState<MarmitaSize | null>(null);
  const [selectedProteins, setSelectedProteins] = useState<SelectedProtein[]>([]);
  const [selectedSides, setSelectedSides] = useState<MarmitaSide[]>([]);
  const [observations, setObservations] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (open) {
      setSelectedSize(sizes[0] || null);
      setSelectedProteins([]);
      setSelectedSides([]);
      setObservations('');
      setQuantity(1);
    }
  }, [open, sizes]);

  // Calcular preço baseado em peso
  const calculatePrice = () => {
    if (!selectedSize) return 0;

    // base_price vem do banco como INTEGER (centavos para BRL, inteiro para PYG)
    // Para BRL, precisa dividir por 100; para PYG, usa direto
    let total = currency === 'BRL' ? selectedSize.base_price / 100 : selectedSize.base_price;

    // Adicionar preço das proteínas (preço por grama * gramas selecionadas)
    // price_per_gram ainda é DECIMAL, então usa direto
    selectedProteins.forEach((sp) => {
      total += sp.protein.price_per_gram * sp.grams;
    });

    // Adicionar preço dos acompanhamentos (preço por grama * peso base)
    selectedSides.forEach((side) => {
      total += side.price_per_gram * selectedSize.weight_grams;
    });

    return total;
  };

  const handleAddProtein = (protein: MarmitaProtein) => {
    const existing = selectedProteins.find((sp) => sp.protein.id === protein.id);
    if (existing) {
      // Aumentar quantidade em 50g
      setSelectedProteins(
        selectedProteins.map((sp) =>
          sp.protein.id === protein.id
            ? { ...sp, grams: Math.min(sp.grams + 50, selectedSize?.weight_grams || 500) }
            : sp
        )
      );
    } else {
      // Adicionar nova proteína com 100g inicial
      setSelectedProteins([...selectedProteins, { protein, grams: 100 }]);
    }
  };

  const handleRemoveProtein = (proteinId: string) => {
    setSelectedProteins(selectedProteins.filter((sp) => sp.protein.id !== proteinId));
  };

  const handleUpdateProteinGrams = (proteinId: string, grams: number) => {
    if (!selectedSize) return;
    const maxGrams = selectedSize.weight_grams;
    const clampedGrams = Math.max(50, Math.min(grams, maxGrams));
    setSelectedProteins(
      selectedProteins.map((sp) =>
        sp.protein.id === proteinId ? { ...sp, grams: clampedGrams } : sp
      )
    );
  };

  const handleToggleSide = (side: MarmitaSide) => {
    const isSelected = selectedSides.some((s) => s.id === side.id);
    if (isSelected) {
      setSelectedSides(selectedSides.filter((s) => s.id !== side.id));
    } else {
      setSelectedSides([...selectedSides, side]);
    }
  };

  const handleAddToCart = () => {
    if (!selectedSize) return;

    const unitPrice = calculatePrice();

    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url ?? undefined,
      quantity,
      unitPrice,
      isMarmita: true,
      marmitaSize: selectedSize.name,
      marmitaWeight: selectedSize.weight_grams,
      marmitaProteins: selectedProteins.map((sp) => `${sp.protein.name} (${sp.grams}g)`),
      marmitaSides: selectedSides.map((s) => s.name),
      observations,
    });

    onClose();
  };

  const canAddToCart = selectedSize !== null && selectedProteins.length > 0;

  // Agrupar acompanhamentos por categoria
  const sidesByCategory = sides.reduce((acc, side) => {
    const category = side.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(side);
    return acc;
  }, {} as Record<string, MarmitaSide[]>);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent hideClose className="max-w-2xl w-[calc(100vw-24px)] sm:w-full h-[100dvh] md:h-auto md:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl border-0 sm:border shadow-none sm:shadow-xl bg-card">
        
        {/* Header minimalista */}
        <header className="flex-shrink-0 flex items-center h-12 px-4 border-b border-border">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all touch-manipulation"
            aria-label={t('marmitaModal.close')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth min-h-0">
          <div className="p-4 sm:p-5 space-y-5 pb-6">
            {/* Imagem */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted flex justify-center items-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover object-center" loading="lazy" />
              ) : (
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                  <UtensilsCrossed className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
                </div>
              )}
            </div>

            {/* Nome, preço e alérgenos */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground leading-snug">{product.name}</h3>
              <p className="text-base font-semibold text-primary tabular-nums">
                {sizes.length > 0
                  ? formatPrice(currency === 'BRL' ? (sizes[0].base_price / 100) : sizes[0].base_price, currency)
                  : ''}
              </p>
              {(product.allergens?.length || product.labels?.length) ? (
                <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} className="pt-2" />
              ) : null}
            </div>

            {/* Descrição */}
            {product.description && (
              <ExpandableDescription>{product.description}</ExpandableDescription>
            )}

          {/* Aviso quando não há tamanhos configurados */}
          {sizes.length === 0 && (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-5 text-amber-800 shadow-sm">
              <p className="font-semibold mb-2 text-base">{t('marmitaModal.menuConfigTitle')}</p>
              <p className="text-sm leading-relaxed">
                {t('marmitaModal.menuConfigDesc')}
              </p>
            </div>
          )}

          {/* PASSO 1: Tamanho (Peso) - Mobile First */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">1</div>
              <Label className="text-lg sm:text-xl font-bold text-foreground">{t('marmitaModal.chooseSize')}</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size);
                    // Resetar proteínas quando mudar tamanho
                    setSelectedProteins([]);
                  }}
                  className={`group relative p-4 sm:p-5 rounded-2xl text-left transition-all duration-200 border-2 touch-manipulation min-h-[100px] sm:min-h-[110px] ${
                    selectedSize?.id === size.id
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100/50 shadow-md shadow-green-500/20 scale-[1.02]'
                      : 'border-border bg-card hover:border-green-200 hover:bg-muted/50 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex-1">
                      <div className={`font-bold text-lg sm:text-xl mb-1 ${selectedSize?.id === size.id ? 'text-green-700' : 'text-foreground'}`}>
                        {size.name}
                      </div>
                      <div className={`text-xs sm:text-sm mb-2 ${selectedSize?.id === size.id ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {size.weight_grams}g
                      </div>
                      <div className={`text-sm font-semibold ${selectedSize?.id === size.id ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {formatPrice(size.base_price, currency)}
                      </div>
                    </div>
                    {selectedSize?.id === size.id && (
                      <div className="mt-3 flex justify-end">
                        <div className="bg-green-500 rounded-full p-1.5 flex-shrink-0 shadow-sm">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* PASSO 2: Proteínas - Mobile First */}
          {selectedSize && proteins.length > 0 && (
            <section className="space-y-5 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">2</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('marmitaModal.chooseProteins')}</Label>
              </div>
              
              <div className="space-y-3">
                {proteins.map((protein) => {
                  const selected = selectedProteins.find((sp) => sp.protein.id === protein.id);
                  return (
                    <div
                      key={protein.id}
                      className={`bg-card p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 ${
                        selected
                          ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100/50 shadow-sm'
                          : 'border-border hover:border-green-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-base sm:text-lg text-foreground mb-1">
                            {protein.name}
                          </div>
                          {protein.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground">{protein.description}</p>
                          )}
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {formatPrice(protein.price_per_gram, currency)}/g
                          </div>
                        </div>
                        {selected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveProtein(protein.id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            {t('marmitaModal.remove')}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAddProtein(protein)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {t('marmitaModal.add')}
                          </Button>
                        )}
                      </div>
                      {selected && (
                        <div className="flex items-center gap-3 pt-3 border-t border-green-200">
                          <Label className="text-sm font-medium text-foreground">{t('marmitaModal.quantityGrams')}</Label>
                          <div className="flex items-center gap-2 flex-1">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleUpdateProteinGrams(protein.id, selected.grams - 50)}
                              disabled={selected.grams <= 50}
                              className="h-9 w-9"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={selected.grams}
                              onChange={(e) => handleUpdateProteinGrams(protein.id, parseInt(e.target.value) || 50)}
                              min={50}
                              max={selectedSize.weight_grams}
                              step={50}
                              className="w-20 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleUpdateProteinGrams(protein.id, selected.grams + 50)}
                              disabled={selected.grams >= selectedSize.weight_grams}
                              className="h-9 w-9"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground ml-auto">
                              {formatPrice(protein.price_per_gram * selected.grams, currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* PASSO 3: Acompanhamentos - Mobile First */}
          {selectedSize && sides.length > 0 && (
            <section className="space-y-5 animate-slide-in-bottom">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">3</div>
                <Label className="text-lg sm:text-xl font-bold text-foreground">{t('marmitaModal.sides')}</Label>
              </div>
              
              {Object.entries(sidesByCategory).map(([category, categorySides]) => (
                <div key={category} className="bg-card p-4 sm:p-5 rounded-2xl border border-border/80 shadow-sm space-y-3">
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    {category}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {categorySides.map((side) => {
                      const isSelected = selectedSides.some((s) => s.id === side.id);
                      return (
                        <button
                          key={side.id}
                          onClick={() => handleToggleSide(side)}
                          className={`p-3 rounded-xl text-left border-2 transition-all duration-200 touch-manipulation min-h-[52px] ${
                            isSelected
                              ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100/50 shadow-sm'
                              : 'border-border bg-card hover:border-green-200 hover:bg-muted/50 active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">{side.name}</span>
                            {isSelected && (
                              <div className="bg-green-500 rounded-full p-1 flex-shrink-0">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                          {side.price_per_gram > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              +{formatPrice(side.price_per_gram * selectedSize.weight_grams, currency)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Total e seletor de quantidade */}
          {selectedSize && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('menu.total')}: {formatPrice(calculatePrice() * quantity, currency)}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 disabled:opacity-40 touch-manipulation"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 touch-manipulation"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Observações */}
          {selectedSize && (
            <Textarea
              placeholder={t('productCard.observationsPlaceholder')}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className="rounded-lg border-border bg-muted/50 focus:bg-card focus:ring-1 focus:ring-primary/30 min-h-[80px] resize-none text-sm touch-manipulation"
            />
          )}
          </div>
        </div>

        {/* Footer — botão Adicionar ao Carrinho */}
        <footer className="flex-shrink-0 p-4 bg-card border-t border-border" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <Button
            type="button"
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-colors active:scale-[0.99] touch-manipulation shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('marmitaModal.addToCart')}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
