import { useState, useEffect } from 'react';
import {
  Product,
  PizzaSize,
  PizzaFlavor,
  PizzaDough,
  PizzaEdge,
} from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Check, Pizza as PizzaIcon, Minus, Plus, Search } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (open) {
      setSelectedSize(sizes[0] || null);
      setSelectedFlavors([]);
      setSelectedDough(doughs[0] || null);
      setSelectedEdge(null);
      setObservations('');
      setQuantity(1);
      setSearchTerm('');
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
      } else {
        toast({
          title: `Máximo de ${selectedSize.max_flavors} sabores`,
          description: "Remova um sabor para adicionar outro.",
          variant: "destructive", 
        });
      }
    }
  };

  const calculatePrice = () => {
    if (!selectedSize) return 0;
    const flavorPrices = selectedFlavors.map((f) => f.price);
    const basePrice = flavorPrices.length > 0 ? Math.max(...flavorPrices) : 0;
    const sizePrice = basePrice * selectedSize.price_multiplier;
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
      className: "bg-green-50 border-green-200",
    });

    onClose();
  };

  const canAddToCart = selectedSize && selectedFlavors.length > 0 && selectedFlavors.length <= selectedSize.max_flavors;

  const filteredFlavors = flavors.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50">
        
        {/* Header Fixo */}
        <div className="p-4 border-b border-slate-200 bg-white z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
              <PizzaIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">{product.name}</DialogTitle>
              <p className="text-xs text-slate-500">Monte sua pizza em 4 passos</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          
          {/* PASSO 1: Tamanho */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <Label className="text-lg font-bold text-slate-900">Escolha o Tamanho</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size);
                    setSelectedFlavors([]);
                  }}
                  className={`group relative p-4 rounded-xl text-left transition-all border-2 ${
                    selectedSize?.id === size.id
                      ? 'border-orange-500 bg-orange-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className={`font-bold text-lg ${selectedSize?.id === size.id ? 'text-orange-700' : 'text-slate-700'}`}>
                        {size.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Até {size.max_flavors} {size.max_flavors === 1 ? 'sabor' : 'sabores'}
                      </div>
                    </div>
                    {selectedSize?.id === size.id && <div className="bg-orange-500 rounded-full p-1"><Check className="h-3 w-3 text-white" /></div>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* PASSO 2: Sabores */}
          {selectedSize && (
            <section className="space-y-3 animate-slide-in-bottom">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <Label className="text-lg font-bold text-slate-900">Escolha os Sabores</Label>
                </div>
                <Badge variant={selectedFlavors.length === selectedSize.max_flavors ? "default" : "secondary"} className="text-xs">
                  {selectedFlavors.length}/{selectedSize.max_flavors} selecionados
                </Badge>
              </div>

              {/* Busca de Sabores */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar sabor..." 
                  className="pl-10 bg-white border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                {filteredFlavors.map((flavor) => {
                  const isSelected = selectedFlavors.some((f) => f.id === flavor.id);
                  const isDisabled = !isSelected && selectedFlavors.length >= selectedSize.max_flavors;

                  return (
                    <button
                      key={flavor.id}
                      onClick={() => handleFlavorToggle(flavor)}
                      disabled={isDisabled}
                      className={`flex items-center p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                          : isDisabled 
                            ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      {/* Checkbox Visual */}
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-colors ${
                        isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="font-semibold text-slate-900">{flavor.name}</div>
                        {flavor.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">{flavor.description}</div>
                        )}
                      </div>
                      <div className="font-bold text-slate-700">{formatCurrency(flavor.price)}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* PASSO 3: Massa e Borda */}
          {selectedSize && (
            <section className="space-y-4 animate-slide-in-bottom delay-100">
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <Label className="text-lg font-bold text-slate-900">Massa e Borda</Label>
              </div>
              
              {doughs.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tipo de Massa</span>
                  <div className="flex flex-wrap gap-2">
                    {doughs.map((dough) => (
                      <button
                        key={dough.id}
                        onClick={() => setSelectedDough(dough)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                          selectedDough?.id === dough.id
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {dough.name} {dough.extra_price > 0 && `(+${formatCurrency(dough.extra_price)})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {edges.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Borda Recheada</span>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedEdge(null)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left ${
                        !selectedEdge ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-medium">Sem borda</span>
                      {!selectedEdge && <Check className="h-4 w-4 text-orange-500" />}
                    </button>
                    {edges.map((edge) => (
                      <button
                        key={edge.id}
                        onClick={() => setSelectedEdge(edge)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left ${
                          selectedEdge?.id === edge.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-medium">{edge.name}</span>
                        <span className="text-sm font-semibold text-slate-600">+{formatCurrency(edge.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* PASSO 4: Observações */}
          {selectedSize && (
            <section className="space-y-3 pb-4 animate-slide-in-bottom delay-200">
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                <Label className="text-lg font-bold text-slate-900">Observações</Label>
              </div>
              <Textarea
                placeholder="Ex: Tirar a cebola, cortar em 8 pedaços, etc."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                className="bg-white border-slate-200 focus:border-orange-500"
              />
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="px-3 py-2 font-bold text-slate-900 bg-white min-w-[2rem] text-center">{quantity}</div>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total</span>
              <span className="text-2xl font-bold text-slate-900">{formatCurrency(calculatePrice() * quantity)}</span>
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-orange-200"
          >
            Adicionar ao Carrinho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}