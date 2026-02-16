import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Pizza } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <div className="relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
            <Pizza className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        {product.is_pizza && (
          <Badge className="absolute top-2 right-2">Pizza</Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-bold text-primary">
            {product.is_pizza ? 'A partir de ' : ''}
            {formatCurrency(product.price)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
