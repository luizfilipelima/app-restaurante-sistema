import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Barcode from 'react-barcode';
import { supabase } from '@/lib/supabase';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import { ShoppingBag, RefreshCw, AlertCircle, Loader2, ChefHat, Receipt } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
  currency: string | null;
}

interface VirtualComanda {
  id: string;
  short_code: string;
  status: 'open' | 'paid' | 'cancelled';
  total_amount: number;
  restaurant_id: string;
}

interface ComandaItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
}

// ─── Chave de LocalStorage por restaurante ────────────────────────────────────

const storageKey = (slug: string) => `vc_comanda_${slug}`;

interface StoredComanda {
  comanda_id: string;
  short_code: string;
  restaurant_id: string;
  created_at: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VirtualComanda() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [comanda, setComanda] = useState<VirtualComanda | null>(null);
  const [items, setItems] = useState<ComandaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Ref para poder recarregar itens dentro do callback Realtime
  const comandaIdRef = useRef<string | null>(null);

  // ── 1. Carrega o restaurante pelo slug ──────────────────────────────────────
  useEffect(() => {
    if (!restaurantSlug) return;

    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        // Busca o restaurante
        const { data: rest, error: restErr } = await supabase
          .from('restaurants')
          .select('id, name, logo, currency')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();

        if (restErr || !rest) {
          setError('Restaurante não encontrado ou inativo.');
          return;
        }

        setRestaurant(rest);

        // Tenta reusar comanda existente no localStorage
        await resolveComanda(rest);
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [restaurantSlug]);

  // ── 2. Resolve comanda (localStorage → banco → criar nova) ─────────────────
  const resolveComanda = async (rest: Restaurant) => {
    const key = storageKey(restaurantSlug!);
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed: StoredComanda = JSON.parse(stored);

        // Verifica se a comanda ainda está aberta no banco
        const { data: existing } = await supabase
          .from('virtual_comandas')
          .select('id, short_code, status, total_amount, restaurant_id')
          .eq('id', parsed.comanda_id)
          .eq('restaurant_id', rest.id)
          .single();

        if (existing && existing.status === 'open') {
          setComanda(existing);
          comandaIdRef.current = existing.id;
          await loadItems(existing.id);
          return; // Comanda válida reutilizada
        }
      } catch {
        // Dado corrompido no localStorage → segue para criar nova
      }

      // Comanda expirada/paga/cancelada → limpa o cache
      localStorage.removeItem(key);
    }

