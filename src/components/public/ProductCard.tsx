import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <Card
      className="group cursor-pointer bg-white border border-slate-200/80 overflow-hidden rounded-xl sm:rounded-2xl w-full min-w-0 shadow-sm hover:shadow-lg active:shadow-md hover:border-slate-300/80 active:border-slate-300 transition-all duration-300 touch-manipulation"
      onClick={onClick}
    >
      <div className="relative w-full">
        <div className="relative w-full overflow-hidden bg-slate-100 aspect-[4/3] min-h-[140px] sm:min-h-[160px]">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-3xl sm:text-4xl opacity-60">🍕</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex gap-1.5 sm:gap-2">
          {product.is_pizza && (
            <Badge className="bg-white/95 text-slate-700 backdrop-blur-sm border-0 font-medium text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 shadow-sm">
              Pizza
            </Badge>
          )}
        </div>

        <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm flex items-center gap-1 sm:gap-1.5 border border-white/50">
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium uppercase tracking-wide hidden xs:inline">a partir</span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">{formatCurrency(product.price)}</span>
          </div>
        </div>
      </div>

      <CardContent className="p-3 sm:p-4">
        <div className="space-y-1 flex-1">
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base leading-tight group-hover:text-slate-700 transition-colors line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
              {product.description}
            </p>
          )}
        </div>

        <div
          className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between cursor-pointer touch-manipulation"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
        >
          <span className="text-slate-600 text-xs sm:text-sm font-medium group-hover:text-slate-900 transition-colors">
            {product.is_pizza ? 'Personalizar' : 'Adicionar'}
          </span>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white shadow-sm transition-all touch-manipulation active:scale-95"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}