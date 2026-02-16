import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Pizza, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-premium-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20 overflow-hidden"
      onClick={onClick}
    >
      <div className="relative overflow-hidden">
        {product.image_url ? (
          <>
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </>
        ) : (
          <div className="w-full h-52 gradient-card flex items-center justify-center">
            <Pizza className="h-16 w-16 text-primary/30 group-hover:text-primary/50 transition-colors" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {product.is_pizza && (
            <Badge className="gradient-primary shadow-md border-0 text-white font-semibold">
              <Pizza className="h-3 w-3 mr-1" />
              Pizza
            </Badge>
          )}
        </div>
        
        {/* Botão de adicionar no hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button 
            size="lg" 
            className="gradient-primary shadow-premium font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Plus className="h-5 w-5 mr-2" />
            {product.is_pizza ? 'Personalizar' : 'Adicionar'}
          </Button>
        </div>
      </div>
      
      <CardContent className="p-5">
        <div className="space-y-2">
          <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div>
              {product.is_pizza && (
                <span className="text-xs text-muted-foreground block mb-1">
                  A partir de
                </span>
              )}
              <span className="text-2xl font-bold text-gradient">
                {formatCurrency(product.price)}
              </span>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 text-xs text-primary font-medium">
                <Sparkles className="h-3 w-3" />
                Ver mais
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
