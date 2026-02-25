/**
 * Terminal do Garçom — Tela operacional (Mobile-First)
 *
 * Rota isolada, sem sidebar. Para tablets e celulares.
 * Tabs: Salão (mesas) + Expedição (pedidos prontos para retirada).
 */

import { useEffect, useState } from 'react';
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
} from '@/hooks/queries';
import { useReadyOrders } from '@/hooks/orders/useReadyOrders';
import { TableCard, TableOperationSheet } from '@/pages/admin/hall-pdv/Tables';
import { ExpoPanel } from '@/components/waiter/ExpoPanel';
import type { TableWithStatus } from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { useAdminCurrency } from '@/contexts/AdminRestaurantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/core/utils';
import { UtensilsCrossed, Package } from 'lucide-react';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { ptBR, es, enUS } from 'date-fns/locale';

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
  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);
  const { orders: readyOrders, loading: readyLoading, delivering, handleDeliver, count: readyCount } = useReadyOrders(restaurantId);

  const [selectedTable, setSelectedTable] = useState<TableWithStatus | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel('waiter-terminal-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` }, () => {
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, queryClient, refetchTables]);

  const tables = tablesData ?? [];
  const pendingCalls = (waiterCallsData ?? []).filter((c) => c.status === 'pending');

  const gridTablesAll: TableWithStatus[] = tables.map((t) => {
    const st = tableStatuses.find((s) => s.id === t.id);
    return st ?? { ...t, status: 'free' as const, itemsCount: 0, totalAmount: 0, openedAt: null, orderIds: [], hasPendingWaiterCall: false, billRequested: false };
  });

  const gridTables = selectedZoneId
    ? gridTablesAll.filter((t) => t.hall_zone_id === selectedZoneId)
    : gridTablesAll;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Tabs defaultValue="salao" className="flex flex-1 flex-col">
        {/* Top bar fixa — Tabs Salão | Expedição (com badge) */}
        <header className="sticky top-0 z-10 border-b bg-white shadow-sm safe-area-inset-top">
          <div className="p-4">
            <h1 className="text-lg font-bold text-slate-900 mb-3">Terminal do Garçom</h1>
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
              {hallZones.length > 0 && (
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
                  {selectedZoneId ? t('tablesCentral.noTablesInZone') : t('tablesCentral.noTables')}
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
        onTableOrZoneUpdated={() => {
          refetchTables();
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        }}
        isMobile={isMobile}
      />
    </div>
  );
}
