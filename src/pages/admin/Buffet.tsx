import { useEffect, useState, useRef } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useComandas } from '@/hooks/useComandas';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/lib/supabase';
import { Product, ComandaWithItems } from '@/types';
import { offlineDB } from '@/lib/offline-db';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useHotkeys } from 'react-hotkeys-hook';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { 
  Plus, 
  X, 
  Cloud, 
  CloudOff, 
  Loader2, 
  Calculator,
  Clock,
  Trash2,
  CheckCircle2,
  Smartphone,
  Link2,
  Link2Off,
  Wifi,
  WifiOff,
} from 'lucide-react';

// Padrão de short_code das Comandas Digitais (ex: CMD-A7F2)
const VIRTUAL_COMANDA_PATTERN = /^CMD-[A-Z0-9]{4}$/i;

interface ActiveVirtualComanda {
  id: string;
  short_code: string;
  total_amount: number;
  customer_name: string | null;
}

export default function Buffet() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const { comandas, loading, isLive, createComanda, addItemToComanda, closeComanda, refresh } = useComandas(restaurantId || '');
  const { pendingCount, isOnline, isSyncing } = useOfflineSync(restaurantId || '');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const selectedComanda = selectedComandaId ? comandas.find(c => c.id === selectedComandaId) ?? null : null;
  const [scannerInput, setScannerInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingComandaId, setClosingComandaId] = useState<string | null>(null);

  // Comanda Digital vinculada via scanner (CMD-XXXX)
  const [activeVirtualComanda, setActiveVirtualComanda] = useState<ActiveVirtualComanda | null>(null);
  const [loadingVirtual, setLoadingVirtual] = useState(false);

  const scannerRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  // Hotkeys
  useHotkeys('f2', () => handleNewComanda(), { preventDefault: true });
  useHotkeys('f8', () => {
    if (selectedComanda) {
      setClosingComandaId(selectedComanda.id);
      setShowCloseDialog(true);
    }
  }, { preventDefault: true, enableOnFormTags: true });
  useHotkeys('escape', () => {
    setSelectedComandaId(null);
    setSelectedProduct(null);
    setWeightInput('');
    setScannerInput('');
  }, { preventDefault: true });

  useEffect(() => {
    if (restaurantId) {
      loadProducts();
    }
  }, [restaurantId]);

  useEffect(() => {
    // Focar no scanner quando não há comanda selecionada
    if (!selectedComanda && scannerRef.current) {
      scannerRef.current.focus();
    }
  }, [selectedComanda]);

  const loadProducts = async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const handleNewComanda = async () => {
    try {
      const comandaId = await createComanda();
      setSelectedComandaId(comandaId);
      setScannerInput('');
      scannerRef.current?.focus();
    } catch (error) {
      console.error('Erro ao criar comanda:', error);
      toast({ title: 'Erro ao criar comanda', variant: 'destructive' });
    }
  };

  // Vincula uma Comanda Digital (CMD-XXXX) como destino de itens de peso/balança
  const handleVirtualComandaScan = async (shortCode: string) => {
    if (!restaurantId) return;
    setLoadingVirtual(true);
    try {
      const { data, error } = await supabase
        .from('virtual_comandas')
        .select('id, short_code, status, total_amount, customer_name')
        .eq('restaurant_id', restaurantId)
        .eq('short_code', shortCode.toUpperCase())
        .eq('status', 'open')
        .single();

      if (error || !data) {
        toast({ title: `Comanda ${shortCode} não encontrada ou já fechada`, variant: 'destructive' });
        return;
      }

      setActiveVirtualComanda(data);
      // Desseleciona comanda de buffet ao vincular uma virtual
      setSelectedComandaId(null);
      toast({
        title: `✅ Comanda ${shortCode} vinculada!`,
        description: data.customer_name ? `Cliente: ${data.customer_name}` : 'Adicione produtos ou pesos agora.',
      });
      weightRef.current?.focus();
    } finally {
      setLoadingVirtual(false);
    }
  };

  const handleScannerInput = async (value: string) => {
    if (!value.trim()) return;

    // ── Comanda Digital: formato CMD-XXXX ─────────────────────────────────────
    if (VIRTUAL_COMANDA_PATTERN.test(value.trim())) {
      setScannerInput('');
      await handleVirtualComandaScan(value.trim());
      return;
    }

    // ── Comanda de Buffet: número inteiro ─────────────────────────────────────
    if (/^\d+$/.test(value)) {
      const comandaNumber = parseInt(value, 10);
      const comanda = comandas.find(c => c.number === comandaNumber);
      if (comanda) {
        setSelectedComandaId(comanda.id);
        setActiveVirtualComanda(null); // desvincula virtual ao selecionar buffet
        setScannerInput('');
        weightRef.current?.focus();
        toast({ title: `Comanda #${comandaNumber} selecionada` });
      } else {
        toast({ title: `Comanda #${comandaNumber} não encontrada`, variant: 'destructive' });
      }
      return;
    }

    // ── Produto por SKU ou nome ───────────────────────────────────────────────
    const product = products.find(
      p => p.sku?.toLowerCase() === value.toLowerCase() || 
           p.name.toLowerCase().includes(value.toLowerCase())
    );

    if (product) {
      setSelectedProduct(product);
      setScannerInput('');
      if (product.is_by_weight) {
        weightRef.current?.focus();
      } else {
        handleAddProduct(product, 1);
      }
    } else {
      toast({ title: 'Produto não encontrado', variant: 'destructive' });
    }
  };

  const handleAddProduct = async (product: Product, quantity: number) => {
    const unitPrice = product.price_sale || product.price;

    // ── Rota 1: Comanda Digital (CMD-XXXX) ────────────────────────────────────
    if (activeVirtualComanda) {
      try {
        const { error } = await supabase.from('virtual_comanda_items').insert({
          comanda_id: activeVirtualComanda.id,
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: unitPrice,
          notes: null,
        });
        if (error) throw error;

        // Atualiza o total exibido localmente (o trigger no banco fará o cálculo real)
        setActiveVirtualComanda(prev =>
          prev ? { ...prev, total_amount: prev.total_amount + unitPrice * quantity } : prev
        );
        setWeightInput('');
        setSelectedProduct(null);
        weightRef.current?.focus();
        toast({ title: `${product.name} adicionado à comanda ${activeVirtualComanda.short_code}!` });
      } catch (error) {
        console.error('Erro ao adicionar produto à comanda virtual:', error);
        toast({ title: 'Erro ao adicionar produto', variant: 'destructive' });
      }
      return;
    }

    // ── Rota 2: Comanda de Buffet (offline-first) ─────────────────────────────
    if (!selectedComanda) {
      toast({ title: 'Selecione uma comanda ou escaneie um código CMD-XXXX primeiro', variant: 'destructive' });
      return;
    }

    const totalPrice = unitPrice * quantity;
    try {
      await addItemToComanda(selectedComanda.id, {
        product_id: product.id,
        description: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      });
      
      setWeightInput('');
      setSelectedProduct(null);
      weightRef.current?.focus();
      toast({ title: `${product.name} adicionado!` });
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast({ title: 'Erro ao adicionar produto', variant: 'destructive' });
    }
  };

  const handleWeightSubmit = async () => {
    if (!selectedProduct || !selectedComanda) return;
    
    const weight = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
      toast({ title: 'Peso inválido', variant: 'destructive' });
      return;
    }

    await handleAddProduct(selectedProduct, weight);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedComanda) return;
    
    try {
      // Remover do Supabase se online
      if (isOnline) {
        const { error } = await supabase
          .from('comanda_items')
          .delete()
          .eq('id', itemId);
        
        if (error) throw error;
      }

      // Remover localmente
      await offlineDB.comandaItems.delete(itemId);
      refresh();
      toast({ title: 'Item removido' });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      toast({ title: 'Erro ao remover item', variant: 'destructive' });
    }
  };

  const getComandaColor = (comanda: ComandaWithItems): string => {
    const openedAt = new Date(comanda.opened_at);
    const now = new Date();
    const minutesOpen = (now.getTime() - openedAt.getTime()) / (1000 * 60);

    if (minutesOpen < 15) return 'bg-emerald-500';
    if (minutesOpen < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getComandaStatusText = (comanda: ComandaWithItems): string => {
    const openedAt = new Date(comanda.opened_at);
    const now = new Date();
    const minutesOpen = Math.floor((now.getTime() - openedAt.getTime()) / (1000 * 60));
    
    if (minutesOpen < 1) return 'Agora';
    if (minutesOpen < 60) return `${minutesOpen}min`;
    const hours = Math.floor(minutesOpen / 60);
    const mins = minutesOpen % 60;
    return `${hours}h${mins > 0 ? mins + 'min' : ''}`;
  };

  if (loading && comandas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 dark:bg-slate-950 min-h-screen p-6">
      {/* Header com Status de Sincronização */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Comandas - Buffet</h1>
          <p className="text-muted-foreground mt-1">
            Sistema offline-first para operação rápida
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Indicador Ao Vivo (Realtime) */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
            isLive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-muted border-border text-muted-foreground'
          }`}>
            {isLive ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="h-3 w-3" />
                Ao Vivo
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Conectando…
              </>
            )}
          </div>

          {/* Indicador Sync Offline */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white ${
            isSyncing ? 'bg-blue-600' : isOnline ? 'bg-slate-500' : 'bg-red-600'
          }`}>
            {isSyncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sincronizando…
              </>
            ) : isOnline ? (
              <>
                <Cloud className="h-3.5 w-3.5" />
                Online
              </>
            ) : (
              <>
                <CloudOff className="h-3.5 w-3.5" />
                Offline
              </>
            )}
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-white text-slate-900 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </div>
          
          <Button onClick={handleNewComanda} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Nova Comanda (F2)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Scanner e Entrada */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle>Scanner / Número da Comanda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Leia o código ou digite o número</Label>
                <Input
                  ref={scannerRef}
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScannerInput(scannerInput);
                      setScannerInput('');
                    }
                  }}
                  placeholder="Código ou número da comanda"
                  className="text-2xl h-14 font-mono dark:bg-slate-900 dark:border-slate-700"
                  autoFocus
                />
              </div>

              {selectedProduct && selectedProduct.is_by_weight && (
                <div>
                  <Label>Peso (kg)</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={weightRef}
                      type="text"
                      inputMode="decimal"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleWeightSubmit();
                        }
                      }}
                      placeholder="0.350"
                      className="text-2xl h-14 font-mono dark:bg-slate-900 dark:border-slate-700"
                      autoFocus
                    />
                    <Button
                      onClick={handleWeightSubmit}
                      size="lg"
                      className="h-14 px-6"
                    >
                      <Calculator className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedProduct.name} - {formatCurrency(selectedProduct.price_sale || selectedProduct.price, currency)}/kg
                  </p>
                </div>
              )}

              {/* Comanda de Buffet selecionada */}
              {selectedComanda && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Comanda #{selectedComanda.number}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedComandaId(null);
                        setSelectedProduct(null);
                        scannerRef.current?.focus();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(selectedComanda.total_amount, currency)}
                  </div>
                </div>
              )}

              {/* Comanda Digital vinculada via CMD-XXXX */}
              <FeatureGuard feature="feature_virtual_comanda" bannerVariant="inline">
                {activeVirtualComanda ? (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                        <Link2 className="h-3.5 w-3.5" />
                        {activeVirtualComanda.short_code}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Desvincular comanda digital"
                        onClick={() => {
                          setActiveVirtualComanda(null);
                          scannerRef.current?.focus();
                        }}
                      >
                        <Link2Off className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {activeVirtualComanda.customer_name && (
                      <p className="text-xs text-muted-foreground mb-1">{activeVirtualComanda.customer_name}</p>
                    )}
                    <div className="text-2xl font-bold text-emerald-700">
                      {loadingVirtual
                        ? <Loader2 className="h-5 w-5 animate-spin" />
                        : formatCurrency(activeVirtualComanda.total_amount, currency)
                      }
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Próximos itens adicionados irão para esta comanda
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Smartphone className="h-3.5 w-3.5 flex-shrink-0" />
                    Escaneie um código <span className="font-mono font-bold">CMD-XXXX</span> para vincular uma comanda do cliente
                  </p>
                )}
              </FeatureGuard>
            </CardContent>
          </Card>

          {/* Lista de Produtos Rápida */}
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle>Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map((product) => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-2"
                    onClick={() => {
                      if (product.is_by_weight) {
                        setSelectedProduct(product);
                        weightRef.current?.focus();
                      } else {
                        handleAddProduct(product, 1);
                      }
                    }}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(product.price_sale || product.price, currency)}
                        {product.is_by_weight && '/kg'}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Comandas Abertas */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {comandas.map((comanda) => {
              const isSelected = selectedComandaId === comanda.id;
              return (
                <Card
                  key={comanda.id}
                  className={`cursor-pointer transition-all ${
                    isSelected 
                      ? 'ring-2 ring-primary dark:bg-slate-800' 
                      : 'dark:bg-slate-900 dark:border-slate-800'
                  }`}
                  onClick={() => setSelectedComandaId(comanda.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Comanda #{comanda.number}
                      </CardTitle>
                      <div className={`w-3 h-3 rounded-full ${getComandaColor(comanda)}`} />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {getComandaStatusText(comanda)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">
                        {formatCurrency(comanda.total_amount, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {comanda.items?.length || 0} item(s)
                      </div>
                      {isSelected && (
                        <div className="pt-2 border-t space-y-2">
                          {comanda.items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.description}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.quantity} x {formatCurrency(item.unit_price, currency)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">
                                  {formatCurrency(item.total_price, currency)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            className="w-full mt-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosingComandaId(comanda.id);
                              setShowCloseDialog(true);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Fechar Comanda (F8)
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {comandas.length === 0 && (
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Nenhuma comanda aberta
                </p>
                <Button onClick={handleNewComanda}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Comanda
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Fechar Comanda */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Fechar Comanda</DialogTitle>
          </DialogHeader>
          {closingComandaId && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">
                  {formatCurrency(
                    comandas.find(c => c.id === closingComandaId)?.total_amount || 0,
                    currency
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Comanda #{comandas.find(c => c.id === closingComandaId)?.number}
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCloseDialog(false);
                    setClosingComandaId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (closingComandaId) {
                      await closeComanda(closingComandaId);
                      setShowCloseDialog(false);
                      setClosingComandaId(null);
                      setSelectedComandaId(null);
                      scannerRef.current?.focus();
                    }
                  }}
                >
                  Confirmar Fechamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
