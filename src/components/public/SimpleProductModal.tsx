/**
 * Modal de produto simples — mobile first, foco em UX.
 * Layout full-viewport no mobile, imagem hero, CTA fixo e touch targets amplos.
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Plus, Minus, X } from 'lucide-react';

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  basePrice: number;
  currency?: CurrencyCode;
}

export default function SimpleProductModal({
  open,
  onClose,
  product,
  basePrice,
  currency = 'BRL',
}: SimpleProductModalProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setObservations('');
    }
  }, [open]);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: basePrice,
      observations: observations.trim() || undefined,
    });
    toast({
      title: '✅ Adicionado ao carrinho!',
      description: `${product.name} foi adicionado`,
      className: 'bg-green-50 border-green-200',
    });
    onClose();
  };

  const total = basePrice * quantity;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        className="max-w-md w-[calc(100vw-24px)] sm:w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl border-0 sm:border shadow-none sm:shadow-xl bg-white"
      >
        {/* Hero image — 40vh no mobile, destaque visual */}
        <div className="relative w-full min-h-[40vh] sm:min-h-[220px] max-h-[45vh] sm:max-h-[280px] bg-slate-100 flex-shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-7xl sm:text-8xl opacity-50">🍽</span>
            </div>
          )}
          {/* Overlay gradiente sutil */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          {/* Botão fechar — thumb zone, alto contraste */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10 h-11 w-11 sm:h-10 sm:w-10 rounded-full bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all touch-manipulation"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-5 sm:p-6 pb-6 space-y-5">
            {/* Nome e preço — hierarquia clara */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-sm sm:text-base text-slate-500 mt-2 leading-relaxed">
                  {product.description}
                </p>
              )}
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 mt-4 tabular-nums">
                {formatCurrency(basePrice, currency)}
              </p>
            </div>

            {/* Observação — KDS/cozinha */}
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
                className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 min-h-[88px] resize-none text-base touch-manipulation"
              />
            </div>

            {/* Quantidade — touch targets 44px+ */}
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

        {/* Footer fixo — CTA sempre visível, fora do scroll */}
        <div className="flex-shrink-0 p-5 sm:p-6 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)] sm:pb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(total, currency)}
              </span>
            </div>
            <Button
              onClick={handleAddToCart}
              className="w-full h-14 sm:h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-base sm:text-lg shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all touch-manipulation"
            >
              <Plus className="h-6 w-6 mr-2" />
              {t('productCard.add')} {quantity}x — {formatCurrency(total, currency)}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
