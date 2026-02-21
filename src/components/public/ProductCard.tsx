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

/** Cor do CTA — alinhada ao Cart FAB e Finalizar Pedido */
const CTA_BG = 'bg-[#F26812]';
const CTA_HOVER = 'hover:bg-[#E05D10]';

function ProductCard({ product, onClick, readOnly = false, currency = 'BRL', comboItems, offer }: ProductCardProps) {
  const { t } = useTranslation();
  const hasImage = !!product.image_url;
  const isCombo = product.is_combo || (comboItems && comboItems.length > 0);
  const isOffer = !!offer;
  const displayPrice = offer ? offer.price : Number(product.price_sale || product.price);

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
      className={`group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-white border-2 border-orange-200 shadow-md shadow-orange-100'
          : 'bg-white border border-slate-100 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-lg touch-manipulation' : ''}`}
    >
      {/* Imagem em destaque (topo, referência) */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-slate-100 flex-shrink-0">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-30">🍽</span>
          </div>
        )}
        {/* Badges */}
        {(isOffer || isCombo) && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            {isOffer && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-[#F26812] text-white px-2 py-1 rounded-full shadow-sm">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-white/95 backdrop-blur-sm text-slate-700 px-2 py-1 rounded-full shadow-sm border border-slate-200/60">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 min-h-0">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
          {product.name}
        </h3>
        {(product.description || (isCombo && comboItems?.length)) && (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2 flex-shrink-0">
            {isCombo && comboItems && comboItems.length > 0
              ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
              : product.description}
          </p>
        )}

        {/* Preço + CTA — estilo Cart FAB */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-xs text-slate-400 line-through mr-1.5">{formatCurrency(offer.originalPrice, currency)}</span>
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
              className={`flex-shrink-0 flex items-center gap-2 h-11 px-4 rounded-xl ${CTA_BG} ${CTA_HOVER} active:scale-[0.97] text-white font-semibold text-sm shadow-md shadow-orange-500/25 transition-all touch-manipulation`}
            >
              <span>{t('productCard.addToCart')}</span>
              <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
