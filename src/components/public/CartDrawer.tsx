import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Plus, Minus, Trash2, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore();

  const handleCheckout = () => {
    onClose();
    onCheckout();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seu Carrinho</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => {
                const itemTotal = item.unitPrice * item.quantity;

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.productName}</h4>
                        
                        {item.isPizza && (
                          <div className="text-sm text-muted-foreground mt-1 space-y-1">
                            <p>Tamanho: {item.pizzaSize}</p>
                            {item.pizzaFlavors && item.pizzaFlavors.length > 0 && (
                              <p>
                                Sabores: {item.pizzaFlavors.join(', ')}
                              </p>
                            )}
                            {item.pizzaDough && <p>Massa: {item.pizzaDough}</p>}
                            {item.pizzaEdge && <p>Borda: {item.pizzaEdge}</p>}
                          </div>
                        )}
                        
                        {item.observations && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Obs: {item.observations}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(itemTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <DialogFooter className="flex flex-col gap-3 sm:flex-col">
            <div className="w-full rounded-xl bg-sky-50 border border-sky-200 p-3 flex gap-2">
              <MessageCircle className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-sky-800">
                <p className="font-semibold">Envie sua localização no WhatsApp</p>
                <p className="text-sky-700 mt-0.5">Ao finalizar o pedido, envie sua localização pelo WhatsApp para facilitar a entrega.</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Subtotal:</span>
              <span>{formatCurrency(getSubtotal())}</span>
            </div>
            <Button size="lg" onClick={handleCheckout} className="w-full">
              Finalizar Pedido
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
