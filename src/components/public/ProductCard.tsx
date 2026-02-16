import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Plus, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  featured?: boolean;
}

export default function ProductCard({ product, onClick, featured = false }: ProductCardProps) {
  return (
    <Card
      className={`group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-white overflow-hidden rounded-2xl w-full min-w-0 ${
        featured ? 'ring-2 ring-orange-100' : ''
      }`}
      onClick={onClick}
    >
      <div className="relative w-full">
        <div
          className={`relative w-full overflow-hidden bg-slate-200 ${
            featured ? 'aspect-[4/3] min-h-[140px]' : 'aspect-[4/3] min-h-[180px]'
          }`}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <span className="text-4xl">🍕</span>
            </div>
          )}
        </div>
        
        {/* Overlay gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {product.is_pizza && (
            <Badge className="bg-white/90 text-slate-800 hover:bg-white backdrop-blur-md shadow-sm border-0 font-semibold px-2">
              Pizza
            </Badge>
          )}
          {featured && (
            <Badge className="bg-red-500 text-white border-0 shadow-sm font-bold flex items-center gap-1 animate-pulse-subtle">
              <Flame className="h-3 w-3" /> Oferta
            </Badge>
          )}
        </div>

        {/* Price Tag Floating */}
        <div className="absolute bottom-3 right-3">
           <div className="bg-white rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1">
             <span className="text-xs text-slate-500 font-medium">a partir</span>
             <span className="text-sm font-bold text-slate-900">{formatCurrency(product.price)}</span>
           </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 flex-1">
            <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-orange-600 transition-colors">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>
        </div>
        
        <div
          className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between cursor-pointer"
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
          <span className="text-orange-600 text-sm font-medium group-hover:underline">
            {product.is_pizza ? 'Personalizar' : 'Ver detalhes'}
          </span>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 shadow-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
          >
            <Plus className="h-5 w-5 text-white" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}