/**
 * Cashier — Comandas Digitais
 *
 * Layout:
 *  • Esquerda — scanner + lista de comandas ativas em tempo real
 *  • Direita  — extrato da comanda selecionada, remoção de itens, encerramento
 *
 * Ao "Marcar Concluído":
 *  - RPC cashier_complete_comanda → order.status = 'completed', is_paid = true
 *  - Comanda virtual → status = 'paid' (resetada para próximo cliente)
 *  - Dashboard BI alimentado automaticamente
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ScanBarcode, Receipt, CheckCircle2, X, Loader2,
  Banknote, CreditCard, Smartphone, AlertCircle,
  Trash2, User, Clock, ShoppingBag, RefreshCw,
  ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ComandaItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

interface ActiveComanda {
  id: string;
  short_code: string;
  customer_name: string | null;
  table_number: string | null;
  total_amount: number;
  created_at: string;
  /** Fallback: soma dos itens quando total_amount está incorreto (ex: trigger falhou) */
  virtual_comanda_items?: { total_price: number }[];
}

interface SelectedComanda extends ActiveComanda {
  items: ComandaItem[];
}

type PaymentMethod = 'cash' | 'card' | 'pix';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'card', label: 'Cartão',   icon: CreditCard },
  { value: 'pix',  label: 'PIX',      icon: Smartphone },
];

const SCANNER_PATTERN = /^CMD-[A-Z0-9]{4}$/i;

/** Total exibido: usa total_amount ou soma dos itens (quando total_amount está incorreto) */
function getDisplayTotal(
  totalAmount: number,
  items?: { total_price: number }[] | ComandaItem[]
): number {
  if (totalAmount != null && totalAmount > 0) return totalAmount;
  const list = items ?? [];
  return list.reduce((s, i) => s + Number(i.total_price), 0);
}

// ─── Componente: Card de comanda ativa ────────────────────────────────────────

