import { memo } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  readOnly?: boolean;
  currency?: CurrencyCode;
  /** Itens incluídos no combo (quando product.is_combo) */
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  /** Quando o produto está em oferta — exibe preço riscado e destaque */
  offer?: { price: number; originalPrice: number; label?: string | null };
}

function ProductCard({ product, onClick, readOnly = false, currency = 'BRL', comboItems, offer }: ProductCardProps) {
  const { t } = useTranslation();
  const hasImage = !!product.image_url;
  const isPizzaOrMarmita = product.is_pizza || product.is_marmita;
  const isCombo = product.is_combo || (comboItems && comboItems.length > 0);
  const isOffer = !!offer;

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
      className={`group relative flex gap-3 sm:gap-4 rounded-2xl overflow-hidden transition-all duration-200 w-full min-w-0 min-h-[88px] ${
        isOffer
          ? 'bg-white border-2 border-orange-200 shadow-sm shadow-orange-100'
          : 'bg-white border border-slate-200/80 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-md touch-manipulation' : ''}`}
    >
      {/* Imagem — quadrada, touch-friendly */}
      {hasImage ? (
        <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 overflow-hidden bg-slate-100">
          <img
            src={product.image_url!}
            alt={product.name}
            width={112}
            height={112}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-active:scale-105"
            loading="lazy"
          />
          {(isOffer || isPizzaOrMarmita || isCombo) && (
            <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
              {isOffer && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-orange-500 text-white px-2 py-0.5 rounded-full">
                  Oferta
                </span>
              )}
              {(isPizzaOrMarmita || isCombo) && !isOffer && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-white/95 text-slate-700 px-2 py-0.5 rounded-full shadow-sm">
                  {isCombo ? 'Combo' : product.is_pizza ? t('productCard.badgePizza') : t('productCard.badgeMarmita')}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-100 flex items-center justify-center">
          <span className="text-3xl opacity-40">🍽</span>
        </div>
      )}

      {/* Conteúdo — hierarquia clara, área de toque ampla */}
      <div className={`flex-1 min-w-0 flex flex-col justify-center py-3 pr-3 sm:py-4 sm:pr-4 ${!hasImage ? 'pl-4' : ''}`}>
        <h3 className="font-semibold text-slate-900 text-[15px] sm:text-base leading-snug line-clamp-2 pr-6">
          {product.name}
        </h3>
        {(product.description || (isCombo && comboItems?.length)) && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-1 mt-0.5">
            {isCombo && comboItems && comboItems.length > 0
              ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
              : product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            {isPizzaOrMarmita && !isOffer && (
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                {t('productCard.from')}
              </span>
            )}
            {isOffer ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 line-through">{formatCurrency(offer.originalPrice, currency)}</span>
                <span className="text-base font-bold text-orange-600">{formatCurrency(offer.price, currency)}</span>
                {offer.label && (
                  <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                    {offer.label}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {formatCurrency(product.price, currency)}
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center group-active:bg-slate-700 transition-colors touch-manipulation">
              <ChevronRight className="h-5 w-5 -mr-0.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