    // Cria nova comanda via RPC
    await createComanda(rest);
  };

  // ── 3. Cria nova comanda via RPC open_virtual_comanda() ─────────────────────
  const createComanda = async (rest: Restaurant) => {
    setCreating(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('open_virtual_comanda', {
        p_restaurant_id: rest.id,
        p_table_number: null,
        p_customer_name: null,
      });

      if (rpcErr) {
        // Feature não disponível no plano → mensagem amigável
        if (rpcErr.message?.includes('Plano')) {
          setError('Este restaurante ainda não ativou as Comandas Digitais.');
        } else {
          setError(`Não foi possível abrir a comanda: ${rpcErr.message}`);
        }
        return;
      }

      const newComanda: VirtualComanda = {
        id: data.comanda_id,
        short_code: data.short_code,
        status: 'open',
        total_amount: 0,
        restaurant_id: rest.id,
      };

      // Persiste no localStorage para reuso em visitas futuras
      const toStore: StoredComanda = {
        comanda_id: data.comanda_id,
        short_code: data.short_code,
        restaurant_id: rest.id,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(storageKey(restaurantSlug!), JSON.stringify(toStore));

      setComanda(newComanda);
      comandaIdRef.current = newComanda.id;
    } finally {
      setCreating(false);
    }
  };

  // ── 4. Carrega os itens da comanda ──────────────────────────────────────────
  const loadItems = async (comandaId: string) => {
    const { data } = await supabase
      .from('virtual_comanda_items')
      .select('id, product_name, quantity, unit_price, total_price, notes, created_at')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: true });

    setItems((data as ComandaItem[]) ?? []);
  };

  // ── 5. Supabase Realtime — atualiza extrato em tempo real ───────────────────
  useEffect(() => {
    if (!comanda?.id) return;

    const channel = supabase
      .channel(`vc-items-${comanda.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'virtual_comanda_items',
          filter: `comanda_id=eq.${comanda.id}`,
        },
        () => {
          // Recarrega todos os itens ao detectar qualquer mudança
          if (comandaIdRef.current) {
            loadItems(comandaIdRef.current);
          }
        }
      )
      // Também escuta mudanças no total da comanda (ex: fechamento pelo staff)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'virtual_comandas',
          filter: `id=eq.${comanda.id}`,
        },
        (payload) => {
          const updated = payload.new as VirtualComanda;
          setComanda((prev) => prev ? { ...prev, ...updated } : prev);

          // Se a comanda foi paga ou cancelada, limpa o localStorage
          if (updated.status !== 'open') {
            localStorage.removeItem(storageKey(restaurantSlug!));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [comanda?.id, restaurantSlug]);

  // ── 6. Nova comanda (botão de reset) ────────────────────────────────────────
  const handleNewComanda = async () => {
    if (!restaurant) return;
    localStorage.removeItem(storageKey(restaurantSlug!));
    setComanda(null);
    setItems([]);
    setLoading(true);
    try {
      await createComanda(restaurant);
    } finally {
      setLoading(false);
    }
  };

  // ── 7. Navega para o cardápio passando o ID da comanda ─────────────────────
  const handleFazerPedido = () => {
    if (!restaurantSlug || !comanda) return;
    navigate(`/${restaurantSlug}?comanda_id=${comanda.id}`);
  };

  const currency = (restaurant?.currency ?? 'BRL') as CurrencyCode;
  const total = items.reduce((sum, i) => sum + Number(i.total_price), 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Loading
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading || creating) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-orange-100" />
          <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-transparent border-t-[#F87116] animate-spin" />
        </div>
        <p className="text-sm text-slate-500">
          {creating ? 'Abrindo sua comanda…' : 'Carregando…'}
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Erro
  // ─────────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{error}</h2>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F87116] text-white text-sm font-semibold shadow-sm hover:bg-orange-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Comanda paga/cancelada
  // ─────────────────────────────────────────────────────────────────────────────

  if (comanda && comanda.status !== 'open') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <Receipt className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {comanda.status === 'paid' ? 'Comanda encerrada!' : 'Comanda cancelada'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {comanda.status === 'paid'
              ? 'Obrigado pela visita. Volte sempre!'
              : 'Esta comanda foi cancelada.'}
          </p>
        </div>
        <button
          onClick={handleNewComanda}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F87116] text-white text-sm font-semibold shadow-sm hover:bg-orange-600 transition-colors"
        >
          <Loader2 className="h-4 w-4" /> Abrir nova comanda
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Principal (Mobile-first)
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-28">

      {/* ── Cabeçalho do restaurante ──────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-100 px-5 py-5 flex items-center gap-4 shadow-sm">
        {restaurant?.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-12 w-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center flex-shrink-0">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">{restaurant?.name}</h1>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Comanda aberta
          </span>
        </div>
        {/* Botão para resetar a comanda */}
        <button
          onClick={handleNewComanda}
          className="ml-auto flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          title="Abrir nova comanda"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 px-5 py-6 space-y-6 max-w-md mx-auto w-full">

        {/* ── Card do código de barras ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Faixa de instrução */}
          <div className="bg-gradient-to-r from-[#F87116] to-orange-500 px-4 py-2.5 text-center">
            <p className="text-xs font-semibold text-white/90 uppercase tracking-widest">
              Apresente ao operador
            </p>
          </div>

          {/* Código de barras */}
          <div className="flex flex-col items-center px-4 py-6 gap-3">
            {comanda?.short_code ? (
              <div className="flex justify-center w-full overflow-hidden">
                <Barcode
                  value={comanda.short_code}
                  format="CODE128"
                  width={2.4}
                  height={90}
                  displayValue={false}
                  background="#ffffff"
                  lineColor="#0f172a"
                  margin={0}
                />
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {/* Short code legível por humanos */}
            <div className="text-center">
              <p className="text-3xl font-black tracking-[0.25em] text-slate-800 font-mono">
                {comanda?.short_code ?? '—'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">
                código da sua comanda
              </p>
            </div>
          </div>
        </div>

        {/* ── Extrato em tempo real ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              Extrato
            </h2>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Atualiza em tempo real
            </span>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <ShoppingBag className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">Nenhum item ainda</p>
              <p className="text-xs text-slate-400 mt-1">
                Os itens adicionados pelo operador aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  {/* Quantidade */}
                  <span className="flex-shrink-0 min-w-[2rem] text-center text-xs font-bold text-slate-500 bg-slate-100 rounded-md px-1.5 py-1 leading-tight">
                    {Number(item.quantity) % 1 === 0
                      ? `${item.quantity}×`
                      : `${Number(item.quantity).toFixed(3)}kg`}
                  </span>
                  {/* Nome + obs */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">
                      {item.product_name}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  {/* Preço */}
                  <span className="flex-shrink-0 text-sm font-semibold text-slate-700">
                    {formatCurrency(Number(item.total_price), currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          {items.length > 0 && (
            <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Total parcial</span>
              <span className="text-lg font-black text-slate-900">
                {formatCurrency(total, currency)}
              </span>
            </div>
          )}
        </div>

        {/* ── Instrução ───────────────────────────────────────────────────── */}
        <p className="text-[12px] text-center text-slate-400 leading-relaxed px-2">
          Apresente o código ao operador para adicionar itens ou fechar a conta.
          Quer adicionar itens você mesmo? Use o botão abaixo.
        </p>

      </div>

      {/* ── CTA fixo na parte inferior ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleFazerPedido}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#F87116] to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white text-base font-bold py-4 rounded-2xl shadow-md shadow-orange-200 transition-all active:scale-[0.98]"
          >
            <ShoppingBag className="h-5 w-5" />
            Fazer Pedido pelo Cardápio
          </button>
          <p className="text-center text-[11px] text-slate-400 mt-2">
            Você será direcionado ao cardápio com esta comanda já vinculada.
          </p>
        </div>
      </div>

    </div>
  );
}
