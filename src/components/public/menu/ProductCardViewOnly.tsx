/**
 * Card horizontal minimalista para visualização (sem adicionar ao carrinho).
 * Abre modal ao clicar para ver detalhes.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product } from '@/types';
import { formatPrice, type CurrencyCode } from '@/lib/priceHelper';
import ProductAllergensLabelsBadges from './ProductAllergensLabelsBadges';
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
  /** grid = vertical (foto em destaque), beverage = horizontal compacto. Usa product.card_layout se não informado. */
  layout?: 'grid' | 'beverage';
}

export default function ProductCardViewOnly({ product, currency, comboItems, layout }: ProductCardViewOnlyProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isVertical = (layout ?? product.card_layout) !== 'beverage';
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
        className={`group w-full text-left rounded-2xl overflow-hidden bg-card/90 border border-border backdrop-blur-sm transition-all duration-200 active:scale-[0.995] hover:shadow-md hover:border-border touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 ${
          isVertical ? 'flex flex-col' : 'flex items-stretch gap-3 sm:gap-4'
        }`}
      >
        <div className={`relative overflow-hidden bg-muted ring-1 ring-border ${
          isVertical
            ? 'w-full aspect-[4/3] rounded-2xl'
            : 'w-[120px] sm:w-[140px] min-w-[120px] sm:min-w-[140px] min-h-[120px] sm:min-h-[140px] flex-shrink-0 self-stretch rounded-2xl'
        }`}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className={isVertical ? 'text-5xl opacity-20' : 'text-3xl opacity-20'}>🍽</span>
            </div>
          )}
        </div>
        <div className={`flex-1 min-w-0 flex flex-col ${isVertical ? 'justify-center p-3 sm:p-4' : 'justify-center py-3.5 pr-3 sm:py-4 sm:pr-4 pl-0'}`}>
          <h3 className="font-medium text-foreground text-[15px] sm:text-base leading-snug line-clamp-2">
            {product.name}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">{subtitle}</p>
          )}
          {(product.allergens?.length || product.labels?.length) ? (
            <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} compact className="mt-2" />
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatPrice(Number(product.price), currency)}
            </span>
            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </div>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-border">
          <div className="relative w-full aspect-[3/4] max-h-[50vh] overflow-hidden rounded-2xl bg-muted flex-shrink-0">
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
              <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground pr-8">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            {(product.description || (comboItems && comboItems.length > 0)) && (
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                {comboItems && comboItems.length > 0
                  ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
                  : product.description}
              </p>
            )}
            {(product.allergens?.length || product.labels?.length) ? (
              <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} className="mt-1" />
            ) : null}
            <p className="text-foreground font-bold text-lg sm:text-xl tabular-nums mt-1">
              {formatPrice(Number(product.price), currency)}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2 rounded-xl border-border"
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
