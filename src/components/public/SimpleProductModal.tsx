/**
 * Modal de produto simples — minimalista, mobile first.
 * Card com margens, cantos arredondados, foto compacta, CTA claro.
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
import { Minus, Plus, X } from 'lucide-react';

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
        className="max-w-md w-[calc(100vw-32px)] sm:w-full max-h-[calc(100dvh-32px)] sm:max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-slate-200/80 shadow-xl bg-white"
      >
        {/* Foto compacta */}
        <div className="relative w-full h-[140px] sm:h-[160px] bg-slate-100 flex-shrink-0 rounded-t-2xl overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <span className="text-4xl opacity-40">🍽</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-slate-600 hover:bg-white active:scale-95 transition-all touch-manipulation"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-sm text-slate-500 mt-1 leading-snug">
                  {product.description}
                </p>
              )}
              <p className="text-lg font-bold text-orange-600 mt-2 tabular-nums">
                {formatCurrency(basePrice, currency)}
              </p>
            </div>

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

            <div className="flex items-center justify-between py-2 border-t border-slate-100">
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
          </div>
        </div>

        {/* Footer — botão: "Adicionar" + preço */}
        <div className="flex-shrink-0 p-4 sm:p-5 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)] sm:pb-5">
          <Button
            onClick={handleAddToCart}
            className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base active:scale-[0.98] transition-all touch-manipulation"
          >
            {t('productCard.add')} {formatCurrency(total, currency)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
