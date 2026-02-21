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
  /** Layout do card: 'grid' = vertical padrão, 'beverage' = horizontal (sobrescreve product.card_layout) */
  layout?: 'grid' | 'beverage';
}

export default function ProductCardViewOnly({ product, currency, comboItems, layout }: ProductCardViewOnlyProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isBeverage = layout ? layout === 'beverage' : shouldUseBeverageCard(product);

  const cardButton = isBeverage ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full text-left flex items-stretch gap-3 sm:gap-4 rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm transition-all duration-200 active:scale-[0.99] hover:shadow-md touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden bg-slate-100 rounded-xl">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-30">🍹</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center py-2 pr-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-1">
          {product.name}
        </h3>
        <p className="mt-0.5 text-slate-700 font-semibold text-sm sm:text-base tabular-nums">
          {formatPrice(Number(product.price), currency)}
        </p>
      </div>
      <div className="flex items-center pr-3">
        <div className="p-1.5 rounded-lg bg-slate-100">
          <Plus className="h-4 w-4 text-slate-600" aria-hidden />
        </div>
      </div>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full text-left bg-white rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden border border-slate-200/80 transition-all duration-200 active:scale-[0.98] hover:shadow-md touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <div className="relative w-full aspect-square overflow-hidden bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            width={400}
            height={400}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-4xl opacity-60">🍽</span>
          </div>
        )}
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm">
          <Plus className="h-4 w-4 text-slate-600" aria-hidden />
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-medium text-slate-900 text-sm sm:text-base leading-tight line-clamp-2">
          {product.name}
        </h3>
        <p className="mt-1 text-slate-700 font-semibold text-sm sm:text-base tabular-nums">
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
          <div className="relative w-full aspect-square max-h-[50vh] overflow-hidden bg-slate-100 flex-shrink-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                width={400}
                height={400}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <span className="text-6xl opacity-60">🍽</span>
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
