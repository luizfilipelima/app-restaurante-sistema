import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product } from '@/types';
import { formatPrice, type CurrencyCode } from '@/lib/priceHelper';
import { shouldUseBeverageCard } from '@/lib/productCardLayout';
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
  /** Sobrescreve a detecção automática: 'grid' = vertical, 'beverage' = horizontal */
  layout?: 'grid' | 'beverage';
}

export default function ProductCardViewOnly({ product, currency, comboItems, layout }: ProductCardViewOnlyProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isBeverage = layout ? layout === 'beverage' : shouldUseBeverageCard(product);
  const subtitle = product.description ?? (comboItems?.length ? comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ') : null);

  const cardButton = isBeverage ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group w-full text-left flex items-stretch gap-3 sm:gap-4 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm transition-all duration-200 active:scale-[0.99] hover:shadow-lg hover:border-slate-200/80 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <div className="relative w-20 sm:w-24 flex-shrink-0 aspect-[3/4] overflow-hidden rounded-xl bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-20">🍽</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center py-3 pr-3 sm:py-4 sm:pr-4">
        <h3 className="font-semibold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
          {product.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">
            {subtitle}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums">
            {formatPrice(Number(product.price), currency)}
          </span>
          <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center transition-all duration-200 group-hover:bg-orange-500 group-hover:text-white">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} aria-hidden />
          </div>
        </div>
      </div>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 transition-all duration-200 active:scale-[0.99] hover:shadow-lg hover:border-slate-200/80 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-t-2xl bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">🍽</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 h-9 w-9 rounded-xl bg-white/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-slate-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 leading-tight line-clamp-1">
            {subtitle}
          </p>
        )}
        <p className="mt-2 text-sm font-bold text-slate-900 tabular-nums">
          {formatPrice(Number(product.price), currency)}
        </p>
      </div>
    </button>
  );

  return (
    <>
      {cardButton}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-slate-200/80">
          <div className="relative w-full aspect-[3/4] max-h-[50vh] overflow-hidden rounded-t-2xl bg-slate-100 flex-shrink-0">
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
