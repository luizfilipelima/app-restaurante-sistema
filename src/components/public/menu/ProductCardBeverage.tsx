/**
 * Card horizontal para bebidas — usa o mesmo layout minimalista do ProductCard.
 */
import { memo } from 'react';
import ProductCard from './ProductCard';
import type { Product } from '@/types';
import type { CurrencyCode } from '@/lib/utils';

interface ProductCardBeverageProps {
  product: Product;
  onClick?: () => void;
  readOnly?: boolean;
  currency?: CurrencyCode;
  comboItems?: Array<{ product: { name: string }; quantity: number }>;
  offer?: { price: number; originalPrice: number; label?: string | null };
}

function ProductCardBeverage(props: ProductCardBeverageProps) {
  return <ProductCard {...props} />;
}

export default memo(ProductCardBeverage);
