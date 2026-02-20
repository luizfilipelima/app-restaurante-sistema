import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

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

export default function ProductCard({ product, onClick, readOnly = false, currency = 'BRL', comboItems, offer }: ProductCardProps) {
  const { t } = useTranslation();
  const hasImage = !!product.image_url;
  const isPizzaOrMarmita = product.is_pizza || product.is_marmita;
  const isCombo = product.is_combo || (comboItems && comboItems.length > 0);
  const isOffer = !!offer;
  const actionLabel = isPizzaOrMarmita ? t('productCard.customize') : t('productCard.add');

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
      className={`group flex items-stretch gap-0 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 w-full min-w-0 ${
        isOffer
          ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 hover:border-orange-400'
          : 'bg-white border border-slate-100'
      } ${!readOnly ? 'cursor-pointer active:scale-[0.98] active:shadow-md hover:shadow-md touch-manipulation' : ''}`}
    >
      {/* ── Imagem (direita, quadrada) ── */}
      {hasImage ? (
        <div className="relative flex-shrink-0 w-[100px] sm:w-[108px] self-stretch overflow-hidden bg-slate-100">
          <img
            src={product.image_url!}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Badge */}
          {(isOffer || isPizzaOrMarmita || isCombo) && (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {isOffer && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                  Oferta
                </span>
              )}
              {(isPizzaOrMarmita || isCombo) && !isOffer && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-white/90 backdrop-blur-sm text-slate-700 px-1.5 py-0.5 rounded-full shadow-sm">
                  {isCombo ? 'Combo' : product.is_pizza ? t('productCard.badgePizza') : t('productCard.badgeMarmita')}
                </span>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Conteúdo ── */}
      <div className={`flex-1 min-w-0 flex flex-col justify-between p-3 sm:p-3.5 ${!hasImage ? 'pl-4' : ''}`}>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
            {product.name}
          </h3>
          {(product.description || (isCombo && comboItems?.length)) && (
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2">
              {isCombo && comboItems && comboItems.length > 0
                ? `Inclui: ${comboItems.map((ci) => (ci.quantity > 1 ? `${ci.quantity}x ` : '') + ci.product.name).join(', ')}`
                : product.description}
            </p>
          )}
        </div>

        {/* Preço + botão */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
          <div>
            {isPizzaOrMarmita && !isOffer && (
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-none mb-0.5">
                {t('productCard.from')}
              </p>
            )}
            {isOffer ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 line-through">{formatCurrency(offer.originalPrice, currency)}</span>
                <span className="text-sm sm:text-base font-bold text-orange-600">{formatCurrency(offer.price, currency)}</span>
                {offer.label && <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">{offer.label}</span>}
              </div>
            ) : (
              <span className="text-sm sm:text-base font-bold text-slate-900">
                {formatCurrency(product.price, currency)}
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                {actionLabel}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClick?.();
                }}
                className="h-9 w-9 rounded-xl bg-slate-900 hover:bg-slate-700 active:bg-slate-800 active:scale-95 text-white flex items-center justify-center shadow-sm transition-all touch-manipulation flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
