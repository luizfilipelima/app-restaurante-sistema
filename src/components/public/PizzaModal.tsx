import { useState, useEffect } from 'react';
import {
  Product,
  PizzaSize,
  PizzaFlavor,
  PizzaDough,
  PizzaEdge,
} from '@/types';
import { useCartStore } from '@/store/cartStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PizzaModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  sizes: PizzaSize[];
  flavors: PizzaFlavor[];
  doughs: PizzaDough[];
  edges: PizzaEdge[];
}

export default function PizzaModal({
  open,
  onClose,
  product,
  sizes,
  flavors,
  doughs,
  edges,
}: PizzaModalProps) {
  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<PizzaFlavor[]>([]);
  const [selectedDough, setSelectedDough] = useState<PizzaDough | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PizzaEdge | null>(null);
  const [observations, setObservations] = useState('');
  const [quantity, setQuantity] = useState(1);

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    // Reset ao abrir
    if (open) {
      setSelectedSize(sizes[0] || null);
      setSelectedFlavors([]);
      setSelectedDough(doughs[0] || null);
      setSelectedEdge(null);
      setObservations('');
      setQuantity(1);
    }
  }, [open, sizes, doughs]);

  const handleFlavorToggle = (flavor: PizzaFlavor) => {
    if (!selectedSize) return;

    const isSelected = selectedFlavors.some((f) => f.id === flavor.id);

    if (isSelected) {
      setSelectedFlavors(selectedFlavors.filter((f) => f.id !== flavor.id));
    } else {
      if (selectedFlavors.length < selectedSize.max_flavors) {
        setSelectedFlavors([...selectedFlavors, flavor]);
      }
    }
  };

  const calculatePrice = () => {
    if (!selectedSize) return 0;

    // Preço base: maior valor entre os sabores selecionados
    const flavorPrices = selectedFlavors.map((f) => f.price);
    const basePrice = flavorPrices.length > 0 ? Math.max(...flavorPrices) : 0;

    // Aplica multiplicador do tamanho
    const sizePrice = basePrice * selectedSize.price_multiplier;

    // Adiciona preços extras
    const doughPrice = selectedDough?.extra_price || 0;
    const edgePrice = selectedEdge?.price || 0;

    return sizePrice + doughPrice + edgePrice;
  };

  const handleAddToCart = () => {
    if (!selectedSize || selectedFlavors.length === 0) return;

    const unitPrice = calculatePrice();

    addItem({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      isPizza: true,
      pizzaSize: selectedSize.name,
      pizzaFlavors: selectedFlavors.map((f) => f.name),
      pizzaDough: selectedDough?.name,
      pizzaEdge: selectedEdge?.name,
      pizzaDoughPrice: selectedDough?.extra_price || 0,
      pizzaEdgePrice: selectedEdge?.price || 0,
      observations,
    });

    onClose();
  };

  const canAddToCart =
    selectedSize &&
    selectedFlavors.length > 0 &&
    selectedFlavors.length <= selectedSize.max_flavors;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tamanho */}
          <div>
            <Label className="text-base mb-3 block">
              Escolha o Tamanho *
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size);
                    setSelectedFlavors([]);
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    selectedSize?.id === size.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold">{size.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Até {size.max_flavors}{' '}
                    {size.max_flavors === 1 ? 'sabor' : 'sabores'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sabores */}
          {selectedSize && (
            <div>
              <Label className="text-base mb-3 block">
                Escolha {selectedSize.max_flavors === 1 ? 'o Sabor' : 'os Sabores'} *
                <span className="text-sm text-muted-foreground ml-2">
                  ({selectedFlavors.length}/{selectedSize.max_flavors} selecionados)
                </span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {flavors.map((flavor) => {
                  const isSelected = selectedFlavors.some((f) => f.id === flavor.id);
                  const isDisabled =
                    !isSelected &&
                    selectedFlavors.length >= selectedSize.max_flavors;

                  return (
                    <button
                      key={flavor.id}
                      onClick={() => handleFlavorToggle(flavor)}
                      disabled={isDisabled}
                      className={`p-3 border-2 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold">{flavor.name}</div>
                          {flavor.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {flavor.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {formatCurrency(flavor.price)}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Massa */}
          {doughs.length > 0 && (
            <div>
              <Label className="text-base mb-3 block">Tipo de Massa</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {doughs.map((dough) => (
                  <button
                    key={dough.id}
                    onClick={() => setSelectedDough(dough)}
                    className={`p-3 border-2 rounded-lg text-left transition-colors ${
                      selectedDough?.id === dough.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{dough.name}</span>
                      {dough.extra_price > 0 && (
                        <Badge variant="secondary">
                          +{formatCurrency(dough.extra_price)}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Borda */}
          {edges.length > 0 && (
            <div>
              <Label className="text-base mb-3 block">Borda Recheada (Opcional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedEdge(null)}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    !selectedEdge
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-semibold">Sem borda</span>
                </button>
                {edges.map((edge) => (
                  <button
                    key={edge.id}
                    onClick={() => setSelectedEdge(edge)}
                    className={`p-3 border-2 rounded-lg text-left transition-colors ${
                      selectedEdge?.id === edge.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{edge.name}</span>
                      <Badge variant="secondary">
                        +{formatCurrency(edge.price)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label htmlFor="observations">Observações (Opcional)</Label>
            <Textarea
              id="observations"
              placeholder="Ex: sem cebola, bem passada..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>

          {/* Quantidade */}
          <div>
            <Label className="text-base mb-3 block">Quantidade</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="text-xl font-semibold w-12 text-center">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span>{formatCurrency(calculatePrice() * quantity)}</span>
          </div>
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full"
          >
            Adicionar ao Carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
