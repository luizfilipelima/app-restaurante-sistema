import { useEffect, useState, useRef, useMemo } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { useComandas } from '@/hooks/useComandas';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/lib/supabase';
import { Product, ComandaWithItems } from '@/types';
import { offlineDB } from '@/lib/offline-db';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useHotkeys } from 'react-hotkeys-hook';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search,
  Scale,
  ScanLine,
  Hash,
  ShoppingBag,
  Receipt,
  RefreshCw,
  Zap,
} from 'lucide-react';

// ─── Padrão CMD-XXXX ──────────────────────────────────────────────────────────
const VIRTUAL_COMANDA_PATTERN = /^CMD-[A-Z0-9]{4}$/i;

interface ActiveVirtualComanda {
  id: string;
  short_code: string;
  total_amount: number;
  customer_name: string | null;
}

// ─── Helpers de tempo ─────────────────────────────────────────────────────────

function getMinutesOpen(openedAt: string): number {
  return (Date.now() - new Date(openedAt).getTime()) / 60_000;
}

function formatTimeOpen(openedAt: string): string {
  const m = Math.floor(getMinutesOpen(openedAt));
  if (m < 1)  return 'Agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h${r > 0 ? r + 'min' : ''}`;
}

type TimeUrgency = 'fresh' | 'normal' | 'urgent';

function getTimeUrgency(openedAt: string): TimeUrgency {
  const m = getMinutesOpen(openedAt);
  if (m < 15) return 'fresh';
  if (m < 60) return 'normal';
  return 'urgent';
}