function ComandaCard({
  comanda,
  selected,
  currency,
  onClick,
  onDelete,
  deleting,
}: {
  comanda: ActiveComanda;
  selected: boolean;
  currency: 'BRL' | 'PYG';
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deleting: boolean;
}) {
  return (
    <div
      className={`relative w-full rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-[#F87116] bg-orange-50/60'
          : 'border-border bg-card hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <button
        onClick={onClick}
        className="w-full text-left focus:outline-none focus:ring-0"
      >
        <div className="flex items-start justify-between gap-2 pr-7">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-mono text-xs font-bold tracking-wider ${selected ? 'text-[#F87116]' : 'text-foreground'}`}>
                {comanda.short_code}
              </span>
              {comanda.table_number && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                  Mesa {comanda.table_number}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {comanda.customer_name || 'Sem nome'}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-bold text-foreground">
              {formatCurrency(getDisplayTotal(comanda.total_amount, comanda.virtual_comanda_items), currency)}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatDistanceToNow(new Date(comanda.created_at), { addSuffix: false, locale: ptBR })}
            </p>
          </div>
        </div>
        {selected && (
          <div className="flex items-center gap-1 mt-2 text-[11px] text-[#F87116] font-medium">
            <ChevronRight className="h-3 w-3" />
            Visualizando extrato
          </div>
        )}
      </button>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="absolute right-2 top-2.5 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
        title="Excluir comanda e seus dados"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function CashierContent() {
  const restaurantId = useAdminRestaurantId();
  const currency     = useAdminCurrency();
  const scannerRef   = useRef<HTMLInputElement>(null);

  // Estado da lista de comandas ativas
  const [activeComandas, setActiveComandas] = useState<ActiveComanda[]>([]);
  const [loadingList,    setLoadingList]    = useState(true);
  const [isLive,         setIsLive]         = useState(false);

  // Estado da comanda selecionada
  const [selected,       setSelected]       = useState<SelectedComanda | null>(null);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [removingId,     setRemovingId]     = useState<string | null>(null);
  const [closing,        setClosing]        = useState(false);
  const [deletingComandaId, setDeletingComandaId] = useState<string | null>(null);
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('cash');

  // Scanner
  const [scanInput,  setScanInput]  = useState('');
  const [scanError,  setScanError]  = useState<string | null>(null);
  const [justClosed, setJustClosed] = useState(false);

  // ── Carrega a lista de comandas abertas ────────────────────────────────────

  const loadActiveComandas = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('virtual_comandas')
      .select('id, short_code, customer_name, table_number, total_amount, created_at, virtual_comanda_items(total_price)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'open')
      .order('created_at', { ascending: true });
    setActiveComandas((data ?? []) as ActiveComanda[]);
    setLoadingList(false);
  }, [restaurantId]);

  useEffect(() => { loadActiveComandas(); }, [loadActiveComandas]);

  // ── Real-time: mudanças em virtual_comandas ────────────────────────────────

  const handleComandasRealtime = useCallback(() => {
    loadActiveComandas();
  }, [loadActiveComandas]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`cashier-comandas-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'virtual_comandas',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, handleComandasRealtime)
      .subscribe((status, err) => {
        setIsLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' && import.meta.env.DEV && err) {
          console.warn('[Cashier Realtime]', status, err);
        }
      });
    return () => {
      supabase.removeChannel(ch);
      setIsLive(false);
    };
  }, [restaurantId, handleComandasRealtime]);

  // Fallback: polling quando Realtime não está conectado (ex: tabela fora da publicação)
  useEffect(() => {
    if (!restaurantId || isLive) return;
    const interval = setInterval(() => loadActiveComandas(), 8000);
    return () => clearInterval(interval);
  }, [restaurantId, isLive, loadActiveComandas]);

  // ── Real-time: mudanças nos itens da comanda selecionada ──────────────────

  useEffect(() => {
    if (!selected) return;
    const ch = supabase
      .channel(`cashier-items-${restaurantId}-${selected.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'virtual_comanda_items',
        filter: `comanda_id=eq.${selected.id}`,
      }, async () => {
        const [{ data: items }, { data: vc }] = await Promise.all([
          supabase
            .from('virtual_comanda_items')
            .select('id, product_name, quantity, unit_price, total_price, notes')
            .eq('comanda_id', selected.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('virtual_comandas')
            .select('total_amount, customer_name')
            .eq('id', selected.id)
            .single(),
        ]);
        setSelected(prev => prev ? {
          ...prev,
          items: (items ?? []) as ComandaItem[],
          total_amount: vc?.total_amount ?? prev.total_amount,
          customer_name: vc?.customer_name ?? prev.customer_name,
        } : null);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seleciona e carrega uma comanda ───────────────────────────────────────

  const selectComanda = async (comanda: ActiveComanda) => {
    if (selected?.id === comanda.id) return;
    setLoadingDetail(true);
    setScanError(null);
    try {
      const { data: items } = await supabase
        .from('virtual_comanda_items')
        .select('id, product_name, quantity, unit_price, total_price, notes')
        .eq('comanda_id', comanda.id)
        .order('created_at', { ascending: true });
      setSelected({ ...comanda, items: (items ?? []) as ComandaItem[] });
      setJustClosed(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Scanner ───────────────────────────────────────────────────────────────

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const value = scanInput.trim().toUpperCase();
    setScanInput('');
    if (!value) return;

    if (!SCANNER_PATTERN.test(value)) {
      setScanError(`"${value}" não é um código de comanda válido. Formato esperado: CMD-XXXX`);
      return;
    }

    const found = activeComandas.find(c => c.short_code === value);
    if (found) {
      selectComanda(found);
    } else {
      setScanError(`Comanda ${value} não encontrada ou já encerrada.`);
    }
  };

  // ── Remover item da comanda ────────────────────────────────────────────────

  const removeItem = async (itemId: string) => {
    if (!selected) return;
    setRemovingId(itemId);
    try {
      const { error } = await supabase
        .from('virtual_comanda_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;

      // Atualiza UI local imediatamente
      const newItems = selected.items.filter(i => i.id !== itemId);
      const newTotal = newItems.reduce((s, i) => s + Number(i.total_price), 0);
      setSelected(prev => prev ? { ...prev, items: newItems, total_amount: newTotal } : null);
      setActiveComandas(prev =>
        prev.map(c => c.id === selected.id ? { ...c, total_amount: newTotal } : c)
      );
    } catch (err: any) {
      toast({ title: 'Erro ao remover item', description: err?.message, variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  // ── Marcar comanda como concluída ─────────────────────────────────────────

  const handleComplete = async () => {
    if (!selected || closing) return;
    setClosing(true);
    try {
      const { error } = await supabase.rpc('cashier_complete_comanda', {
        p_comanda_id:     selected.id,
        p_payment_method: paymentMethod,
      });
      if (error) throw error;

      const label = PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label ?? paymentMethod;
      const displayTotal = getDisplayTotal(selected.total_amount, selected.items);
      toast({
        title: 'Comanda concluída!',
        description: `${selected.short_code} — ${formatCurrency(displayTotal, currency)} via ${label}`,
      });

      setSelected(null);
      setJustClosed(true);
      setActiveComandas(prev => prev.filter(c => c.id !== selected.id));
      scannerRef.current?.focus();
    } catch (err: any) {
      toast({ title: 'Erro ao encerrar comanda', description: err?.message, variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  const handleClearSelection = () => {
    setSelected(null);
    setScanError(null);
    scannerRef.current?.focus();
  };

  // ── Excluir comanda (status → cancelled) ────────────────────────────────────

  const handleDeleteComanda = async (comandaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingComandaId(comandaId);
    try {
      const { error } = await supabase
        .from('virtual_comandas')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', comandaId);

      if (error) throw error;

      if (selected?.id === comandaId) {
        setSelected(null);
      }
      setActiveComandas(prev => prev.filter(c => c.id !== comandaId));
      toast({ title: 'Comanda excluída', description: 'A comanda e seus dados foram removidos.', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir comanda', description: err?.message, variant: 'destructive' });
    } finally {
      setDeletingComandaId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const total = getDisplayTotal(selected?.total_amount ?? 0, selected?.items);
  const hasItems = (selected?.items?.length ?? 0) > 0;

  return (
    <div className="space-y-6 h-full">

      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caixa — Comandas Digitais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Selecione uma comanda ativa ou escaneie o código do cliente para encerrar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicador Ao Vivo */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
            isLive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-muted border-border text-muted-foreground'
          }`}>
            {isLive ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="h-3 w-3" />
                {loadingList ? '…' : activeComandas.length} aberta{activeComandas.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Conectando…
              </>
            )}
          </div>
          <button
            onClick={loadActiveComandas}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ══ COLUNA ESQUERDA: Scanner + Lista de comandas ══ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Scanner */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ScanBarcode className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground leading-tight">Leitor de Código</h2>
                <p className="text-[11px] text-muted-foreground">
                  Escaneie ou digite o código CMD-XXXX
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                ref={scannerRef}
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanError(null); }}
                onKeyDown={handleScanKeyDown}
                placeholder="CMD-XXXX"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="w-full h-12 px-4 rounded-xl border border-input bg-background font-mono text-lg tracking-widest text-center placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 focus:border-[#F87116] transition-colors"
              />
              {loadingDetail && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {scanError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {justClosed && !selected && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                Comanda encerrada! Aguardando próxima leitura.
              </div>
            )}
          </div>

          {/* Lista de Comandas Ativas */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Comandas Abertas</h2>
              {!loadingList && activeComandas.length > 0 && (
                <Badge className="bg-[#F87116]/10 text-[#F87116] border-0 text-xs">
                  {activeComandas.length}
                </Badge>
              )}
            </div>

            <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              ) : activeComandas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma comanda aberta</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Quando clientes abrirem comandas, elas aparecem aqui.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {activeComandas.map(comanda => (
                    <ComandaCard
                      key={comanda.id}
                      comanda={comanda}
                      selected={selected?.id === comanda.id}
                      currency={currency}
                      onClick={() => selectComanda(comanda)}
                      onDelete={(e) => handleDeleteComanda(comanda.id, e)}
                      deleting={deletingComandaId === comanda.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ COLUNA DIREITA: Extrato + Encerramento ══ */}
        <div className="lg:col-span-3">
          {!selected ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center min-h-[480px] rounded-xl border-2 border-dashed border-muted bg-muted/20 gap-5 p-8 text-center">
              <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                <ShoppingBag className="h-9 w-9 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-base font-semibold text-muted-foreground">
                  Nenhuma comanda selecionada
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1.5 max-w-xs">
                  Selecione uma comanda da lista ao lado ou escaneie o código do cliente.
                </p>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground/60 mt-2">
                <p className="flex items-center gap-1.5 justify-center">
                  <ScanBarcode className="h-3.5 w-3.5" />
                  Escaneie o código de barras no celular do cliente
                </p>
                <p className="flex items-center gap-1.5 justify-center">
                  <Receipt className="h-3.5 w-3.5" />
                  Ou clique em uma comanda da lista
                </p>
              </div>
            </div>
          ) : (
            /* ── Extrato da comanda ── */
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-50/60 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-lg font-black text-foreground tracking-wider">
                        {selected.short_code}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                        Aberta
                      </Badge>
                      {selected.table_number && (
                        <Badge variant="outline" className="text-[10px]">
                          Mesa {selected.table_number}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {selected.customer_name || <em className="opacity-60">Sem nome</em>}
                      </span>
                      <span className="text-muted-foreground/40 mx-1">·</span>
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="text-xs">
                        {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-200 hover:text-foreground transition-colors"
                    title="Fechar extrato"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Itens */}
              <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                {selected.items.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Esta comanda não possui itens.</p>
                  </div>
                ) : (
                  selected.items.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/30 transition-colors"
                    >
                      <span className="flex-shrink-0 w-7 text-right text-xs font-bold text-muted-foreground font-mono">
                        {Number(item.quantity) % 1 === 0
                          ? `${item.quantity}×`
                          : `${Number(item.quantity).toFixed(3)}`}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {item.product_name}
                        </p>
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground italic">{item.notes}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {formatCurrency(Number(item.unit_price), currency)} / un.
                        </p>
                      </div>

                      <span className="flex-shrink-0 text-sm font-semibold text-foreground">
                        {formatCurrency(Number(item.total_price), currency)}
                      </span>

                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={!!removingId}
                        className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
                        title="Remover item"
                      >
                        {removingId === item.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-2xl font-black text-foreground tabular-nums">
                  {formatCurrency(total, currency)}
                </span>
              </div>

              {/* Forma de pagamento */}
              <div className="px-5 py-4 border-t border-border/60 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Forma de Pagamento
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        paymentMethod === value
                          ? 'border-[#F87116] bg-orange-50 text-[#F87116] shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-slate-300 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão: Marcar Concluído */}
              <div className="px-5 pb-5 space-y-2">
                <motion.button
                  onClick={handleComplete}
                  disabled={closing || !hasItems}
                  whileHover={!closing && hasItems ? { scale: 1.015 } : {}}
                  whileTap={!closing && hasItems ? { scale: 0.97 } : {}}
                  transition={{ duration: 0.15 }}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#F87116] to-orange-500 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-400 text-base font-bold py-4 rounded-xl shadow-md shadow-orange-200/40 hover:brightness-105 transition-all"
                >
                  {closing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {closing
                    ? 'Encerrando…'
                    : `Marcar Concluído — ${formatCurrency(total, currency)}`
                  }
                </motion.button>

                {!hasItems && (
                  <p className="text-center text-xs text-muted-foreground">
                    A comanda está vazia. Adicione itens antes de encerrar.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Export com FeatureGuard ──────────────────────────────────────────────────

export default function Cashier() {
  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <CashierContent />
    </FeatureGuard>
  );
}
