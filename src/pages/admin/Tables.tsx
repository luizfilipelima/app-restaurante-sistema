/**
 * Mesas & QR Codes — Hub de Operação do Salão
 *
 * Tela otimizada para tablets e smartphones (garçom/gerente).
 * Grid de mesas com status em tempo real, modal de operação do garçom.
 */

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminRestaurant, useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import {
  useTables,
  useTableStatuses,
  useTableOrders,
  useWaiterCalls,
  useAdminProducts,
  useHallZones,
  useCreateHallZone,
  useUpdateHallZone,
  useDeleteHallZone,
  useTableComandaLinks,
  useLinkComandaToTable,
  useUnlinkComandaFromTable,
} from '@/hooks/queries';
import type { TableWithStatus } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getCardapioPublicUrl } from '@/lib/utils';
import { formatPrice } from '@/lib/priceHelper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Plus,
  Bell,
  QrCode,
  Download,
  Loader2,
  Utensils,
  Receipt,
  CheckCircle2,
  X,
  Search,
  Clock,
  Settings,
  Link2,
  Unlink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── HallZonesConfig (CRUD Zonas) ────────────────────────────────────────────

function HallZonesConfig({ restaurantId, hallZones }: { restaurantId: string | null; hallZones: import('@/types').HallZone[] }) {
  const [newZoneName, setNewZoneName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const createZone = useCreateHallZone(restaurantId);
  const updateZone = useUpdateHallZone(restaurantId);
  const deleteZone = useDeleteHallZone(restaurantId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      await createZone.mutateAsync(newZoneName.trim());
      setNewZoneName('');
      toast({ title: 'Zona criada!' });
    } catch {
      toast({ title: 'Erro ao criar zona', variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateZone.mutateAsync({ id, name: editName.trim() });
      setEditingId(null);
      setEditName('');
      toast({ title: 'Zona atualizada!' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir zona "${name}"? As mesas dessa zona ficarão sem zona.`)) return;
    try {
      await deleteZone.mutateAsync(id);
      toast({ title: 'Zona excluída!' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Zonas do Salão</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Crie setores como Varanda, Salão Principal, Piso Superior. Depois associe cada mesa a uma zona.
        </p>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder="Ex: Varanda, Salão Principal"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            className="min-h-[44px]"
          />
          <Button type="submit" disabled={!newZoneName.trim() || createZone.isPending}>
            {createZone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      </div>
      <ul className="space-y-2 max-h-[200px] overflow-y-auto">
        {hallZones.length === 0 ? (
          <li className="text-sm text-muted-foreground py-2">Nenhuma zona cadastrada.</li>
        ) : (
          hallZones.map((z) => (
            <li key={z.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              {editingId === z.id ? (
                <div className="flex flex-1 gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-h-[40px]"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => handleUpdate(z.id)} disabled={updateZone.isPending}>
                    OK
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditName(''); }}>Cancelar</Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{z.name}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(z.id); setEditName(z.name); }}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(z.id, z.name)} disabled={deleteZone.isPending}>
                      Excluir
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ─── Realtime & Data ─────────────────────────────────────────────────────────

export default function AdminTables() {
  const restaurantId = useAdminRestaurantId();
  const queryClient = useQueryClient();
  const { restaurant } = useAdminRestaurant();
  const currency = useAdminCurrency();
  const { data: tablesData, refetch: refetchTables } = useTables(restaurantId);
  const { data: tableStatuses = [] } = useTableStatuses(restaurantId);
  const { data: waiterCallsData } = useWaiterCalls(restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);

  const [selectedTable, setSelectedTable] = useState<TableWithStatus | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showAddTables, setShowAddTables] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [addFrom, setAddFrom] = useState('1');
  const [addTo, setAddTo] = useState('10');
  const [addZoneId, setAddZoneId] = useState<string | null>(null);
  const [addingBulk, setAddingBulk] = useState(false);

  // Realtime: mesas, chamados, zonas e vínculos
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel('tables-hub-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiterCalls', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        refetchTables();
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hall_zones', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_comanda_links', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tableComandaLinks'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, queryClient, refetchTables]);

  const tables = tablesData ?? [];
  const pendingCalls = (waiterCallsData ?? []).filter((c) => c.status === 'pending');

  // Merge tableStatuses with tables for grid (tableStatuses is source of truth for status)
  const gridTablesAll: TableWithStatus[] = tables.map((t) => {
    const st = tableStatuses.find((s) => s.id === t.id);
    return st ?? { ...t, status: 'free' as const, itemsCount: 0, totalAmount: 0, openedAt: null, orderIds: [], hasPendingWaiterCall: false, billRequested: false };
  });

  const gridTables = selectedZoneId
    ? gridTablesAll.filter((t) => t.hall_zone_id === selectedZoneId)
    : gridTablesAll;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Hub de Operação do Salão</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral das mesas. Toque em uma mesa para operar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="min-h-[48px] touch-manipulation"
            onClick={() => setShowConfig(true)}
          >
            <Settings className="h-5 w-5 mr-2" />
            Configurar
          </Button>
          <Button
            size="lg"
            className="min-h-[48px] min-w-[48px] touch-manipulation"
            onClick={() => setShowAddTables(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Mesas
          </Button>
        </div>
      </div>

      {/* Filtro por Zona (Pills scrolláveis) */}
      {hallZones.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
          <div className="flex gap-2 min-w-max pb-1 sm:flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedZoneId(null)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                selectedZoneId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              Todas as Zonas
            </button>
            {hallZones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setSelectedZoneId(z.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                  selectedZoneId === z.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Mesas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {gridTables.filter((t) => t.is_active).map((table) => (
          <TableCard
            key={table.id}
            table={table}
            currency={currency}
            onClick={() => setSelectedTable(table)}
          />
        ))}
      </div>

      {gridTables.filter((t) => t.is_active).length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            {selectedZoneId ? 'Nenhuma mesa nesta zona.' : 'Nenhuma mesa cadastrada.'}
          </p>
          {!selectedZoneId && (
            <Button className="mt-4" onClick={() => setShowAddTables(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Mesas
            </Button>
          )}
        </div>
      )}

      {/* Sheet/Modal de Operação da Mesa */}
      <TableOperationSheet
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        currency={currency}
        restaurant={restaurant}
        hallZones={hallZones}
        hasBuffet={!!hasBuffet}
        restaurantId={restaurantId}
        pendingCallIds={pendingCalls.filter((c) => c.table_id === selectedTable?.id).map((c) => c.id)}
        onCallAttended={() => {
          queryClient.invalidateQueries({ queryKey: ['waiterCalls', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        }}
        onOrderPlaced={() => {
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
        }}
        onClosureRequested={() => {
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
        }}
        onTableOrZoneUpdated={() => {
          refetchTables();
          queryClient.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        }}
        isMobile={isMobile}
      />

      {/* Dialog Configurar (Zonas do Salão) */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Salão</DialogTitle>
          </DialogHeader>
          <HallZonesConfig restaurantId={restaurantId} hallZones={hallZones} />
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar Mesas em Lote */}
      <Dialog open={showAddTables} onOpenChange={setShowAddTables}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Mesas em Lote</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!restaurantId) return;
              const from = parseInt(addFrom, 10);
              const to = parseInt(addTo, 10);
              if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
                toast({ title: 'Intervalo inválido', variant: 'destructive' });
                return;
              }
              setAddingBulk(true);
              try {
                const existing = new Set(tables.map((t) => t.number));
                let added = 0;
                for (let n = from; n <= to; n++) {
                  if (existing.has(n)) continue;
                  const nextOrder = tables.length + added;
                  const { error } = await supabase.from('tables').insert({
                    restaurant_id: restaurantId,
                    number: n,
                    order_index: nextOrder,
                    is_active: true,
                    hall_zone_id: addZoneId || null,
                  });
                  if (!error) added++;
                  existing.add(n);
                }
                refetchTables();
                queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                setShowAddTables(false);
                toast({ title: `${added} mesa(s) adicionada(s)!` });
              } catch (err) {
                toast({ title: 'Erro ao adicionar mesas', variant: 'destructive' });
              } finally {
                setAddingBulk(false);
              }
            }}
          >
            {hallZones.length > 0 && (
              <div>
                <Label>Zona das mesas</Label>
                <Select value={addZoneId ?? 'none'} onValueChange={(v) => setAddZoneId(v === 'none' ? null : v)}>
                  <SelectTrigger className="min-h-[44px] mt-1">
                    <SelectValue placeholder="Nenhuma (sem zona)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (sem zona)</SelectItem>
                    {hallZones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="add_from">De</Label>
                <Input
                  id="add_from"
                  type="number"
                  min={1}
                  value={addFrom}
                  onChange={(e) => setAddFrom(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="add_to">Até</Label>
                <Input
                  id="add_to"
                  type="number"
                  min={1}
                  value={addTo}
                  onChange={(e) => setAddTo(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: de 1 até 20 criará as mesas 1, 2, 3... 20 (mesas já existentes serão ignoradas).
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTables(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addingBulk}>
                {addingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {addingBulk ? ' Adicionando...' : ' Adicionar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Table Card (touch-friendly) ──────────────────────────────────────────────

function TableCard({
  table,
  currency,
  onClick,
}: {
  table: TableWithStatus;
  currency: string;
  onClick: () => void;
}) {
  const isCalling = table.status === 'calling_waiter';
  const statusClasses = {
    free: 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20',
    occupied: 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20',
    calling_waiter: 'border-amber-500 bg-amber-100 dark:bg-amber-950/40',
    awaiting_closure: 'border-red-500 bg-red-50 dark:bg-red-950/20',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[100px] sm:min-h-[120px] flex-col items-start justify-between rounded-xl border-2 p-4 text-left transition-all touch-manipulation active:scale-[0.98]',
        statusClasses[table.status],
        isCalling && 'animate-pulse'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xl font-bold sm:text-2xl">Mesa {table.number}</span>
        {isCalling && <Bell className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />}
      </div>
      {table.status !== 'free' && (
        <div className="w-full space-y-1 text-sm">
          {table.itemsCount > 0 && (
            <p className="text-muted-foreground">{table.itemsCount} itens</p>
          )}
          {table.totalAmount > 0 && (
            <p className="font-semibold">{formatPrice(table.totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}</p>
          )}
          {table.openedAt && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(table.openedAt), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Sheet de Operação da Mesa ───────────────────────────────────────────────

function TableOperationSheet({
  table,
  onClose,
  currency,
  restaurant,
  hallZones,
  hasBuffet,
  restaurantId,
  pendingCallIds,
  onCallAttended,
  onOrderPlaced,
  onClosureRequested,
  onTableOrZoneUpdated,
  isMobile,
}: {
  table: TableWithStatus | null;
  onClose: () => void;
  currency: string;
  restaurant: { slug?: string } | null;
  hallZones: import('@/types').HallZone[];
  hasBuffet: boolean;
  restaurantId: string | null;
  pendingCallIds: string[];
  onCallAttended: () => void;
  onOrderPlaced: () => void;
  onClosureRequested: () => void;
  onTableOrZoneUpdated: () => void;
  isMobile: boolean;
}) {
  const { data: orders = [] } = useTableOrders(table?.orderIds ?? []);
  const { data: productsData = [] } = useAdminProducts(restaurantId);

  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [attendingCallId, setAttendingCallId] = useState<string | null>(null);
  const [requestingClosure, setRequestingClosure] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [comandaInput, setComandaInput] = useState('');
  const [updatingTableZone, setUpdatingTableZone] = useState(false);
  const comandaInputRef = useRef<HTMLInputElement>(null);

  const { data: linkedComandas = [] } = useTableComandaLinks(table?.id ?? null, restaurantId);
  const linkComanda = useLinkComandaToTable(restaurantId);
  const unlinkComanda = useUnlinkComandaFromTable(restaurantId);

  const filteredProducts = productSearch.trim()
    ? productsData.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.category || '').toLowerCase().includes(productSearch.toLowerCase())
      )
    : productsData;

  const canAddOrder = !table?.billRequested;
  const totalAmount = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const allItems = orders.flatMap((o) => (o.order_items ?? []).map((i) => ({ ...i, orderId: o.id })));

  const handlePlaceOrder = async (product: import('@/types').Product) => {
    if (!table || !restaurantId || placingOrder || !canAddOrder) return;
    const price = product.price_sale ?? product.price;
    const qty = 1;
    const itemTotal = price * qty;
    setPlacingOrder(true);
    try {
      const { data, error } = await supabase.rpc('place_order', {
        p_order: {
          restaurant_id: restaurantId,
          customer_name: `Mesa ${table.number}`,
          customer_phone: '5511999999999',
          delivery_type: 'pickup',
          delivery_fee: 0,
          subtotal: itemTotal,
          total: itemTotal,
          payment_method: 'table',
          order_source: 'table',
          table_id: table.id,
          status: 'pending',
          notes: null,
          is_paid: false,
          loyalty_redeemed: false,
          discount_coupon_id: null,
          discount_amount: 0,
        },
        p_items: [
          {
            product_id: product.id,
            product_name: product.name,
            quantity: qty,
            unit_price: price,
            total_price: itemTotal,
            observations: null,
            pizza_size: null,
            pizza_flavors: null,
            pizza_dough: null,
            pizza_edge: null,
            is_upsell: false,
            addons: null,
          },
        ],
      });
      if (error) throw error;
      if (data && !(data as { ok?: boolean }).ok) throw new Error((data as { error?: string }).error);
      setShowProductSearch(false);
      setProductSearch('');
      onOrderPlaced();
      toast({ title: `${product.name} adicionado à mesa!` });
    } catch (e) {
      toast({ title: 'Erro ao adicionar pedido', variant: 'destructive' });
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleMarkCallAttended = async (callId: string) => {
    try {
      setAttendingCallId(callId);
      const { error } = await supabase
        .from('waiter_calls')
        .update({ status: 'attended', attended_at: new Date().toISOString() })
        .eq('id', callId);
      if (error) throw error;
      onCallAttended();
      toast({ title: 'Chamado atendido!' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    } finally {
      setAttendingCallId(null);
    }
  };

  const handleRequestClosure = async () => {
    if (!table || table.orderIds.length === 0 || requestingClosure) return;
    setRequestingClosure(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ bill_requested: true })
        .in('id', table.orderIds);
      if (error) throw error;
      onClosureRequested();
      toast({ title: 'Conta solicitada. Mesa pronta para o Caixa.' });
    } catch {
      toast({ title: 'Erro ao solicitar conta', variant: 'destructive' });
    } finally {
      setRequestingClosure(false);
    }
  };

  const handleLinkComanda = async () => {
    const num = parseInt(comandaInput.replace(/\D/g, ''), 10);
    if (!table || !restaurantId || isNaN(num)) {
      toast({ title: 'Digite ou escaneie o número da comanda', variant: 'destructive' });
      return;
    }
    try {
      const { data: comandas } = await supabase
        .from('comandas')
        .select('id, number')
        .eq('restaurant_id', restaurantId)
        .eq('number', num)
        .eq('status', 'open')
        .limit(1);
      const comanda = comandas?.[0];
      if (!comanda) {
        toast({ title: `Comanda ${num} não encontrada ou já fechada`, variant: 'destructive' });
        return;
      }
      const alreadyLinked = linkedComandas.some((l) => l.comanda_id === comanda.id);
      if (alreadyLinked) {
        toast({ title: 'Comanda já vinculada a esta mesa', variant: 'destructive' });
        return;
      }
      await linkComanda.mutateAsync({ tableId: table.id, comandaId: comanda.id });
      setComandaInput('');
      toast({ title: `Comanda ${num} vinculada!` });
      comandaInputRef.current?.focus();
    } catch (e: any) {
      if (e?.code === '23505') {
        toast({ title: 'Comanda já vinculada a outra mesa', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao vincular', variant: 'destructive' });
      }
    }
  };

  const handleUnlinkComanda = async (linkId: string) => {
    if (!table) return;
    try {
      await unlinkComanda.mutateAsync({ tableId: table.id, linkId });
      toast({ title: 'Comanda desvinculada' });
    } catch {
      toast({ title: 'Erro ao desvincular', variant: 'destructive' });
    }
  };

  const handleUpdateTableZone = async (zoneId: string | null) => {
    if (!table) return;
    setUpdatingTableZone(true);
    try {
      const { error } = await supabase.from('tables').update({ hall_zone_id: zoneId }).eq('id', table.id);
      if (error) throw error;
      onTableOrZoneUpdated();
      toast({ title: 'Zona atualizada!' });
    } catch {
      toast({ title: 'Erro ao atualizar zona', variant: 'destructive' });
    } finally {
      setUpdatingTableZone(false);
    }
  };

  const downloadTableQRCode = async () => {
    if (!table || !qrCodeRef.current || !restaurant?.slug) return;
    setDownloadingQr(true);
    try {
      const svgEl = qrCodeRef.current.querySelector('svg');
      if (!svgEl) throw new Error('SVG não encontrado');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Contexto não disponível');
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = svgUrl;
      });
      const pad = 40;
      const size = Math.max(img.width, img.height) + pad * 2;
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, pad, pad, img.width, img.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qrcode-mesa-${String(table.number).padStart(2, '0')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(svgUrl);
        toast({ title: 'QR Code baixado!' });
      }, 'image/png');
    } catch {
      toast({ title: 'Erro ao baixar', variant: 'destructive' });
    } finally {
      setDownloadingQr(false);
    }
  };

  if (!table) return null;

  const baseUrl = restaurant?.slug
    ? getCardapioPublicUrl(restaurant.slug).replace(/\/$/, '') + `/cardapio/${table.number}`
    : '';

  return (
    <>
      <Sheet open={!!table} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'flex flex-col overflow-y-auto',
            isMobile && 'h-[85vh] max-h-[85vh] rounded-t-2xl'
          )}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Mesa {table.number}
              {table.hasPendingWaiterCall && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  <Bell className="h-3 w-3" />
                  Chamando
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex flex-1 flex-col gap-6">
            {/* Zona da Mesa (editar) */}
            {hallZones.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold">Zona</h3>
                <Select
                  value={table.hall_zone_id ?? 'none'}
                  onValueChange={(v) => handleUpdateTableZone(v === 'none' ? null : v)}
                  disabled={updatingTableZone}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Sem zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem zona</SelectItem>
                    {hallZones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            )}

            {/* Resumo da Conta */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <Receipt className="h-4 w-4" />
                Resumo da Conta
              </h3>
              {allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item consumido.</p>
              ) : (
                <ul className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  {allItems.map((item, i) => (
                    <li key={`${item.id}-${i}`} className="flex justify-between text-sm">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span className="font-medium">
                        {formatPrice(Number(item.total_price), currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {totalAmount > 0 && (
                <p className="mt-2 text-right font-bold">
                  Subtotal: {formatPrice(totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                </p>
              )}
            </section>

            {/* Comandas Vinculadas (quando buffet + mesa ocupada) */}
            {hasBuffet && (table.status !== 'free') && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Link2 className="h-4 w-4" />
                  Comandas Vinculadas
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Bipar código ou digitar número da comanda física para vincular à mesa.
                </p>
                <div className="flex gap-2">
                  <Input
                    ref={comandaInputRef}
                    placeholder="Nº comanda"
                    value={comandaInput}
                    onChange={(e) => setComandaInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLinkComanda())}
                    className="min-h-[44px]"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <Button
                    onClick={handleLinkComanda}
                    disabled={!comandaInput.trim() || linkComanda.isPending}
                    className="min-h-[44px]"
                  >
                    {linkComanda.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                </div>
                {linkedComandas.length > 0 && (
                  <ul className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                    {linkedComandas.map((l) => (
                      <li key={l.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">Comanda {l.comandas?.number ?? '?'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-8"
                          onClick={() => handleUnlinkComanda(l.id)}
                          disabled={unlinkComanda.isPending}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Ações */}
            <div className="grid gap-3">
              {/* Responder Chamado */}
              {pendingCallIds.length > 0 && (
                <Button
                  size="lg"
                  className="min-h-[48px] bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleMarkCallAttended(pendingCallIds[0])}
                  disabled={attendingCallId !== null}
                >
                  {attendingCallId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  Marcar chamado como atendido
                </Button>
              )}

              {/* Lançar Novo Pedido */}
              {canAddOrder && (
                <>
                  {!showProductSearch ? (
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-h-[48px] touch-manipulation"
                      onClick={() => setShowProductSearch(true)}
                    >
                      <Utensils className="h-5 w-5 mr-2" />
                      Lançar Novo Pedido
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar produto..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-9 min-h-[44px]"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => { setShowProductSearch(false); setProductSearch(''); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {filteredProducts.slice(0, 20).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => handlePlaceOrder(p)}
                            disabled={placingOrder}
                          >
                            <span>{p.name}</span>
                            <span className="font-medium">
                              {formatPrice(p.price_sale ?? p.price, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                            </span>
                          </button>
                        ))}
                        {filteredProducts.length === 0 && productSearch && (
                          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Gerar QR Code */}
              <Button
                size="lg"
                variant="outline"
                className="min-h-[48px] touch-manipulation"
                onClick={() => setQrModalOpen(true)}
              >
                <QrCode className="h-5 w-5 mr-2" />
                Exibir QR Code da Mesa
              </Button>

              {/* Solicitar Fechamento */}
              {!table.billRequested && table.orderIds.length > 0 && (
                <Button
                  size="lg"
                  variant="destructive"
                  className="min-h-[48px] touch-manipulation"
                  onClick={handleRequestClosure}
                  disabled={requestingClosure}
                >
                  {requestingClosure ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Receipt className="h-5 w-5 mr-2" />
                  )}
                  Pedir a Conta
                </Button>
              )}

              {table.billRequested && (
                <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                  Conta solicitada. Mesa na fila do Caixa.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal QR Code */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — Mesa {table.number}</DialogTitle>
          </DialogHeader>
          {baseUrl && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div ref={qrCodeRef} className="rounded-lg border-2 border-slate-200 bg-white p-4">
                <QRCodeSVG value={baseUrl} size={200} level="H" includeMargin fgColor="#000" bgColor="#fff" />
              </div>
              <p className="text-xs text-muted-foreground">Cardápio da Mesa {table.number}</p>
              <Button onClick={downloadTableQRCode} disabled={downloadingQr} className="w-full min-h-[44px]">
                {downloadingQr ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar QR Code (PNG)
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
