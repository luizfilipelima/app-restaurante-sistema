/**
 * Card horizontal minimalista para visualização (sem adicionar ao carrinho).
 * Abre modal ao clicar para ver detalhes.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product } from '@/types';
import { formatPrice, type CurrencyCode } from '@/lib/priceHelper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface ProductCardViewOnlyProps {
  product: Product;
  currency: CurrencyCode;
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  /** Ignorado: todos os cards usam layout horizontal */
  layout?: 'grid' | 'beverage';
}

export default function ProductCardViewOnly({ product, currency, comboItems }: ProductCardViewOnlyProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const subtitle =
    product.description ??
    (comboItems?.length
      ? comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')
      : null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full text-left flex items-stretch gap-4 rounded-2xl overflow-hidden bg-white/80 border border-slate-100/80 backdrop-blur-sm transition-all duration-200 active:scale-[0.995] hover:shadow-md hover:border-slate-200/80 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2"
      >
        <div className="relative w-24 sm:w-28 flex-shrink-0 aspect-square overflow-hidden rounded-xl bg-slate-50">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl opacity-20">🍽</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center py-3 pr-3 sm:py-4 sm:pr-4">
          <h3 className="font-medium text-slate-900 text-[15px] sm:text-base leading-snug line-clamp-2">
            {product.name}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">{subtitle}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {formatPrice(Number(product.price), currency)}
            </span>
            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center transition-all duration-200 group-hover:bg-orange-500 group-hover:text-white">
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </div>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-slate-200/80">
          <div className="relative w-full aspect-[3/4] max-h-[50vh] overflow-hidden rounded-t-2xl bg-slate-50 flex-shrink-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl opacity-30">🍽</span>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-slate-900 pr-8">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            {(product.description || (comboItems && comboItems.length > 0)) && (
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {comboItems && comboItems.length > 0
                  ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
                  : product.description}
              </p>
            )}
            <p className="text-slate-900 font-bold text-lg sm:text-xl tabular-nums mt-1">
              {formatPrice(Number(product.price), currency)}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2 rounded-xl border-slate-200"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4 mr-2" />
              {t('menuViewOnly.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