const URGENCY_STYLES: Record<TimeUrgency, { bar: string; badge: string; text: string }> = {
  fresh:  { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-700' },
  normal: { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 border-amber-200',       text: 'text-amber-700'   },
  urgent: { bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700 border-red-200',             text: 'text-red-700'     },
};

// ─── Componente: Status Bar ───────────────────────────────────────────────────

function StatusBar({
  isLive, isOnline, isSyncing, pendingCount, onRefresh, onNewComanda, loading,
}: {
  isLive: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  onRefresh: () => void;
  onNewComanda: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Título + indicadores */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">Buffet & Comandas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Operação offline-first · atualização em tempo real</p>
        </div>

        {/* Ao Vivo */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
          isLive
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-slate-100 border-slate-200 text-slate-500'
        }`}>
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
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

        {/* Online/Offline/Syncing */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
          isSyncing  ? 'bg-sky-100 border border-sky-200 text-sky-700' :
          isOnline   ? 'bg-slate-100 border border-slate-200 text-slate-600' :
                       'bg-red-100 border border-red-200 text-red-700'
        }`}>
          {isSyncing ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Sincronizando…</>
          ) : isOnline ? (
            <><Cloud className="h-3 w-3" />Online</>
          ) : (
            <><CloudOff className="h-3 w-3" />Offline</>
          )}
          {pendingCount > 0 && (
            <span className="ml-0.5 bg-white text-slate-800 rounded-full px-1.5 text-[10px] font-bold border border-slate-200">
              {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors"
          title="Atualizar comandas"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <Button
          onClick={onNewComanda}
          className="gap-2 bg-[#F87116] hover:bg-[#e56910] text-white shadow-sm shadow-orange-200"
        >
          <Plus className="h-4 w-4" />
          Nova Comanda
          <kbd className="ml-1 text-[10px] opacity-70 bg-orange-600 px-1 rounded">F2</kbd>
        </Button>
      </div>
    </div>
  );
}

// ─── Componente: Painel Scanner (esquerda) ────────────────────────────────────

function ScannerPanel({
  scannerRef, weightRef, scannerInput, setScannerInput,
  onScannerEnter, weightInput, setWeightInput, onWeightSubmit,
  selectedProduct, selectedComanda, activeVirtualComanda,
  onDeselectComanda, onDeselectVirtual, loadingVirtual, currency,
  products, onProductClick,
}: {
  scannerRef: React.RefObject<HTMLInputElement>;
  weightRef: React.RefObject<HTMLInputElement>;
  scannerInput: string;
  setScannerInput: (v: string) => void;
  onScannerEnter: (v: string) => void;
  weightInput: string;
  setWeightInput: (v: string) => void;
  onWeightSubmit: () => void;
  selectedProduct: Product | null;
  selectedComanda: ComandaWithItems | null;
  activeVirtualComanda: ActiveVirtualComanda | null;
  onDeselectComanda: () => void;
  onDeselectVirtual: () => void;
  loadingVirtual: boolean;
  currency: CurrencyCode;
  products: Product[];
  onProductClick: (p: Product) => void;
}) {
  const [productSearch, setProductSearch] = useState('');
  const filteredProducts = useMemo(() =>
    products.filter((p) =>
      !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
    ), [products, productSearch]);

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Bloco Scanner ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header do bloco */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <ScanLine className="h-4 w-4 text-[#F87116]" />
          <span className="text-sm font-semibold text-slate-800">Scanner / Entrada</span>
        </div>

        <div className="p-4 space-y-4">
          {/* Input principal */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Nº da comanda, código CMD-XXXX ou SKU do produto
            </label>
            <Input
              ref={scannerRef}
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onScannerEnter(scannerInput); setScannerInput(''); }
              }}
              placeholder="Escanear ou digitar…"
              className="text-xl h-12 font-mono border-slate-200 focus:border-[#F87116] focus:ring-[#F87116]/20 bg-slate-50"
              autoFocus
            />
          </div>

          {/* Peso — aparece ao selecionar produto pesável */}
          <AnimatePresence>
            {selectedProduct?.is_by_weight && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <Scale className="h-3.5 w-3.5" />
                    {selectedProduct.name}
                    <span className="ml-auto font-normal text-amber-600">
                      {formatCurrency(selectedProduct.price_sale || selectedProduct.price, currency)}/kg
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      ref={weightRef}
                      type="text"
                      inputMode="decimal"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onWeightSubmit(); }}
                      placeholder="0.350 kg"
                      className="text-xl h-12 font-mono flex-1 border-amber-200 focus:border-amber-400 bg-white"
                      autoFocus
                    />
                    <Button onClick={onWeightSubmit} size="lg" className="h-12 px-5 bg-amber-500 hover:bg-amber-600 text-white">
                      <Calculator className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comanda de Buffet selecionada */}
          <AnimatePresence>
            {selectedComanda && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="rounded-xl border border-[#F87116]/30 bg-orange-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-[#F87116] flex items-center justify-center">
                      <Hash className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Comanda #{selectedComanda.number}</p>
                      <p className="text-[11px] text-slate-500">{selectedComanda.items?.length ?? 0} itens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#F87116]">
                      {formatCurrency(selectedComanda.total_amount, currency)}
                    </span>
                    <button onClick={onDeselectComanda} className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-orange-100 hover:text-slate-600 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comanda Digital (CMD-XXXX) */}
          <FeatureGuard feature="feature_virtual_comanda" bannerVariant="inline">
            <AnimatePresence>
              {activeVirtualComanda ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <Smartphone className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-800">
                          <Link2 className="h-3 w-3" />
                          {activeVirtualComanda.short_code}
                        </p>
                        {activeVirtualComanda.customer_name && (
                          <p className="text-[11px] text-emerald-600">{activeVirtualComanda.customer_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-emerald-700">
                        {loadingVirtual
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : formatCurrency(activeVirtualComanda.total_amount, currency)
                        }
                      </span>
                      <button onClick={onDeselectVirtual} className="h-6 w-6 flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 transition-colors">
                        <Link2Off className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1.5 pl-9">Próximos itens irão para esta comanda</p>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-[11px] text-slate-400"
                >
                  <Smartphone className="h-3.5 w-3.5 flex-shrink-0" />
                  Escaneie <span className="font-mono font-bold text-slate-600">CMD-XXXX</span> para vincular comanda digital
                </motion.p>
              )}
            </AnimatePresence>
          </FeatureGuard>
        </div>
      </div>

      {/* ── Produtos ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
          <ShoppingBag className="h-4 w-4 text-[#F87116]" />
          <span className="text-sm font-semibold text-slate-800">Produtos</span>
          <span className="ml-auto text-xs text-slate-400">{filteredProducts.length}</span>
        </div>
        <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Filtrar produto…"
              className="w-full h-7 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#F87116]/30 focus:border-[#F87116]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredProducts.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">Nenhum produto encontrado</p>
          )}
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-[#F87116]/30 hover:bg-orange-50 transition-all text-left group"
            >
              {product.is_by_weight ? (
                <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Scale className="h-3.5 w-3.5 text-amber-600" />
                </div>
              ) : (
                <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-3.5 w-3.5 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate group-hover:text-[#F87116] transition-colors">
                  {product.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatCurrency(product.price_sale || product.price, currency)}
                  {product.is_by_weight && <span className="text-amber-600 font-medium">/kg</span>}
                  {product.sku && <span className="ml-2 text-slate-400 font-mono">{product.sku}</span>}
                </p>
              </div>
              <Plus className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#F87116] flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Atalhos de teclado */}
      <div className="text-[10px] text-slate-400 flex gap-3 flex-wrap px-1">
        <span><kbd className="bg-slate-100 px-1 rounded">F2</kbd> nova comanda</span>
        <span><kbd className="bg-slate-100 px-1 rounded">F8</kbd> fechar</span>
        <span><kbd className="bg-slate-100 px-1 rounded">ESC</kbd> limpar</span>
      </div>
    </div>
  );
}

// ─── Componente: Card de Comanda ──────────────────────────────────────────────

function ComandaCard({
  comanda, isSelected, currency, onSelect, onClose,
}: {
  comanda: ComandaWithItems;
  isSelected: boolean;
  currency: CurrencyCode;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const urgency  = getTimeUrgency(comanda.opened_at);
  const styles   = URGENCY_STYLES[urgency];
  const itemCount = comanda.items?.length ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onSelect}
      className={`relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden
        ${isSelected
          ? 'border-[#F87116] shadow-md shadow-orange-100 bg-white ring-2 ring-[#F87116]/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}
    >
      {/* Barra de urgência (topo) */}
      <div className={`h-1 w-full ${styles.bar} flex-shrink-0`} />

      {/* Conteúdo principal */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">#{comanda.number}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
              <Clock className="h-2.5 w-2.5" />
              {formatTimeOpen(comanda.opened_at)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {itemCount === 0 ? 'Sem itens' : `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-extrabold text-slate-900 leading-tight">
            {formatCurrency(comanda.total_amount, currency)}
          </p>
          {isSelected && (
            <button
              onClick={onClose}
              className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#F87116] hover:underline ml-auto"
            >
              <CheckCircle2 className="h-3 w-3" />
              Fechar (F8)
            </button>
          )}
        </div>
      </div>

      {/* Itens (expandidos quando selecionado) */}
      <AnimatePresence>
        {isSelected && itemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="px-4 pb-3 pt-2 space-y-1.5 max-h-60 overflow-y-auto">
              {comanda.items?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{item.description}</p>
                    <p className="text-slate-400">
                      {item.quantity % 1 !== 0 ? item.quantity.toFixed(3) : item.quantity}
                      {' × '}
                      {formatCurrency(item.unit_price, currency)}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-700 flex-shrink-0">
                    {formatCurrency(item.total_price, currency)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selecionado indicator */}
      {isSelected && (
        <div className="px-4 pb-3 pt-1 border-t border-orange-100 bg-orange-50/60 flex items-center gap-2">
          <Zap className="h-3 w-3 text-[#F87116]" />
          <span className="text-[10px] text-[#F87116] font-semibold">Ativa — escaneie produtos para adicionar</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Buffet() {
  const restaurantId = useAdminRestaurantId();
  const currency     = useAdminCurrency();
  const {
    comandas, loading, isLive,
    createComanda, addItemToComanda, closeComanda, refresh,
  } = useComandas(restaurantId || '');
  const { pendingCount, isOnline, isSyncing } = useOfflineSync(restaurantId || '');

  const [products,           setProducts]           = useState<Product[]>([]);
  const [selectedComandaId,  setSelectedComandaId]  = useState<string | null>(null);
  const [scannerInput,       setScannerInput]        = useState('');
  const [weightInput,        setWeightInput]         = useState('');
  const [selectedProduct,    setSelectedProduct]     = useState<Product | null>(null);
  const [showCloseDialog,    setShowCloseDialog]     = useState(false);
  const [closingComandaId,   setClosingComandaId]    = useState<string | null>(null);
  const [activeVirtualComanda, setActiveVirtualComanda] = useState<ActiveVirtualComanda | null>(null);
  const [loadingVirtual,     setLoadingVirtual]      = useState(false);

  const scannerRef = useRef<HTMLInputElement>(null);
  const weightRef  = useRef<HTMLInputElement>(null);

  const selectedComanda = selectedComandaId
    ? (comandas.find((c) => c.id === selectedComandaId) ?? null)
    : null;

  // ── Hotkeys ──────────────────────────────────────────────────────────────────
  useHotkeys('f2', () => handleNewComanda(), { preventDefault: true });
  useHotkeys('f8', () => {
    if (selectedComanda) { setClosingComandaId(selectedComanda.id); setShowCloseDialog(true); }
  }, { preventDefault: true, enableOnFormTags: true });
  useHotkeys('escape', () => {
    setSelectedComandaId(null);
    setSelectedProduct(null);
    setWeightInput('');
    setScannerInput('');
  }, { preventDefault: true });

  // ── Carregar produtos ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('products').select('*')
      .eq('restaurant_id', restaurantId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data ?? []));
  }, [restaurantId]);

  // Focus scanner quando não há comanda selecionada
  useEffect(() => {
    if (!selectedComanda) scannerRef.current?.focus();
  }, [selectedComanda]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleNewComanda = async () => {
    try {
      const id = await createComanda();
      setSelectedComandaId(id);
      setScannerInput('');
      scannerRef.current?.focus();
    } catch {
      toast({ title: 'Erro ao criar comanda', variant: 'destructive' });
    }
  };

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
      setSelectedComandaId(null);
      toast({ title: `✅ ${shortCode} vinculada!`, description: data.customer_name ? `Cliente: ${data.customer_name}` : undefined });
      weightRef.current?.focus();
    } finally {
      setLoadingVirtual(false);
    }
  };

  const handleScannerInput = async (value: string) => {
    const v = value.trim();
    if (!v) return;

    if (VIRTUAL_COMANDA_PATTERN.test(v)) {
      await handleVirtualComandaScan(v);
      return;
    }

    if (/^\d+$/.test(v)) {
      const comanda = comandas.find((c) => c.number === parseInt(v, 10));
      if (comanda) {
        setSelectedComandaId(comanda.id);
        setActiveVirtualComanda(null);
        toast({ title: `Comanda #${v} selecionada` });
        weightRef.current?.focus();
      } else {
        toast({ title: `Comanda #${v} não encontrada`, variant: 'destructive' });
      }
      return;
    }

    const product = products.find(
      (p) => p.sku?.toLowerCase() === v.toLowerCase() || p.name.toLowerCase().includes(v.toLowerCase())
    );
    if (product) {
      setSelectedProduct(product);
      if (!product.is_by_weight) handleAddProduct(product, 1);
      else weightRef.current?.focus();
    } else {
      toast({ title: 'Produto não encontrado', variant: 'destructive' });
    }
  };

  const handleAddProduct = async (product: Product, quantity: number) => {
    const unitPrice = product.price_sale || product.price;

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
        setActiveVirtualComanda((prev) =>
          prev ? { ...prev, total_amount: prev.total_amount + unitPrice * quantity } : prev
        );
        setWeightInput('');
        setSelectedProduct(null);
        weightRef.current?.focus();
        toast({ title: `${product.name} → ${activeVirtualComanda.short_code}` });
      } catch {
        toast({ title: 'Erro ao adicionar produto', variant: 'destructive' });
      }
      return;
    }

    if (!selectedComanda) {
      toast({ title: 'Selecione uma comanda primeiro', variant: 'destructive' });
      return;
    }

    try {
      await addItemToComanda(selectedComanda.id, {
        product_id: product.id,
        description: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
      });
      setWeightInput('');
      setSelectedProduct(null);
      weightRef.current?.focus();
      toast({ title: `${product.name} adicionado!` });
    } catch {
      toast({ title: 'Erro ao adicionar produto', variant: 'destructive' });
    }
  };

  const handleWeightSubmit = async () => {
    if (!selectedProduct) return;
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
      if (isOnline) {
        const { error } = await supabase.from('comanda_items').delete().eq('id', itemId);
        if (error) throw error;
      }
      await offlineDB.comandaItems.delete(itemId);
      refresh();
      toast({ title: 'Item removido' });
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'destructive' });
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    if (!product.is_by_weight) handleAddProduct(product, 1);
    else weightRef.current?.focus();
  };

  // ── Métricas rápidas ──────────────────────────────────────────────────────────
  const totalAberto = comandas.reduce((s, c) => s + c.total_amount, 0);
  const closingComanda = closingComandaId ? comandas.find((c) => c.id === closingComandaId) : null;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading && comandas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#F87116] mx-auto" />
          <p className="text-sm text-slate-500">Carregando comandas…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 min-h-screen">

      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <StatusBar
        isLive={isLive}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        onRefresh={() => refresh()}
        onNewComanda={handleNewComanda}
        loading={loading}
      />

      {/* ── Métricas rápidas ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Abertas', value: String(comandas.length), icon: Receipt, color: 'text-[#F87116]', bg: 'bg-orange-50' },
          { label: 'Total aberto', value: formatCurrency(totalAberto, currency), icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Selecionada', value: selectedComanda ? `#${selectedComanda.number}` : '—', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Layout principal: Scanner (esq) + Comandas (dir) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 flex-1">

        {/* Coluna esquerda: scanner + produtos */}
        <ScannerPanel
          scannerRef={scannerRef}
          weightRef={weightRef}
          scannerInput={scannerInput}
          setScannerInput={setScannerInput}
          onScannerEnter={handleScannerInput}
          weightInput={weightInput}
          setWeightInput={setWeightInput}
          onWeightSubmit={handleWeightSubmit}
          selectedProduct={selectedProduct}
          selectedComanda={selectedComanda}
          activeVirtualComanda={activeVirtualComanda}
          onDeselectComanda={() => { setSelectedComandaId(null); setSelectedProduct(null); scannerRef.current?.focus(); }}
          onDeselectVirtual={() => { setActiveVirtualComanda(null); scannerRef.current?.focus(); }}
          loadingVirtual={loadingVirtual}
          currency={currency}
          products={products}
          onProductClick={handleProductClick}
        />

        {/* Coluna direita: grid de comandas */}
        <div className="flex flex-col gap-4">

          {/* Header da lista */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Comandas abertas
              <span className="ml-2 font-normal text-slate-400">({comandas.length})</span>
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />até 15min</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />15–60min</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />{'>'}60min</span>
            </div>
          </div>

          {/* Empty state */}
          {comandas.length === 0 && (
            <div className="flex-1 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-14 text-center">
              <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-6 w-6 text-[#F87116]" />
              </div>
              <p className="font-semibold text-slate-700">Nenhuma comanda aberta</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Crie a primeira comanda para começar</p>
              <Button onClick={handleNewComanda} className="gap-2 bg-[#F87116] hover:bg-[#e56910] text-white">
                <Plus className="h-4 w-4" />
                Criar Comanda
              </Button>
            </div>
          )}

          {/* Grid de comandas */}
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {comandas.map((comanda) => (
                <ComandaCard
                  key={comanda.id}
                  comanda={comanda}
                  isSelected={selectedComandaId === comanda.id}
                  currency={currency}
                  onSelect={() => {
                    setSelectedComandaId(comanda.id);
                    setActiveVirtualComanda(null);
                  }}
                  onClose={(e) => {
                    e.stopPropagation();
                    setClosingComandaId(comanda.id);
                    setShowCloseDialog(true);
                  }}
                />
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modal: Fechar Comanda ───────────────────────────────────────── */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <DialogTitle>Fechar Comanda</DialogTitle>
            </div>
          </DialogHeader>
          {closingComanda && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Comanda #{closingComanda.number}</p>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {formatCurrency(closingComanda.total_amount, currency)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {closingComanda.items?.length ?? 0} item(s) · {formatTimeOpen(closingComanda.opened_at)} aberta
                </p>
              </div>

              {/* Lista de itens no modal */}
              {(closingComanda.items?.length ?? 0) > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {closingComanda.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-800">{item.description}</p>
                        <p className="text-slate-400">
                          {item.quantity} × {formatCurrency(item.unit_price, currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(item.total_price, currency)}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-5 w-5 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowCloseDialog(false); setClosingComandaId(null); }}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                  <CheckCircle2 className="h-4 w-4 mr-2" />
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
