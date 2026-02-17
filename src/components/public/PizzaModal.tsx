import { useState, useEffect } from 'react';
import { Product, PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Check, Pizza as PizzaIcon, Minus, Plus } from 'lucide-react';

interface PizzaModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  sizes: PizzaSize[];
  flavors?: PizzaFlavor[];
  doughs: PizzaDough[];
  edges: PizzaEdge[];
}

export default function PizzaModal({
  open,
  onClose,
  product,
  sizes,
  doughs,
  edges,
}: PizzaModalProps) {
  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);
  const [selectedDough, setSelectedDough] = useState<PizzaDough | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PizzaEdge | null>(null);
  const [observations, setObservations] = useState('');
  const [quantity, setQuantity] = useState(1);

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (open) {
      setSelectedSize(sizes[0] || null);
      setSelectedDough(doughs[0] || null);
      setSelectedEdge(null);
      setObservations('');
      setQuantity(1);
    }
  }, [open, sizes, doughs]);

  // Preço fixo do produto + adicionais (massa e borda)
  const calculatePrice = () => {
    const basePrice = product.price;
    const doughExtra = selectedDough?.extra_price ?? 0;
    const edgePrice = selectedEdge?.price ?? 0;
    return basePrice + doughExtra + edgePrice;
  };

  const handleAddToCart = () => {
    if (!selectedSize) return;

    const unitPrice = calculatePrice();

    addItem({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      isPizza: true,
      pizzaSize: selectedSize.name,
      pizzaFlavors: [],
      pizzaDough: selectedDough?.name,
      pizzaEdge: selectedEdge?.name,
      pizzaDoughPrice: selectedDough?.extra_price ?? 0,
      pizzaEdgePrice: selectedEdge?.price ?? 0,
      observations,
    });

    toast({
      title: "🍕 Pizza adicionada!",
      description: `${product.name} - ${selectedSize.name}`,
      className: "bg-green-50 border-green-200",
    });

    onClose();
  };

  const canAddToCart = selectedSize !== null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl h-[100dvh] md:h-auto md:max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50">
        
        {/* Header Fixo - Mobile First */}
        <div className="pt-10 pb-4 px-5 sm:pt-6 sm:pb-4 sm:px-6 border-b border-slate-200 bg-white z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <PizzaIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate">{product.name}</DialogTitle>
              <p className="text-[10px] sm:text-xs text-slate-500">Monte sua pizza em 3 passos</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content - Mobile First */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth py-6 px-5 sm:p-6 space-y-8">
          
          {/* Aviso quando não há tamanhos configurados */}
          {sizes.length === 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800">
              <p className="font-semibold mb-1">Cardápio em configuração</p>
              <p className="text-sm">
                Os tamanhos desta pizza ainda não foram configurados pelo restaurante.
                Em breve você poderá personalizar aqui. Por enquanto, entre em contato pelo WhatsApp para fazer o pedido.
              </p>
            </div>
          )}

          {/* PASSO 1: Tamanho - Mobile First */}
          <section className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <div className="bg-slate-900 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <Label className="text-base sm:text-lg font-bold text-slate-900">Escolha o Tamanho</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`group relative p-3 sm:p-4 rounded-xl text-left transition-all border-2 touch-manipulation active:scale-[0.98] ${
                    selectedSize?.id === size.id
                      ? 'border-orange-500 bg-orange-50 shadow-sm'
                      : 'border-slate-200 bg-white active:border-orange-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-base sm:text-lg ${selectedSize?.id === size.id ? 'text-orange-700' : 'text-slate-700'}`}>
                        {size.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                        {formatCurrency(product.price)}
                      </div>
                    </div>
                    {selectedSize?.id === size.id && (
                      <div className="bg-orange-500 rounded-full p-1 flex-shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* PASSO 2: Massa e Borda - Mobile First */}
          {selectedSize && (
            <section className="space-y-3 sm:space-y-4 animate-slide-in-bottom">
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <Label className="text-base sm:text-lg font-bold text-slate-900">Massa e Borda</Label>
              </div>
              
              {doughs.length > 0 && (
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-2.5 sm:space-y-3">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">Tipo de Massa</span>
                  <div className="flex flex-wrap gap-2">
                    {doughs.map((dough) => (
                      <button
                        key={dough.id}
                        onClick={() => setSelectedDough(dough)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium border transition-all touch-manipulation active:scale-95 ${
                          selectedDough?.id === dough.id
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 active:border-slate-400'
                        }`}
                      >
                        {dough.name} {dough.extra_price > 0 && `(+${formatCurrency(dough.extra_price)})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {edges.length > 0 && (
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-2 sm:space-y-2.5">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">Borda Recheada</span>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedEdge(null)}
                      className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg border text-left touch-manipulation active:scale-[0.98] ${
                        !selectedEdge ? 'border-orange-500 bg-orange-50' : 'border-slate-200 active:border-slate-300'
                      }`}
                    >
                      <span className="font-medium text-sm sm:text-base">Sem borda</span>
                      {!selectedEdge && <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />}
                    </button>
                    {edges.map((edge) => (
                      <button
                        key={edge.id}
                        onClick={() => setSelectedEdge(edge)}
                        className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg border text-left touch-manipulation active:scale-[0.98] ${
                          selectedEdge?.id === edge.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 active:border-slate-300'
                        }`}
                      >
                        <span className="font-medium text-sm sm:text-base">{edge.name}</span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 flex-shrink-0 ml-2">+{formatCurrency(edge.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* PASSO 3: Observações - Mobile First */}
          {selectedSize && (
            <section className="space-y-2 sm:space-y-3 pb-2 sm:pb-4 animate-slide-in-bottom">
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                <Label className="text-base sm:text-lg font-bold text-slate-900">Observações</Label>
              </div>
              <Textarea
                placeholder="Ex: Tirar a cebola, cortar em 8 pedaços, etc."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                className="bg-white border-slate-200 focus:border-orange-500 text-sm sm:text-base touch-manipulation resize-none"
              />
            </section>
          )}
        </div>

        {/* Footer Actions - Mobile First */}
        <div className="pt-4 pb-8 px-5 sm:pt-5 sm:pb-6 sm:px-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-2.5 sm:px-3 py-2 bg-slate-50 active:bg-slate-100 text-slate-600 touch-manipulation active:scale-95"
                >
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <div className="px-2.5 sm:px-3 py-2 font-bold text-sm sm:text-base text-slate-900 bg-white min-w-[2rem] text-center">{quantity}</div>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-2.5 sm:px-3 py-2 bg-slate-50 active:bg-slate-100 text-slate-600 touch-manipulation active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
            <div className="text-right min-w-0 flex-shrink-0">
              <span className="text-[10px] sm:text-xs text-slate-500 block">Total</span>
              <span className="text-lg sm:text-2xl font-bold text-slate-900 whitespace-nowrap">{formatCurrency(calculatePrice() * quantity)}</span>
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold h-11 sm:h-12 rounded-xl shadow-lg shadow-orange-200 touch-manipulation active:scale-[0.98] text-sm sm:text-base"
          >
            Adicionar ao Carrinho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}