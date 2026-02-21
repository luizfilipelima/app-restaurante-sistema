/**
 * Modal de produto com addons — mobile first, foco em UX.
 * Layout full-viewport no mobile, imagem hero, addons em chips, CTA fixo.
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, X, Check } from 'lucide-react';

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
        className="max-w-md w-[calc(100vw-24px)] sm:w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl border-0 sm:border shadow-none sm:shadow-xl bg-white"
      >
        {/* Hero image */}
        <div className="relative w-full min-h-[35vh] sm:min-h-[200px] max-h-[40vh] sm:max-h-[260px] bg-slate-100 flex-shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-6xl sm:text-7xl opacity-50">🍽</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10 h-11 w-11 sm:h-10 sm:w-10 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all touch-manipulation"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-5 sm:p-6 pb-6 space-y-5">
            {/* Nome, descrição, preço base */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-sm sm:text-base text-slate-500 mt-2 leading-relaxed line-clamp-2">
                  {product.description}
                </p>
              )}
              <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-3 tabular-nums">
                {formatCurrency(basePrice, currency)}
              </p>
            </div>

            {/* Addons por grupo */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  {group.name}
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {group.items.map((item) => {
                    const isSelected = selectedAddons.some((a) => a.addonItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAddon(item)}
                        className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all touch-manipulation min-h-[48px] ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50 active:scale-[0.98]'
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                        <span>{item.name}</span>
                        {item.price > 0 && (
                          <span className="text-xs opacity-90">
                            +{formatCurrency(item.price, currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Observação */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">
                {t('productCard.observations')}{' '}
                <span className="text-slate-400 font-normal">({t('cart.optional')})</span>
              </Label>
              <Textarea
                placeholder={t('productCard.observationsPlaceholder')}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 min-h-[88px] resize-none text-base touch-manipulation"
              />
            </div>

            {/* Quantidade */}
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-sm font-semibold text-slate-600">Quantidade</span>
              <div className="flex items-center gap-1 rounded-xl border-2 border-slate-200 bg-slate-50/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-12 w-12 sm:h-11 sm:w-11 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="w-12 sm:w-10 text-center font-bold text-lg text-slate-900 tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-12 w-12 sm:h-11 sm:w-11 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="flex-shrink-0 p-5 sm:p-6 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)] sm:pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(total, currency)}
            </span>
          </div>
          <Button
            onClick={handleAdd}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-base sm:text-lg shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all touch-manipulation"
          >
            <Plus className="h-6 w-6 mr-2" />
            {t('productCard.add')} {quantity}x — {formatCurrency(total, currency)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
