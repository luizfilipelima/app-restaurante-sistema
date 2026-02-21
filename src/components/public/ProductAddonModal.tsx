/**
 * Modal de produto com addons — minimalista, mobile first.
 * Card com margens, cantos arredondados, foto compacta, CTA claro.
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus, X, Check } from 'lucide-react';

interface AddonItem {
  id: string;
  name: string;
  price: number;
}

interface AddonGroup {
  id: string;
  name: string;
  items: AddonItem[];
}

interface ProductAddonModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  addonGroups: AddonGroup[];
  currency: CurrencyCode;
  basePrice: number;
  onAddToCart: (params: {
    quantity: number;
    unitPrice: number;
    addons: Array<{ addonItemId: string; name: string; price: number }>;
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
  onAddToCart,
}: ProductAddonModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<
    Array<{ addonItemId: string; name: string; price: number }>
  >([]);
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (open) {
      setObservations('');
    }
  }, [open]);

  const toggleAddon = (item: AddonItem) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.addonItemId === item.id);
      if (exists) return prev.filter((a) => a.addonItemId !== item.id);
      return [...prev, { addonItemId: item.id, name: item.name, price: item.price }];
    });
  };

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice + addonsTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    onAddToCart({
      quantity,
      unitPrice,
      addons: selectedAddons,
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
        className="max-w-md w-[calc(100vw-32px)] sm:w-full max-h-[calc(100dvh-32px)] sm:max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-slate-200/80 shadow-xl bg-white"
      >
        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 relative">
          <div className="p-4 sm:p-5 pt-14 sm:pt-5 space-y-4 pb-[env(safe-area-inset-bottom)] sm:pb-6">
            {/* Cabeçalho: imagem à esquerda, nome e preço à direita */}
            <div className="flex gap-4">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200/60">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl opacity-40">🍽</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between pr-10">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {product.name}
                  </h2>
                  <p className="text-base font-bold text-orange-600 mt-1 tabular-nums">
                    {formatCurrency(basePrice, currency)}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all touch-manipulation"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Descrição */}
            {product.description && (
              <p className="text-sm text-slate-500 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Addons */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {group.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => {
                    const isSelected = selectedAddons.some((a) => a.addonItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAddon(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all touch-manipulation ${
                          isSelected
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 active:scale-[0.98]'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                        <span>{item.name}</span>
                        {item.price > 0 && (
                          <span className="text-xs opacity-80">
                            +{formatCurrency(item.price, currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-600">
                {t('productCard.observations')}{' '}
                <span className="text-slate-400 font-normal">({t('cart.optional')})</span>
              </Label>
              <Textarea
                placeholder={t('productCard.observationsPlaceholder')}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 min-h-[72px] resize-none text-sm touch-manipulation"
              />
            </div>

            {/* Quantidade */}
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-sm font-medium text-slate-600">Quantidade</span>
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 touch-manipulation"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-semibold text-slate-900 tabular-nums text-sm">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-10 w-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 touch-manipulation"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Total e botão — com espaço, não grudado */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-slate-500">{t('menu.total')}</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(total, currency)}
              </span>
            </div>
            <div className="pt-4 pb-2">
              <Button
                onClick={handleAdd}
                className="w-full h-12 rounded-xl bg-[#F26812] hover:bg-[#E05D10] text-white font-semibold text-base active:scale-[0.98] transition-all touch-manipulation shadow-md shadow-orange-500/25"
              >
                {t('productCard.addToCart')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
