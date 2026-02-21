/**
 * Card horizontal para produtos da categoria Bebidas.
 * Layout: imagem à esquerda, informações à direita, preço e botão "Adicionar" no rodapé.
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
  /** Itens incluídos no combo (quando product.is_combo) */
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  /** Quando o produto está em oferta */
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
  const subtitle = product.description ?? (isCombo && comboItems?.length
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
      className={`group flex items-center gap-2.5 sm:gap-3 rounded-xl overflow-hidden transition-all duration-200 w-full min-w-0 py-2 px-2.5 sm:px-3 ${
        isOffer
          ? 'bg-white border-2 border-orange-200 shadow-sm shadow-orange-100/80'
          : 'bg-white border border-slate-100/80 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-md touch-manipulation' : ''}`}
    >
      {/* Thumbnail compacto à esquerda */}
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 overflow-hidden bg-slate-100 rounded-lg">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xl opacity-25">🍹</span>
          </div>
        )}
        {(isOffer || isCombo) && (
          <div className="absolute top-0.5 left-0.5 flex gap-0.5">
            {isOffer && (
              <span className="text-[8px] font-bold uppercase bg-[#F26812] text-white px-1 py-0.5 rounded">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[8px] font-bold uppercase bg-white/95 text-slate-700 px-1 py-0.5 rounded border border-slate-200/60">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo compacto */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-1">
          {product.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-slate-500 leading-tight line-clamp-1">
            {subtitle.length > 35 ? `${subtitle.slice(0, 35)}…` : subtitle}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-[10px] text-slate-400 line-through mr-1">
                {formatCurrency(offer.originalPrice, currency)}
              </span>
            )}
            <span className="text-sm font-bold text-slate-900 tabular-nums">
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
              className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-800 flex items-center justify-center text-white group-hover:bg-[#F26812] transition-colors touch-manipulation"
              aria-label={t('productCard.add')}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCardBeverage);
