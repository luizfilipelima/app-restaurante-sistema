/**
 * VirtualComanda — Interface pública (Mobile-first)
 * Fluxo: cliente escaneia QR → comanda criada → vê barcode + cardápio.
 *
 * Abas (Minha Comanda primeiro):
 *  • "Minha Comanda" — barcode, extrato, nome do cliente, campo para salvar nome
 *  • "Cardápio"     — produtos com carrinho de confirmação antes de enviar
 *
 * Regras: cliente não pode abrir nova comanda (evita duplicação).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Barcode from 'react-barcode';
import { supabase } from '@/lib/supabase';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import {
  ShoppingBag,
  AlertCircle,
  Loader2,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Plus,
  Minus,
  Search,
  X,
  Check,
  User,
  Save,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
  currency: string | null;
}

interface VirtualComandaData {
  id: string;
  short_code: string;
  status: 'open' | 'paid' | 'cancelled';
  total_amount: number;
  restaurant_id: string;
  customer_name: string | null;
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

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
}

interface CartItem {
  product: MenuItem;
  quantity: number;
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────

const storageKey = (slug: string) => `vc_comanda_${slug}`;

interface StoredComanda {
  comanda_id: string;
  short_code: string;
  restaurant_id: string;
  created_at: string;
}

type ActiveTab = 'menu' | 'comanda';

// ─── Carrinho de confirmação (Drawer) ─────────────────────────────────────────

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  currency: CurrencyCode;
  onConfirm: () => void;
  onClose: () => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  confirming: boolean;
}

function CartDrawer({
  open,
  items,
  currency,
  onConfirm,
  onClose,
  onUpdateQty,
  onRemove,
  confirming,
}: CartDrawerProps) {
  const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  if (!open || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Drawer */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#F87116]" />
            Confirmar pedido ({count} {count === 1 ? 'item' : 'itens'})
          </h3>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(product.price, currency)} × {quantity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => (quantity === 1 ? onRemove(product.id) : onUpdateQty(product.id, -1))}
                  className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                >
                  {quantity === 1 ? <X className="h-4 w-4" /> : <Minus className="h-3 w-3" />}
                </button>
                <span className="text-sm font-bold text-slate-800 w-6 text-center">{quantity}</span>
                <button
                  onClick={() => onUpdateQty(product.id, 1)}
                  className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 font-medium">Total</span>
            <span className="text-lg font-black text-slate-900">{formatCurrency(total, currency)}</span>
          </div>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#F87116] hover:bg-orange-600 text-white font-bold text-base disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5" />
                Confirmar pedido
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Aba Cardápio (com carrinho) ──────────────────────────────────────────────

interface MenuTabProps {
  restaurantId: string;
  currency: CurrencyCode;
  comanda: VirtualComandaData | null;
  onItemAdded: () => Promise<void>;
}

