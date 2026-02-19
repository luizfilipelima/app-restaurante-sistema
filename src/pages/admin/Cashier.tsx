import { useEffect, useRef, useState } from 'react';
import { useAdminRestaurantId, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  ScanBarcode,
  Receipt,
  CheckCircle2,
  X,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface VirtualComandaItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

interface VirtualComanda {
  id: string;
  short_code: string;
  customer_name: string | null;
  table_number: string | null;
  total_amount: number;
  status: 'open' | 'paid' | 'cancelled';
  items: VirtualComandaItem[];
}

type PaymentMethod = 'cash' | 'card' | 'pix';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'card', label: 'Cartão',   icon: CreditCard },
  { value: 'pix',  label: 'PIX',      icon: Smartphone },
];

// Padrão CMD-XXXX (aceita espaços de ambos os lados que o scanner pode emitir)
const VIRTUAL_COMANDA_PATTERN = /^CMD-[A-Z0-9]{4}$/i;

// ─── Componente principal ─────────────────────────────────────────────────────

function CashierContent() {
  const restaurantId   = useAdminRestaurantId();
  const currency       = useAdminCurrency();
  const scannerRef     = useRef<HTMLInputElement>(null);

  const [scanInput,    setScanInput]    = useState('');
  const [comanda,      setComanda]      = useState<VirtualComanda | null>(null);
  const [scanning,     setScanning]     = useState(false);
  const [closing,      setClosing]      = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [scanError,    setScanError]    = useState<string | null>(null);
  const [closed,       setClosed]       = useState(false);

  // Foca no input ao montar e sempre que a comanda for limpa
  useEffect(() => {
    scannerRef.current?.focus();
  }, [comanda]);

  // ── Leitura do scanner (Enter dispara a busca) ──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const value = scanInput.trim();
    setScanInput('');

    if (!value) return;

    if (!VIRTUAL_COMANDA_PATTERN.test(value)) {
      setScanError(`Código "${value}" não é um código de comanda válido. Esperado: CMD-XXXX`);
      return;
    }

    fetchComanda(value.toUpperCase());
  };

  // ── Busca comanda + itens no Supabase ────────────────────────────────────────
  const fetchComanda = async (shortCode: string) => {
    if (!restaurantId) return;
    setScanning(true);
    setScanError(null);
    setComanda(null);
    setClosed(false);

    try {
      const { data: vc, error: vcErr } = await supabase
        .from('virtual_comandas')
        .select('id, short_code, customer_name, table_number, total_amount, status')
        .eq('restaurant_id', restaurantId)
        .eq('short_code', shortCode)
        .single();

      if (vcErr || !vc) {
        setScanError(`Comanda ${shortCode} não encontrada neste restaurante.`);
        return;
      }

      if (vc.status !== 'open') {
        setScanError(
          vc.status === 'paid'
            ? `Comanda ${shortCode} já foi paga e encerrada.`
            : `Comanda ${shortCode} foi cancelada.`
        );
        return;
      }

      const { data: items } = await supabase
        .from('virtual_comanda_items')
        .select('id, product_name, quantity, unit_price, total_price, notes')
        .eq('comanda_id', vc.id)
        .order('created_at', { ascending: true });

      setComanda({ ...vc, items: (items ?? []) as VirtualComandaItem[] });
    } finally {
      setScanning(false);
    }
  };

  // ── Encerra a comanda via RPC close_virtual_comanda() ────────────────────────
  const handleCloseComanda = async () => {
    if (!comanda) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.rpc('close_virtual_comanda', {
        p_comanda_id:     comanda.id,
        p_payment_method: paymentMethod,
      });

      if (error) throw error;

      setClosed(true);
      setComanda(null);

      toast({
        title: '✅ Comanda encerrada!',
        description: `Pedido #${String(data?.order_id ?? '').slice(0, 8).toUpperCase()} criado — ${formatCurrency(comanda.total_amount, currency)} (${PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label})`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao encerrar comanda',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setClosing(false);
      scannerRef.current?.focus();
    }
  };

  const handleClear = () => {
    setComanda(null);
    setScanError(null);
    setClosed(false);
    setScanInput('');
    scannerRef.current?.focus();
  };

  const total = comanda?.total_amount ?? 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Caixa — Comandas Digitais</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Escaneie o código de barras do celular do cliente para carregar e encerrar a comanda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Coluna esquerda: Scanner ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <ScanBarcode className="h-4 w-4 text-slate-500" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Leitor de Código</h2>
            </div>

            {/* Input do scanner — recebe dados do hardware como digitação */}
            <div className="relative">
              <input
                ref={scannerRef}
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Aguardando leitura…"
                autoFocus
                autoComplete="off"
                className="w-full h-14 px-4 rounded-xl border border-input bg-background font-mono text-xl tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 focus:border-[#F87116] transition-colors"
              />
              {scanning && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              O leitor emula teclado — pressione <kbd className="px-1 py-0.5 rounded border text-[10px]">Enter</kbd> após digitar manualmente
            </p>

            {/* Erro de scan */}
            {scanError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Sucesso de encerramento */}
            {closed && !comanda && (
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Comanda encerrada com sucesso! Aguardando próxima leitura.</span>
              </div>
            )}
          </div>

          {/* Instruções */}
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-600">Como funciona:</p>
            <p>1. Cliente exibe o código de barras no celular</p>
            <p>2. Aponte o scanner para a tela do cliente</p>
            <p>3. O extrato carrega automaticamente</p>
            <p>4. Selecione a forma de pagamento e encerre</p>
          </div>
        </div>

        {/* ── Coluna direita: Extrato + Encerramento ── */}
        <div className="lg:col-span-3">
          {!comanda ? (
            <div className="flex flex-col items-center justify-center min-h-[24rem] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center p-8 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Receipt className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Nenhuma comanda carregada</p>
                <p className="text-xs text-slate-400 mt-1">
                  Escaneie o código do cliente para exibir o extrato aqui.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">

              {/* Header da comanda */}
              <div className="px-5 py-4 bg-slate-50 border-b border-border flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground font-mono tracking-wide">
                      {comanda.short_code}
                    </h3>
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Aberta</Badge>
                    {comanda.table_number && (
                      <Badge variant="outline" className="text-[10px]">
                        Mesa {comanda.table_number}
                      </Badge>
                    )}
                  </div>
                  {comanda.customer_name && (
                    <p className="text-sm text-muted-foreground mt-0.5">{comanda.customer_name}</p>
                  )}
                </div>
                <button
                  onClick={handleClear}
                  className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  title="Limpar e escanear outra comanda"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Lista de itens */}
              <div className="divide-y divide-border">
                {comanda.items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Esta comanda não possui itens.
                  </div>
                ) : (
                  comanda.items.map((item) => (
                    <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 text-right text-xs font-bold text-muted-foreground bg-muted rounded px-1 py-0.5 font-mono mt-0.5">
                        {Number(item.quantity) % 1 === 0
                          ? `${item.quantity}×`
                          : `${Number(item.quantity).toFixed(3)}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {item.product_name}
                        </p>
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground">{item.notes}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {formatCurrency(Number(item.unit_price), currency)} / un.
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-semibold text-foreground">
                        {formatCurrency(Number(item.total_price), currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-2xl font-black text-foreground">
                  {formatCurrency(total, currency)}
                </span>
              </div>

              {/* Forma de pagamento */}
              <div className="px-5 py-4 border-t border-border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Forma de Pagamento
                </p>
                <div className="flex gap-2">
                  {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        paymentMethod === value
                          ? 'border-[#F87116] bg-orange-50 text-[#F87116]'
                          : 'border-border bg-background text-muted-foreground hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão de encerramento */}
              <div className="px-5 pb-5">
                <button
                  onClick={handleCloseComanda}
                  disabled={closing || comanda.items.length === 0}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#F87116] to-orange-500 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white text-base font-bold py-4 rounded-xl shadow-md shadow-orange-200/50 hover:brightness-105 transition-all active:scale-[0.99]"
                >
                  {closing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {closing
                    ? 'Encerrando…'
                    : `Cobrar e Encerrar — ${formatCurrency(total, currency)}`
                  }
                </button>
                {comanda.items.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Adicione itens à comanda antes de encerrar.
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

// ─── Wrapper com FeatureGuard Enterprise ─────────────────────────────────────

export default function Cashier() {
  return (
    <FeatureGuard feature="feature_virtual_comanda">
      <CashierContent />
    </FeatureGuard>
  );
}
