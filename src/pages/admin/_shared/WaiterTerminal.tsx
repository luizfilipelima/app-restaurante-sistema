/**
 * Terminal do Garçom — Tela operacional (Mobile-First)
 *
 * Rota isolada, sem sidebar. Para tablets e celulares.
 * Tabs: Salão (mesas) + Expedição (pedidos prontos para retirada).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { AdminRestaurantContext, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useResolveRestaurantId } from '@/hooks/admin/useResolveRestaurantId';
import { useRestaurant } from '@/hooks/queries';
import {
  useTables,
  useTableStatuses,
  useWaiterCalls,
  useHallZones,
  useWaiterHallZone,
} from '@/hooks/queries';
import { useReadyOrders } from '@/hooks/orders/useReadyOrders';
import { TableCard, TableOperationSheet } from '@/pages/admin/hall-pdv/Tables';
import { ExpoPanel } from '@/components/waiter/ExpoPanel';
import type { TableWithStatus } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/core/utils';
import { UtensilsCrossed, Package, Wifi, WifiOff, Bell } from 'lucide-react';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { ptBR, es, enUS } from 'date-fns/locale';
import { playWaiterBeep, primeWaiterAudio } from '@/lib/sounds/playWaiterBeep';

const DATE_LOCALES = { pt: ptBR, es, en: enUS } as const;

// ─── Shell com contexto de restaurante ───────────────────────────────────────

export default function WaiterTerminal() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const restaurantIdFromQuery = searchParams.get('restaurant_id');
  const { restaurantId: resolvedFromSlug, isLoading: resolving } = useResolveRestaurantId(slug ?? null);
  const restaurantId = resolvedFromSlug || restaurantIdFromQuery || null;
  const { data: restaurant } = useRestaurant(restaurantId);
  const stillResolving = !restaurantIdFromQuery && resolving;

  if (stillResolving || !restaurantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />
          <p className="text-sm font-medium">Carregando Terminal...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Restaurante não encontrado.</p>
      </div>
    );
  }

  const contextValue = {
    restaurantId,
    restaurant,
    isSuperAdminView: false,
    basePath: slug ? `/${slug}/terminal-garcom` : '/terminal-garcom',
  };

  return (
    <AdminRestaurantContext.Provider value={contextValue}>
      <WaiterTerminalContent />
    </AdminRestaurantContext.Provider>
  );
}

// ─── Conteúdo (usa AdminRestaurantContext) ────────────────────────────────────

function WaiterTerminalContent() {
  const { restaurantId, restaurant } = useAdminRestaurant();
  const currency = useAdminCurrency();
  const queryClient = useQueryClient();
  const { t, lang } = useAdminTranslation();
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;

  const { data: tablesData, refetch: refetchTables } = useTables(restaurantId);
  const { data: tableStatuses = [] } = useTableStatuses(restaurantId);
  const { data: waiterCallsData } = useWaiterCalls(restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  const { data: waiterHallZoneId } = useWaiterHallZone(restaurantId);
  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);
  const zoneTableIdsStable = useMemo(() => {
    if (!waiterHallZoneId || !tablesData) return null;
    return new Set(tablesData.filter((t) => t.hall_zone_id === waiterHallZoneId).map((t) => t.id));
  }, [waiterHallZoneId, tablesData]);
  const { orders: readyOrdersRaw, loading: readyLoading, delivering, handleDeliver } = useReadyOrders(restaurantId, {
    tableIdsForNotification: zoneTableIdsStable,
  });

  const [selectedTable, setSelectedTable] = useState<TableWithStatus | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [callNotification, setCallNotification] = useState<{ tableNumber: number } | null>(null);
  const audioPrimedRef = useRef(false);
  const tablesAndZoneRef = useRef<{ tableIdToZone: Map<string, string | null>; waiterZone: string | null }>({ tableIdToZone: new Map(), waiterZone: null });

  // Permite áudio no primeiro toque/clique (Chrome exige interação antes de tocar som)
  useEffect(() => {
    if (audioPrimedRef.current) return;
    const prime = () => {
      audioPrimedRef.current = true;
      primeWaiterAudio();
    };
    document.addEventListener('click', prime, { once: true });
    document.addEventListener('touchstart', prime, { once: true, capture: true });
    return () => {
      document.removeEventListener('click', prime);
      document.removeEventListener('touchstart', prime, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel('waiter-terminal-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` }, (payload: { eventType?: string; new?: { table_id?: string; table_number?: number }; data?: { type?: string } }) => {
        const isNewCall = (payload?.eventType ?? payload?.data?.type ?? '') === 'INSERT';
        if (isNewCall) {
          const { tableIdToZone, waiterZone } = tablesAndZoneRef.current;
          const tableId = payload?.new?.table_id;
          const tableZone = tableId ? tableIdToZone.get(tableId) : null;
          const isInMyZone = !waiterZone || tableZone === waiterZone;
          if (isInMyZone) {
            playWaiterBeep();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(1000);
            }
            setCallNotification({ tableNumber: payload?.new?.table_number ?? 0 });
          }
        }
        queryClient.refetchQueries({ queryKey: ['waiterCalls', restaurantId] });
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
        queryClient.refetchQueries({ queryKey: ['tableOrders'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => {
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
        queryClient.refetchQueries({ queryKey: ['tableOrders'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => {
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
        queryClient.refetchQueries({ queryKey: ['tableOrders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        refetchTables();
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hall_zones', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['hallZones', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_comanda_links', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tableComandaLinks'] });
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(ch);
      setIsLive(false);
    };
  }, [restaurantId, queryClient, refetchTables]);

  const tables = tablesData ?? [];
  const effectiveZoneId = waiterHallZoneId ?? selectedZoneId;

  const gridTablesAll: TableWithStatus[] = tables.map((t) => {
    const st = tableStatuses.find((s) => s.id === t.id);
    return st ?? { ...t, status: 'free' as const, itemsCount: 0, totalAmount: 0, openedAt: null, orderIds: [], hasPendingWaiterCall: false, billRequested: false };
  });

  const gridTables = effectiveZoneId
    ? gridTablesAll.filter((t) => t.hall_zone_id === effectiveZoneId)
    : gridTablesAll;

  const tableIdToZone = new Map(tables.map((t) => [t.id, t.hall_zone_id ?? null]));
  const zoneTableIds = effectiveZoneId
    ? new Set(tables.filter((t) => t.hall_zone_id === effectiveZoneId).map((t) => t.id))
    : null;

  const pendingCalls = (waiterCallsData ?? []).filter((c) => {
    if (c.status !== 'pending') return false;
    if (!zoneTableIds || !c.table_id) return true;
    return zoneTableIds.has(c.table_id);
  });

  const readyOrders = waiterHallZoneId
    ? readyOrdersRaw.filter((o) => {
        if (!o.table_id) return false;
        const tbl = o.tables as { hall_zone_id?: string | null } | undefined;
        return tbl?.hall_zone_id === waiterHallZoneId;
      })
    : readyOrdersRaw;
  const readyCount = readyOrders.length;

  tablesAndZoneRef.current = { tableIdToZone, waiterZone: waiterHallZoneId ?? null };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    if (!callNotification) return;
    const t = setTimeout(() => setCallNotification(null), 4000);
    return () => clearTimeout(t);
  }, [callNotification]);

  // Sincroniza selectedTable com dados atualizados em tempo real
  useEffect(() => {
    if (!selectedTable?.id || tableStatuses.length === 0) return;
    const fresh = tableStatuses.find((s) => s.id === selectedTable.id);
    if (fresh) setSelectedTable(fresh);
  }, [tableStatuses, selectedTable?.id]);

  const handleRefreshSheet = useCallback(() => {
    queryClient.refetchQueries({ queryKey: ['tableStatuses', restaurantId] });
    queryClient.refetchQueries({ queryKey: ['tableOrders'] });
  }, [queryClient, restaurantId]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Tabs defaultValue="salao" className="flex flex-1 flex-col">
        {/* Top bar fixa — Tabs Salão | Expedição (com badge) */}
        <header className="sticky top-0 z-10 border-b bg-white shadow-sm safe-area-inset-top">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">Terminal do Garçom</h1>
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition-all shrink-0',
                  isLive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                )}
              >
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
            </div>
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="salao" className="gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Salão
              </TabsTrigger>
              <TabsTrigger value="expedicao" className="gap-2 relative overflow-visible">
                <Package className="h-4 w-4" />
                Expedição
                {readyCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-bold',
                      'bg-red-500 text-white animate-pulse'
                    )}
                  >
                    {readyCount > 99 ? '99+' : readyCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="salao" className="mt-0 pt-3">
              {hallZones.length > 0 && !waiterHallZoneId && (
                <div className="overflow-x-auto -mx-4 px-4 scrollbar-thin">
                  <div className="flex gap-2 min-w-max pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedZoneId(null)}
                      className={cn(
                        'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                        selectedZoneId === null ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      Todas as Praças
                    </button>
                    {hallZones.map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => setSelectedZoneId(z.id)}
                        className={cn(
                          'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                          selectedZoneId === z.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                        )}
                      >
                        {z.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {waiterHallZoneId && hallZones.length > 0 && (
                <p className="text-xs text-muted-foreground py-1">
                  Zona: {hallZones.find((z) => z.id === waiterHallZoneId)?.name ?? '—'}
                </p>
              )}
            </TabsContent>
          </div>
        </header>

        {/* Conteúdo das abas */}
        <main className="flex-1 overflow-auto p-4">
          <TabsContent value="salao" className="mt-0 h-full">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {gridTables.filter((tbl) => tbl.is_active).map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  currency={currency}
                  zoneName={hallZones.find((z) => z.id === table.hall_zone_id)?.name ?? null}
                  onClick={() => setSelectedTable(table)}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
            {gridTables.filter((t) => t.is_active).length === 0 && (
              <div className="rounded-xl border border-dashed bg-white/50 p-12 text-center">
                <p className="text-muted-foreground">
                  {effectiveZoneId ? t('tablesCentral.noTablesInZone') : t('tablesCentral.noTables')}
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="expedicao" className="mt-0">
            <ExpoPanel
              orders={readyOrders}
              loading={readyLoading}
              delivering={delivering}
              onDeliver={handleDeliver}
            />
          </TabsContent>
        </main>
      </Tabs>

      {/* Modal de Operação */}
      <TableOperationSheet
        mode="operation"
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
        onAccountClosed={() => {
          setSelectedTable(null);
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
          queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        }}
        onRefresh={handleRefreshSheet}
        onTableOrZoneUpdated={() => {
          refetchTables();
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        }}
        isMobile={isMobile}
      />

      {/* Notificação central quando cliente chama o garçom */}
      {callNotification && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          role="alert"
          aria-live="assertive"
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            className="relative flex flex-col items-center gap-4 rounded-2xl bg-amber-500 px-8 py-6 shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.4)' }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400">
              <Bell className="h-8 w-8 text-amber-900 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-950">Mesa {callNotification.tableNumber || '?'}</p>
              <p className="text-amber-900 font-semibold">Chamando o garçom!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
