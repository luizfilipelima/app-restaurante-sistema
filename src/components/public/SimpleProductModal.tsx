/**
 * Modal de detalhes do produto — design clean e minimalista.
 * Imagem 4:3 centralizada, seletor de quantidade, botão único "Adicionar ao Carrinho".
 */
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Minus, Plus, ArrowLeft } from 'lucide-react';

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  basePrice: number;
  currency?: CurrencyCode;
  convertForDisplay?: (value: number) => number;
}

export default function SimpleProductModal({
  open,
  onClose,
  product,
  basePrice,
  currency = 'BRL',
  convertForDisplay,
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
  const fmt = (v: number) => formatCurrency(convertForDisplay ? convertForDisplay(v) : v, currency);

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
                {fmt(basePrice)}
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
                {t('menu.total')}: {fmt(total)}
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
          className="flex-shrink-0 p-4 pt-0 bg-white"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base transition-colors active:scale-[0.99] touch-manipulation shadow-sm"
          >
            {t('productCard.addToCart')}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
