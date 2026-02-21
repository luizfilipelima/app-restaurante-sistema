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
      className={`group flex flex-col rounded-xl overflow-hidden transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-white border-2 border-orange-200 shadow-sm shadow-orange-100/80'
          : 'bg-white border border-slate-100/80 shadow-sm'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.99] hover:shadow-md touch-manipulation' : ''}`}
    >
      {/* Imagem — proporção mais compacta */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-slate-100 flex-shrink-0">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-25">🍽</span>
          </div>
        )}
        {(isOffer || isCombo) && (
          <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
            {isOffer && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-[#F26812] text-white px-1.5 py-0.5 rounded-md">
                Oferta
              </span>
            )}
            {isCombo && !isOffer && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-white/95 backdrop-blur-sm text-slate-700 px-1.5 py-0.5 rounded-md shadow-sm border border-slate-200/60">
                Combo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo compacto */}
      <div className="flex-1 flex flex-col p-2.5 sm:p-3 min-h-0">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        {(product.description || (isCombo && comboItems?.length)) && (
          <p className="mt-0.5 text-[11px] text-slate-500 leading-tight line-clamp-1 flex-shrink-0">
            {isCombo && comboItems && comboItems.length > 0
              ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
              : product.description}
          </p>
        )}

        {/* Preço + CTA minimalista */}
        <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            {isOffer && (
              <span className="text-[10px] text-slate-400 line-through mr-1">{formatCurrency(offer.originalPrice, currency)}</span>
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
              className={`flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg ${CTA_BG} ${CTA_HOVER} active:scale-[0.97] text-white font-medium text-xs shadow-sm transition-all touch-manipulation`}
            >
              <span>{t('productCard.add')}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
