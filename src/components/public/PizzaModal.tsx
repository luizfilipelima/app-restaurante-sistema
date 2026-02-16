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
import { toast } from '@/hooks/use-toast';
import { Check, Pizza as PizzaIcon, Minus, Plus } from 'lucide-react';

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

    toast({
      title: "🍕 Pizza adicionada!",
      description: `${product.name} - ${selectedSize.name}`,
      variant: "success",
    });

    onClose();
  };

  const canAddToCart =
    selectedSize &&
    selectedFlavors.length > 0 &&
    selectedFlavors.length <= selectedSize.max_flavors;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <PizzaIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">{product.name}</DialogTitle>
              {product.description && (
                <p className="text-sm text-muted-foreground">{product.description}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tamanho */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
              Escolha o Tamanho *
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size);
                    setSelectedFlavors([]);
                  }}
                  className={`group relative p-5 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                    selectedSize?.id === size.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {selectedSize?.id === size.id && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="font-bold text-lg mb-1">{size.name}</div>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  Escolha {selectedSize.max_flavors === 1 ? 'o Sabor' : 'os Sabores'} *
                </Label>
                <Badge variant="secondary" className="text-sm">
                  {selectedFlavors.length}/{selectedSize.max_flavors}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      className={`group relative p-4 border-2 rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <div className="font-bold mb-1">{flavor.name}</div>
                          {flavor.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {flavor.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="font-semibold">
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
            <div className="space-y-3">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                Tipo de Massa
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doughs.map((dough) => (
                  <button
                    key={dough.id}
                    onClick={() => setSelectedDough(dough)}
                    className={`group relative p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                      selectedDough?.id === dough.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {selectedDough?.id === dough.id && (
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{dough.name}</span>
                      {dough.extra_price > 0 && (
                        <Badge className="gradient-secondary text-white">
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
            <div className="space-y-3">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">4</span>
                Borda Recheada <span className="text-sm text-muted-foreground font-normal">(Opcional)</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedEdge(null)}
                  className={`group relative p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                    !selectedEdge
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {!selectedEdge && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <span className="font-bold">Sem borda</span>
                </button>
                {edges.map((edge) => (
                  <button
                    key={edge.id}
                    onClick={() => setSelectedEdge(edge)}
                    className={`group relative p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                      selectedEdge?.id === edge.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {selectedEdge?.id === edge.id && (
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{edge.name}</span>
                      <Badge className="gradient-secondary text-white">
                        +{formatCurrency(edge.price)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-3">
            <Label htmlFor="observations" className="text-base font-semibold">
              Observações <span className="text-sm text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Textarea
              id="observations"
              placeholder="Ex: sem cebola, bem passada, cortar em 8 pedaços..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Quantidade */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Quantidade</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-12 w-12 rounded-xl"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold w-16 text-center">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                className="h-12 w-12 rounded-xl"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-col border-t pt-6">
          <div className="flex justify-between items-center p-4 bg-muted rounded-xl">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold text-gradient">
              {formatCurrency(calculatePrice() * quantity)}
            </span>
          </div>
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full h-14 text-lg font-semibold gradient-primary hover:shadow-premium transition-all"
          >
            <PizzaIcon className="mr-2 h-5 w-5" />
            Adicionar ao Carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
