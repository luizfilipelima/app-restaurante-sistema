/**
 * Modal de produto com addons — design clean e minimalista.
 * Imagem 4:3 centralizada, addons, seletor de quantidade, botão único "Adicionar ao Carrinho".
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus, ArrowLeft, Check } from 'lucide-react';

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
        className="max-w-md w-[calc(100vw-24px)] sm:w-full max-h-[calc(100dvh-24px)] sm:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-xl bg-white"
      >
        {/* Header minimalista */}
        <header className="flex-shrink-0 flex items-center h-12 px-4 border-b border-slate-100/80">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 active:scale-95 transition-all touch-manipulation"
            aria-label={t('productCard.details')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4 sm:p-5 space-y-5">
            {/* Imagem 4:3 centralizada */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 flex justify-center items-center">
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

            {/* Info do produto */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                {product.name}
              </h3>
              <p className="text-base font-semibold text-orange-600 tabular-nums">
                {formatCurrency(basePrice, currency)}
              </p>
              {product.description && (
                <p className="text-sm text-slate-500 leading-relaxed pt-1">
                  {product.description}
                </p>
              )}
            </div>

            {/* Seletor de quantidade — compacto */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">
                {t('menu.total')}: {formatCurrency(total, currency)}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 touch-manipulation transition-colors"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-semibold text-slate-900 tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-9 w-9 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 active:scale-95 touch-manipulation transition-all"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Addons */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {group.name}
                </h4>
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
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/50 active:scale-[0.98]'
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
              <Label className="text-xs font-medium text-slate-500">
                {t('productCard.observations')}{' '}
                <span className="font-normal">({t('cart.optional')})</span>
              </Label>
              <Textarea
                placeholder={t('productCard.observationsPlaceholder')}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-orange-500/30 min-h-[64px] resize-none text-sm touch-manipulation"
              />
            </div>
          </div>
        </div>

        {/* Rodapé — botão único "Adicionar ao Carrinho" */}
        <footer
          className="flex-shrink-0 p-4 pt-0 bg-white border-t border-slate-100/80"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base transition-colors active:scale-[0.99] touch-manipulation shadow-sm"
          >
            {t('productCard.addToCart')}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
