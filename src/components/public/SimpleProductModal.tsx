import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Plus, Minus } from 'lucide-react';

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  basePrice: number;
  currency?: CurrencyCode;
}

export default function SimpleProductModal({
  open,
  onClose,
  product,
  basePrice,
  currency = 'BRL',
}: SimpleProductModalProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setObservations('');
    }
  }, [open]);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: basePrice,
      observations: observations.trim() || undefined,
    });
    toast({
      title: '✅ Adicionado ao carrinho!',
      description: `${product.name} foi adicionado`,
      className: 'bg-green-50 border-green-200',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Imagem ampliada */}
        <div className="relative w-full aspect-square sm:aspect-[4/3] bg-slate-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-6xl opacity-60">🍽</span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-slate-500 mt-2 line-clamp-3">{product.description}</p>
            )}
            <p className="text-lg font-bold text-orange-600 mt-3">{formatCurrency(basePrice, currency)}</p>
          </div>

          {/* Observação — reflete no KDS/cozinha */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              {t('productCard.observations')} <span className="text-slate-400 font-normal">({t('cart.optional')})</span>
            </Label>
            <Textarea
              placeholder={t('productCard.observationsPlaceholder')}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white resize-none"
            />
          </div>

          {/* Quantidade + Total */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-bold text-lg">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(basePrice * quantity, currency)}</p>
            </div>
          </div>

          <Button
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-base shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all"
            onClick={handleAddToCart}
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('productCard.add')} {quantity}x — {formatCurrency(basePrice * quantity, currency)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
