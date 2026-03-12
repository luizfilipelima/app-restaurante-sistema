/**
 * Card horizontal minimalista para produtos no cardápio.
 * Layout: imagem à esquerda, nome, descrição, preço e ícone + à direita.
 */
import { memo } from 'react';
import { Product } from '@/types';
import { type CurrencyCode } from '@/lib/core/utils';
import { formatPrice } from '@/lib/priceHelper';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import ProductAllergensLabelsBadges from './ProductAllergensLabelsBadges';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  readOnly?: boolean;
  currency?: CurrencyCode;
  /** Converte valor da moeda base para moeda de exibição. Se não informado, usa valor direto. */
  convertForDisplay?: (value: number) => number;
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  offer?: { price: number; originalPrice: number; label?: string | null };
}

function ProductCard({ product, onClick, readOnly = false, currency = 'BRL', convertForDisplay, comboItems, offer }: ProductCardProps) {
  const { t } = useTranslation();
  const hasImage = !!product.image_url;
  const isCombo = product.is_combo || (comboItems && comboItems.length > 0);
  const isOffer = !!offer;
  const rawPrice = offer ? offer.price : Number(product.price_sale || product.price);
  const displayPrice = convertForDisplay ? convertForDisplay(rawPrice) : rawPrice;
  const subtitle =
    product.description ??
    (isCombo && comboItems?.length
      ? comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')
      : null);

  const handleClick = () => {
    if (!readOnly) onClick?.();
  };

  return (
    <div
      role={readOnly ? undefined : 'button'}
      tabIndex={readOnly ? undefined : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group flex items-stretch gap-3 sm:gap-4 rounded-2xl overflow-hidden transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-card border border-primary/30 shadow-sm'
          : 'bg-card/95 border border-border backdrop-blur-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.995] hover:shadow-md hover:border-border touch-manipulation' : ''}`}
    >
      {/* Imagem à esquerda — ajusta à altura do card, bordas arredondadas, min 120px */}
      <div className="relative w-[120px] sm:w-[140px] min-w-[120px] sm:min-w-[140px] min-h-[120px] sm:min-h-[140px] flex-shrink-0 self-stretch overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl opacity-20">🍽</span>
          </div>
        )}
        {(isOffer || isCombo) && (
          <div className="absolute top-2 left-2 flex gap-1">
            {isOffer && (
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-card text-muted-foreground px-2 py-0.5 rounded-md shadow-sm">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col justify-center pt-[22px] pr-[15px] pb-[15px] pl-0">
        <h3 className="font-medium text-foreground text-[15px] sm:text-base leading-snug line-clamp-2 overflow-visible">
          {product.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
            {subtitle}
          </p>
        )}
        {(product.allergens?.length || product.labels?.length) ? (
          <ProductAllergensLabelsBadges allergens={product.allergens} labels={product.labels} compact className="mt-2" />
        ) : null}
        <div className="mt-2.5 flex items-center justify-between gap-3 box-content">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-xs text-muted-foreground line-through mr-2">
                {formatPrice(convertForDisplay ? convertForDisplay(offer.originalPrice) : offer.originalPrice, currency)}
              </span>
            )}
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatPrice(displayPrice, currency)}
            </span>
          </div>

          {!readOnly && (
            <button
              type="button"
              data-testid={`product-add-${product.id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick?.();
              }}
              className="flex-shrink-0 h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground hover:scale-105 active:scale-95 touch-manipulation"
              aria-label={t('productCard.add')}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
