import { useState } from 'react';
import { Product } from '@/types';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus } from 'lucide-react';

interface AddonItem {
  id: string;
  name: string;
  price: number;
}

interface AddonGroup {
  id: string;
  name: string;
  items: AddonItem[];
}

interface ProductAddonModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  addonGroups: AddonGroup[];
  currency: CurrencyCode;
  basePrice: number;
  onAddToCart: (params: { quantity: number; unitPrice: number; addons: Array<{ addonItemId: string; name: string; price: number }> }) => void;
}

export default function ProductAddonModal({
  open,
  onClose,
  product,
  addonGroups,
  currency,
  basePrice,
  onAddToCart,
}: ProductAddonModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Array<{ addonItemId: string; name: string; price: number }>>([]);

  const toggleAddon = (item: AddonItem) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.addonItemId === item.id);
      if (exists) return prev.filter((a) => a.addonItemId !== item.id);
      return [...prev, { addonItemId: item.id, name: item.name, price: item.price }];
    });
  };

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice + addonsTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    onAddToCart({ quantity, unitPrice, addons: selectedAddons });
    setSelectedAddons([]);
    setQuantity(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0" />
            )}
            <div>
              <h2 className="text-lg font-bold">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p>
              )}
              <p className="text-sm font-semibold text-orange-600 mt-2">{formatCurrency(basePrice, currency)}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {addonGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const isSelected = selectedAddons.some((a) => a.addonItemId === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAddon(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-border hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      {item.name}
                      <span className="text-xs opacity-80">+{formatCurrency(item.price, currency)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{formatCurrency(total, currency)}</p>
            </div>
          </div>

          <Button className="w-full h-12" onClick={handleAdd}>
            <Plus className="h-5 w-5 mr-2" />
            {t('productCard.add')} {quantity}x — {formatCurrency(total, currency)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
