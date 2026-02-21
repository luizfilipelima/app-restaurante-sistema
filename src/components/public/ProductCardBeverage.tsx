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
      className={`group flex items-stretch gap-3 sm:gap-4 rounded-2xl overflow-hidden transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-white border-2 border-orange-200 shadow-md shadow-orange-100'
          : 'bg-white border border-slate-100 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-lg touch-manipulation' : ''}`}
    >
      {/* Imagem — quadrada à esquerda */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden bg-slate-100 rounded-xl">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-30">🍹</span>
          </div>
        )}
        {(isOffer || isCombo) && (
          <div className="absolute top-1 left-1 flex gap-1">
            {isOffer && (
              <span className="text-[9px] font-bold uppercase bg-[#F26812] text-white px-1.5 py-0.5 rounded-full">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[9px] font-bold uppercase bg-white/95 text-slate-700 px-1.5 py-0.5 rounded-full border border-slate-200/60">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo — direito */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-2 sm:py-2.5 pr-3 sm:pr-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-1">
            {product.name}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 leading-tight line-clamp-1">
              {subtitle.length > 40 ? `${subtitle.slice(0, 40)}...` : subtitle}
            </p>
          )}
        </div>

        {/* Preço + botão — alinhados na base */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-xs text-slate-400 line-through mr-1.5 block">
                {formatCurrency(offer.originalPrice, currency)}
              </span>
            )}
            <span className="text-base font-bold text-slate-900 tabular-nums">
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
              className="flex-shrink-0 flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors touch-manipulation"
            >
              <span className="text-sm font-medium">{t('productCard.add')}</span>
              <span className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white group-hover:bg-[#F26812] transition-colors">
                <Plus className="h-4 w-4" aria-hidden />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCardBeverage);
