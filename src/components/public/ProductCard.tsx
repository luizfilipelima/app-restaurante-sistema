/**
 * Card horizontal minimalista para produtos no cardápio.
 * Layout: imagem à esquerda, nome, descrição, preço e ícone + à direita.
 */
import { memo } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

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
      className={`group flex items-stretch gap-4 rounded-2xl overflow-hidden transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-white border border-orange-100 shadow-sm'
          : 'bg-white/80 border border-slate-100/80 backdrop-blur-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.995] hover:shadow-md hover:border-slate-200/80 touch-manipulation' : ''}`}
    >
      {/* Imagem à esquerda — proporção quadrada para visual mais equilibrado */}
      <div className="relative w-24 sm:w-28 flex-shrink-0 aspect-square overflow-hidden rounded-xl bg-slate-50">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-orange-500 text-white px-2 py-0.5 rounded-md">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-white/95 text-slate-600 px-2 py-0.5 rounded-md shadow-sm">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-3 pr-3 sm:py-4 sm:pr-4">
        <h3 className="font-medium text-slate-900 text-[15px] sm:text-base leading-snug line-clamp-2">
          {product.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">
            {subtitle}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-xs text-slate-400 line-through mr-2">
                {formatCurrency(convertForDisplay ? convertForDisplay(offer.originalPrice) : offer.originalPrice, currency)}
              </span>
            )}
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
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
              className="flex-shrink-0 h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center transition-all duration-200 group-hover:bg-orange-500 group-hover:text-white hover:scale-105 active:scale-95 touch-manipulation"
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