function MenuTab({ restaurantId, currency, comanda, onItemAdded }: MenuTabProps) {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, description, price, image_url, category')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        setProducts((data as MenuItem[]) ?? []);
        setLoading(false);
      });
  }, [restaurantId]);

  const getQty = (id: string) => qtys[id] ?? 1;
  const setQty = (id: string, val: number) =>
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, val) }));

  const addToCart = (product: MenuItem) => {
    const qty = getQty(product.id);
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setQtys((prev) => ({ ...prev, [product.id]: 1 }));
    setCartOpen(true);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((i) => i.product.id !== productId);
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const confirmOrder = async () => {
    if (!comanda || comanda.status !== 'open' || cart.length === 0) return;
    setConfirming(true);
    setSubmitError(null);
    try {
      const inserts = cart.flatMap(({ product, quantity }) => ({
        comanda_id: comanda.id,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: product.price,
      }));
      const { error: insertErr } = await supabase.from('virtual_comanda_items').insert(inserts);
      if (insertErr) {
        setSubmitError(`Não foi possível confirmar o pedido: ${insertErr.message}`);
        return;
      }

      // Sincroniza a comanda com a tela de Pedidos (orders + order_items).
      // Isso garante que o restaurante veja o pedido imediatamente no Kanban.
      const { error: syncErr } = await supabase.rpc('sync_virtual_comanda_to_order', {
        p_comanda_id: comanda.id,
      });
      if (syncErr) {
        setSubmitError(`Pedido salvo na comanda, mas falhou ao enviar ao restaurante: ${syncErr.message}`);
        return;
      }

      setCart([]);
      setCartOpen(false); // fecha o carrinho após confirmar
      await onItemAdded(); // recarrega extrato e abre aba "Minha Comanda"
    } finally {
      setConfirming(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered.reduce<Record<string, MenuItem[]>>((acc, p) => {
    const cat = p.category ?? 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#F87116]" />
        <p className="text-sm text-slate-500">Carregando cardápio…</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
        <UtensilsCrossed className="h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-500">Nenhum produto disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-10 bg-slate-50 px-4 pt-3 pb-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar no cardápio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 focus:border-[#F87116]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-400">Nenhum resultado para "{search}"</p>
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat}>
            <div className="px-4 pt-5 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                {cat}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {grouped[cat].map((product) => {
                const qty = getQty(product.id);
                const inCart = cart.find((i) => i.product.id === product.id);

                return (
                  <div
                    key={product.id}
                    className="flex items-start gap-3 px-4 py-3.5 bg-white"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-16 w-16 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed className="h-6 w-6 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                      <p className="text-sm font-bold text-[#F87116] mt-1.5">
                        {formatCurrency(product.price, currency)}
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                          <button
                            onClick={() => setQty(product.id, qty - 1)}
                            className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-l-lg"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-700 w-6 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => setQty(product.id, qty + 1)}
                            className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-r-lg"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={!comanda || comanda.status !== 'open'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F87116] hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3 w-3" />
                          {inCart ? `Adicionar (${inCart.quantity} no carrinho)` : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <CartDrawer
        open={cartOpen}
        items={cart}
        currency={currency}
        onConfirm={confirmOrder}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        confirming={confirming}
      />

      {submitError && (
        <div className="fixed bottom-20 left-4 right-4 z-40 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700">{submitError}</p>
        </div>
      )}

      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 flex items-center justify-between bg-[#F87116] hover:bg-orange-600 text-white rounded-xl px-4 py-3 shadow-lg z-40"
        >
          <span className="text-sm font-bold">
            {cart.reduce((s, i) => s + i.quantity, 0)} itens no carrinho
          </span>
          <span className="text-sm font-black">
            {formatCurrency(
              cart.reduce((s, i) => s + i.product.price * i.quantity, 0),
              currency
            )}
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Aba Minha Comanda ────────────────────────────────────────────────────────

interface ComandaTabProps {
  comanda: VirtualComandaData | null;
  items: ComandaItem[];
  currency: CurrencyCode;
  onSaveCustomerName: (name: string) => Promise<boolean>;
}

function ComandaTab({ comanda, items, currency, onSaveCustomerName }: ComandaTabProps) {
  const [customerName, setCustomerName] = useState(comanda?.customer_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName(comanda?.customer_name ?? '');
  }, [comanda?.customer_name]);

  const normalizedCurrent = customerName.trim();
  const normalizedSaved = (comanda?.customer_name ?? '').trim();
  const isDirty = normalizedCurrent !== normalizedSaved;

  const handleSaveName = async () => {
    if (!normalizedCurrent || !isDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await onSaveCustomerName(normalizedCurrent);
      if (!ok) {
        setSaveError('Não foi possível salvar o nome agora. Tente novamente.');
      }
    } catch {
      setSaveError('Não foi possível salvar o nome agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const total = items.reduce((sum, i) => sum + Number(i.total_price), 0);

  return (
    <div className="pb-10 space-y-5 px-4 py-4">
      {/* Card do código de barras */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#F87116] to-orange-500 px-4 py-2.5 text-center">
          <p className="text-xs font-semibold text-white/90 uppercase tracking-widest">
            Apresente ao operador ou caixa
          </p>
        </div>

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

          <div className="text-center">
            <p className="text-3xl font-black tracking-[0.25em] text-slate-800 font-mono">
              {comanda?.short_code ?? '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">
              código da sua comanda
            </p>
          </div>
        </div>

        {/* Campo nome do cliente */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            <User className="h-3.5 w-3.5 inline mr-1" />
            Seu nome (aparece no pedido do restaurante)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Maria Silva"
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/30 focus:border-[#F87116]"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || !normalizedCurrent || !isDirty}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                !isDirty && !!normalizedCurrent
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#F87116] hover:bg-orange-600 text-white disabled:opacity-50'
              }`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : !isDirty && !!normalizedCurrent ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {!isDirty && !!normalizedCurrent ? 'Salvo' : 'Salvar'}
            </button>
          </div>
          {saveError && <p className="text-[11px] text-red-600 mt-1.5">{saveError}</p>}
          <p className="text-[11px] text-slate-400 mt-1.5">
            Em caso de bug, pedidos podem ser vinculados ao seu nome e aparecerão na tela de pedidos com a tag "Comanda".
          </p>
        </div>
      </div>

      {/* Extrato */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-400" />
            Extrato
          </h2>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Tempo real
          </span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ShoppingBag className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">Nenhum item ainda</p>
            <p className="text-xs text-slate-400 mt-1">
              Adicione itens pelo Cardápio — eles aparecerão aqui após confirmar.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0 min-w-[2rem] text-center text-xs font-bold text-slate-500 bg-slate-100 rounded-md px-1.5 py-1 leading-tight">
                    {Number(item.quantity) % 1 === 0
                      ? `${item.quantity}×`
                      : `${Number(item.quantity).toFixed(3)}kg`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">
                      {item.product_name}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-slate-700">
                    {formatCurrency(Number(item.total_price), currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Total parcial</span>
              <span className="text-lg font-black text-slate-900">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </>
        )}
      </div>

      <p className="text-[12px] text-center text-slate-400 leading-relaxed px-2">
        Apresente o código ao caixa para fechar a conta.
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VirtualComanda() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [comanda, setComanda] = useState<VirtualComandaData | null>(null);
  const [items, setItems] = useState<ComandaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('comanda');
  const [newItemPulse, setNewItemPulse] = useState(false);

  const comandaIdRef = useRef<string | null>(null);

  const loadItems = useCallback(async (comandaId: string) => {
    const { data } = await supabase
      .from('virtual_comanda_items')
      .select('id, product_name, quantity, unit_price, total_price, notes, created_at')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: true });
    setItems((data as ComandaItem[]) ?? []);
  }, []);

  const createComanda = useCallback(async (rest: Restaurant) => {
    setCreating(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('open_virtual_comanda', {
        p_restaurant_id: rest.id,
        p_table_number: null,
        p_customer_name: null,
      });

      if (rpcErr) {
        setError(
          rpcErr.message?.includes('Plano')
            ? 'Este restaurante ainda não ativou as Comandas Digitais.'
            : `Não foi possível abrir a comanda: ${rpcErr.message}`
        );
        return;
      }

      const newComanda: VirtualComandaData = {
        id: data.comanda_id,
        short_code: data.short_code,
        status: 'open',
        total_amount: 0,
        restaurant_id: rest.id,
        customer_name: null,
      };

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
  }, [restaurantSlug]);

  const resolveComanda = useCallback(async (rest: Restaurant) => {
    const key = storageKey(restaurantSlug!);
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed: StoredComanda = JSON.parse(stored);
        const { data: existing } = await supabase
          .from('virtual_comandas')
          .select('id, short_code, status, total_amount, restaurant_id, customer_name')
          .eq('id', parsed.comanda_id)
          .eq('restaurant_id', rest.id)
          .single();

        if (existing && existing.status === 'open') {
          setComanda(existing as VirtualComandaData);
          comandaIdRef.current = existing.id;
          await loadItems(existing.id);
          return;
        }
      } catch {
        /* */
      }
      localStorage.removeItem(key);
    }

    await createComanda(rest);
  }, [restaurantSlug, loadItems, createComanda]);

  useEffect(() => {
    if (!restaurantSlug) return;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
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
        await resolveComanda(rest);
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [restaurantSlug, resolveComanda]);

  useEffect(() => {
    if (!comanda?.id) return;
    const channel = supabase
      .channel(`vc-items-${comanda.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'virtual_comanda_items', filter: `comanda_id=eq.${comanda.id}` },
        () => {
          if (comandaIdRef.current) loadItems(comandaIdRef.current);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'virtual_comandas', filter: `id=eq.${comanda.id}` },
        (payload) => {
          const updated = payload.new as VirtualComandaData;
          setComanda((prev) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status !== 'open') {
            localStorage.removeItem(storageKey(restaurantSlug!));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [comanda?.id, restaurantSlug, loadItems]);

  const handleItemAdded = useCallback(async () => {
    if (comandaIdRef.current) {
      await loadItems(comandaIdRef.current);
    }
    setNewItemPulse(true);
    setTimeout(() => setNewItemPulse(false), 1500);
    setActiveTab('comanda');
  }, [loadItems]);

  const handleSaveCustomerName = useCallback(async (name: string) => {
    if (!comanda?.id) return false;
    const { data, error } = await supabase.rpc('update_virtual_comanda_customer_name', {
      p_comanda_id: comanda.id,
      p_customer_name: name,
    });
    if (error) {
      return false;
    }
    if (data) {
      setComanda((prev) => (prev ? { ...prev, customer_name: name } : prev));
      return true;
    }
    return false;
  }, [comanda?.id]);

  const currency = (restaurant?.currency ?? 'BRL') as CurrencyCode;

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

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{error}</h2>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F87116] text-white text-sm font-semibold"
        >
          <Loader2 className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

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
            {comanda.status === 'paid' ? 'Obrigado pela visita. Volte sempre!' : 'Esta comanda foi cancelada.'}
          </p>
        </div>
        <p className="text-xs text-slate-400">Para uma nova visita, escaneie o QR Code novamente.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        {restaurant?.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-10 w-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center flex-shrink-0">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-slate-900 truncate">{restaurant?.name}</h1>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Comanda aberta
          </span>
        </div>
        {comanda?.short_code && (
          <span
            className="flex-shrink-0 font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg cursor-pointer"
            onClick={() => setActiveTab('comanda')}
            title="Ver código de barras"
          >
            {comanda.short_code}
          </span>
        )}
      </header>

      {/* Tab bar — Minha Comanda primeiro */}
      <div className="sticky top-[61px] z-10 bg-white border-b border-slate-100 flex">
        <button
          onClick={() => setActiveTab('comanda')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors relative ${
            activeTab === 'comanda'
              ? 'border-[#F87116] text-[#F87116]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt className="h-4 w-4" />
          Minha Comanda
          {items.length > 0 && (
            <span
              className={`absolute top-2 right-6 h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
                newItemPulse ? 'bg-emerald-500 scale-125' : 'bg-[#F87116]'
              } text-white transition-all`}
            >
              {items.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'menu'
              ? 'border-[#F87116] text-[#F87116]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Cardápio
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'comanda' && (
          <ComandaTab
            comanda={comanda}
            items={items}
            currency={currency}
            onSaveCustomerName={handleSaveCustomerName}
          />
        )}
        {activeTab === 'menu' && restaurant && (
          <MenuTab
            restaurantId={restaurant.id}
            currency={currency}
            comanda={comanda}
            onItemAdded={handleItemAdded}
          />
        )}
      </div>

      {activeTab === 'menu' && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => setActiveTab('comanda')}
            className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <span className="text-sm font-black text-amber-400">
              {formatCurrency(items.reduce((s, i) => s + Number(i.total_price), 0), currency)}
            </span>
          </button>
        </div>
      )}

      {activeTab === 'menu' && items.length === 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 border-t border-slate-100 px-4 py-3">
          <p className="text-center text-xs text-slate-400">
            Adicione itens ao carrinho e confirme o pedido. Acompanhe na aba{' '}
            <button onClick={() => setActiveTab('comanda')} className="text-[#F87116] font-semibold">
              Minha Comanda
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
