/**
 * Modal de produto com addons — design baseado em referência UI/UX.
 * Imagem em destaque, addons, seletor de quantidade, rodapé com Total + CTA no estilo Cart FAB.
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus, ArrowLeft, ChevronRight, Check } from 'lucide-react';

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
        className="max-w-md w-[calc(100vw-24px)] sm:w-full max-h-[calc(100dvh-24px)] sm:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xl bg-white"
      >
        {/* Header fixo */}
        <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 -ml-2 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all touch-manipulation"
            aria-label={t('productCard.details')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 absolute left-1/2 -translate-x-1/2 pointer-events-none">
            {t('productCard.details')}
          </h2>
          <div className="w-10" aria-hidden />
        </header>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4 sm:p-5 pb-6 space-y-5">
            {/* Imagem em destaque — hero */}
            <div className="relative w-full aspect-[4/3] -mx-4 sm:-mx-5 mt-0 rounded-none sm:rounded-2xl overflow-hidden bg-slate-100">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl opacity-30">🍽</span>
                </div>
              )}
            </div>

            {/* Seletor de quantidade — estilo referência */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 touch-manipulation transition-colors"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="w-12 text-center text-xl font-bold text-slate-900 tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-11 w-11 rounded-full bg-[#F26812] flex items-center justify-center text-white hover:bg-[#E05D10] active:scale-95 touch-manipulation transition-all shadow-md shadow-orange-500/25"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Nome e descrição */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">
                {product.name}
              </h3>
              <p className="text-base font-semibold text-orange-600 mt-1 tabular-nums">
                {formatCurrency(basePrice, currency)}
              </p>
              {product.description && (
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            {/* Addons */}
            {addonGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all touch-manipulation ${
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
                className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 min-h-[72px] resize-none text-sm touch-manipulation"
              />
            </div>
          </div>
        </div>

        {/* Rodapé fixo — design Cart FAB */}
        <footer
          className="flex-shrink-0 border-t border-slate-100 bg-white"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="h-16 rounded-2xl overflow-hidden flex items-stretch mx-4 mb-4 mt-2 bg-slate-900 text-white shadow-xl shadow-slate-900/30">
            <div className="flex-1 flex items-center justify-start px-4 gap-3.5">
              <div className="flex flex-col items-start justify-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-tight">
                  {t('menu.total')}
                </span>
                <span className="text-base font-bold text-white leading-tight tabular-nums">
                  {formatCurrency(total, currency)}
                </span>
              </div>
            </div>
            <div className="w-[1px] bg-white/10 my-3" />
            <button
              type="button"
              onClick={handleAdd}
              className="px-6 flex items-center justify-center gap-2 min-w-[140px] bg-[#F26812] hover:bg-[#E05D10] text-white transition-colors active:scale-[0.98] touch-manipulation"
            >
              <span className="text-sm font-bold">{t('productCard.addToCart')}</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
