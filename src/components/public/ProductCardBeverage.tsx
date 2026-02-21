/**
 * Card horizontal padrão para produtos no cardápio.
 * Layout: imagem 3:4 à esquerda, nome, descrição, preço e ícone + à direita.
 * Design minimalista e elegante com bordas arredondadas.
 */
import { memo } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface ProductCardBeverageProps {
  product: Product;
  onClick?: () => void;
  readOnly?: boolean;
  currency?: CurrencyCode;
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  offer?: { price: number; originalPrice: number; label?: string | null };
}

function ProductCardBeverage({
  product,
  onClick,
  readOnly = false,
  currency = 'BRL',
  comboItems,
  offer,
}: ProductCardBeverageProps) {
  const { t } = useTranslation();
  const hasImage = !!product.image_url;
  const isCombo = product.is_combo || (comboItems && comboItems.length > 0);
  const isOffer = !!offer;
  const displayPrice = offer ? offer.price : Number(product.price_sale || product.price);
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
          ? 'bg-white border border-orange-200/80 shadow-md shadow-orange-50'
          : 'bg-white border border-slate-100 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-lg hover:border-slate-200/80 touch-manipulation' : ''}`}
    >
      {/* Imagem 3:4 à esquerda — bordas arredondadas */}
      <div className="relative w-20 sm:w-24 flex-shrink-0 aspect-[3/4] overflow-hidden rounded-xl bg-slate-100">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-20">🍽</span>
          </div>
        )}
        {(isOffer || isCombo) && (
          <div className="absolute top-1.5 left-1.5 flex gap-1">
            {isOffer && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-orange-500 text-white px-2 py-0.5 rounded-md shadow-sm">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-white/95 backdrop-blur-sm text-slate-600 px-2 py-0.5 rounded-md shadow-sm border border-slate-200/60">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
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
          <div className="min-w-0">
            {isOffer && (
              <span className="text-[11px] text-slate-400 line-through mr-1.5">
                {formatCurrency(offer.originalPrice, currency)}
              </span>
            )}
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums">
              {formatCurrency(displayPrice, currency)}
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
              className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center transition-all duration-200 group-hover:bg-orange-500 group-hover:text-white hover:scale-105 active:scale-95 touch-manipulation"
              aria-label={t('productCard.add')}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCardBeverage);
