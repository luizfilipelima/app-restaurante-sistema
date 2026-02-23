/**
 * Central de Mesas e Praças (Backoffice / Gestão)
 *
 * Tela de configuração: zonas, mesas, QR Codes.
 * Inclui card com link para o Terminal do Garçom.
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
  DialogFooter,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Bell,
  QrCode,
  Download,
  Loader2,
  Utensils,
  Receipt,
  CheckCircle2,
  Clock,
  Settings,
  Link2,
  Unlink,
  ExternalLink,
  Copy,
  ConciergeBell,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WaiterPDV } from '@/components/waiter/WaiterPDV';
import { useCanAccess } from '@/hooks/useUserRole';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';

const DATE_LOCALES = { pt: ptBR, es, en: enUS } as const;

// ─── HallZonesConfig (CRUD Zonas) ────────────────────────────────────────────

function HallZonesConfig({ restaurantId, hallZones, t }: { restaurantId: string | null; hallZones: import('@/types').HallZone[]; t: (k: string) => string }) {
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
    if (!confirm(`${t('tablesCentral.deleteZone')} "${name}"? ${t('tablesCentral.deleteZoneConfirm')}`)) return;
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
        <h3 className="font-semibold mb-2">{t('tablesCentral.zones')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('tablesCentral.zonesDesc')}
        </p>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder={t('tablesCentral.zonePlaceholder')}
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
          <li className="text-sm text-muted-foreground py-2">{t('tablesCentral.noZones')}</li>
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
                      {t('tablesCentral.deleteZone')}
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
  const { t, lang } = useAdminTranslation();
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;
  const { data: tablesData, refetch: refetchTables } = useTables(restaurantId);
  const { data: tableStatuses = [] } = useTableStatuses(restaurantId);
  const { data: waiterCallsData } = useWaiterCalls(restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  const { data: hasBuffet } = useFeatureAccess('feature_buffet_module', restaurantId);

  const [selectedTable, setSelectedTable] = useState<TableWithStatus | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [addSingleNumber, setAddSingleNumber] = useState('');
  const [addSingleZoneId, setAddSingleZoneId] = useState<string | null>(null);
  const [addingSingle, setAddingSingle] = useState(false);
  const [addQuantity, setAddQuantity] = useState('5');
  const [addZoneId, setAddZoneId] = useState<string | null>(null);
  const [addingBulk, setAddingBulk] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, () => {
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
  const activeTables = tables.filter((t) => t.is_active);
  const inactiveTables = tables.filter((t) => !t.is_active);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
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

  const terminalUrl = restaurant?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${restaurant.slug}/terminal-garcom`
    : '';

  const [resetTableTarget, setResetTableTarget] = useState<TableWithStatus | null>(null);
  const [resettingTable, setResettingTable] = useState(false);
  const canResetTable = useCanAccess(['manager', 'restaurant_admin', 'super_admin']);

  const handleResetTable = async () => {
    if (!resetTableTarget || !restaurantId || resettingTable) return;
    setResettingTable(true);
    try {
      const orderIds = resetTableTarget.orderIds ?? [];
      if (orderIds.length > 0) {
        const { error: orderErr } = await supabase
          .from('orders')
          .update({ status: 'cancelled', table_id: null })
          .in('id', orderIds);
        if (orderErr) throw orderErr;
      }
      const { error: unlinkErr } = await supabase
        .from('table_comanda_links')
        .delete()
        .eq('table_id', resetTableTarget.id)
        .eq('restaurant_id', restaurantId);
      if (unlinkErr) throw unlinkErr;
      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['tableOrders'] });
      queryClient.invalidateQueries({ queryKey: ['tableComandaLinks'] });
      if (selectedTable?.id === resetTableTarget.id) setSelectedTable(null);
      setResetTableTarget(null);
      toast({ title: 'Mesa resetada!', description: 'A mesa voltou ao status Livre.' });
    } catch {
      toast({ title: 'Erro ao resetar mesa', variant: 'destructive' });
    } finally {
      setResettingTable(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header com barra compacta do Terminal do Garçom integrada */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('tablesCentral.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('tablesCentral.subtitle')}
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
            {t('tablesCentral.configure')}
          </Button>
          <Button
            size="lg"
            className="min-h-[48px] min-w-[48px] touch-manipulation"
            onClick={() => setShowAddTable(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('tablesCentral.addTable')}
          </Button>
        </div>
        </div>
        {/* Barra compacta Terminal do Garçom (max ~50–60px) */}
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 h-12 max-h-12">
          <ConciergeBell className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <code className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
            {terminalUrl || 'Carregando...'}
          </code>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (terminalUrl) {
                  navigator.clipboard.writeText(terminalUrl);
                  toast({ title: 'Link copiado!' });
                }
              }}
              disabled={!terminalUrl}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">{t('tablesCentral.copyLink')}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              asChild
              disabled={!terminalUrl}
            >
              <a href={terminalUrl || '#'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">{t('tablesCentral.openInNewTab')}</span>
              </a>
            </Button>
          </div>
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
              {t('tablesCentral.allZones')}
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

      {/* Grid de Mesas — 5 colunas máx. para cards maiores */}
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

      {/* Modal de confirmação: Resetar mesa */}
      <Dialog open={!!resetTableTarget} onOpenChange={(open) => !open && setResetTableTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tablesCentral.resetTable')}</DialogTitle>
            <DialogDescription>
              {t('tablesCentral.resetTableConfirm')}
            </DialogDescription>
          </DialogHeader>
          {resetTableTarget && (
            <p className="text-sm text-muted-foreground">
              {t('tablesCentral.table')} {resetTableTarget.number} — {resetTableTarget.itemsCount} {t('tablesCentral.items')} • {formatPrice(resetTableTarget.totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetTableTarget(null)} disabled={resettingTable}>
              {t('tablesCentral.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleResetTable} disabled={resettingTable}>
              {resettingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {resettingTable ? t('tablesCentral.resetting') : t('tablesCentral.yesReset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gridTables.filter((tbl) => tbl.is_active).length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            {selectedZoneId ? t('tablesCentral.noTablesInZone') : t('tablesCentral.noTables')}
          </p>
          {!selectedZoneId && (
            <Button className="mt-4" onClick={() => setShowAddTable(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('tablesCentral.addTable')}
            </Button>
          )}
        </div>
      )}

      {/* Sheet/Modal de Operação da Mesa */}
      <TableOperationSheet
        mode="management"
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
        onTableDeleted={() => {
          setSelectedTable(null);
          refetchTables();
          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
        }}
        isMobile={isMobile}
      />

      {/* Dialog Configurar Salão — Zonas + Mesas (adicionar inteligente + exclusão em lote) */}
      <Dialog open={showConfig} onOpenChange={(open) => {
          setShowConfig(open);
          if (!open) {
            setSelectedTableIds(new Set());
            setShowDeleteConfirm(false);
          }
        }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tablesCentral.configureHall')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="zonas">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="zonas">{t('tablesCentral.zonas')}</TabsTrigger>
              <TabsTrigger value="mesas">{t('tablesCentral.mesas')}</TabsTrigger>
            </TabsList>
            <TabsContent value="zonas">
              <HallZonesConfig restaurantId={restaurantId} hallZones={hallZones} t={t} />
            </TabsContent>
            <TabsContent value="mesas" className="space-y-6 mt-4">
              {/* Mesas Ocupadas — Limpar mesa (apenas admin/gerente) */}
              {canResetTable && (() => {
                const occupied = gridTablesAll.filter((t) => t.is_active && t.status !== 'free');
                if (occupied.length === 0) return null;
                return (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-amber-600" />
                      {t('tablesCentral.occupiedTables')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t('tablesCentral.clearTableDesc')}
                    </p>
                    <div className="max-h-[140px] overflow-y-auto space-y-2">
                      {occupied.map((tbl) => (
                        <div
                          key={tbl.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-white dark:bg-card px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">{t('tablesCentral.table')} {tbl.number}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {hallZones.find((z) => z.id === tbl.hall_zone_id)?.name ?? '—'} · {tbl.itemsCount} {t('tablesCentral.items')} · {formatPrice(tbl.totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            onClick={() => {
                              setResetTableTarget(tbl);
                              setShowConfig(false);
                            }}
                          >
                            {t('tablesCentral.clearTable')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Sessão Superior: Adicionar Mesas Inteligente */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Adicionar mesas</h3>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!restaurantId) return;
                    const qty = parseInt(addQuantity, 10);
                    if (isNaN(qty) || qty < 1) {
                      toast({ title: 'Quantidade inválida', variant: 'destructive' });
                      return;
                    }
                    const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) : 0;
                    const nextOrderBase = tables.length > 0 ? Math.max(0, ...tables.map((t) => t.order_index ?? 0)) : 0;
                    setAddingBulk(true);
                    try {
                      let added = 0;
                      for (let i = 0; i < qty; i++) {
                        const num = maxNum + i + 1;
                        const { error } = await supabase.from('tables').insert({
                          restaurant_id: restaurantId,
                          number: num,
                          order_index: nextOrderBase + added + 1,
                          is_active: true,
                          hall_zone_id: addZoneId || null,
                        });
                        if (!error) added++;
                      }
                      refetchTables();
                      queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                      toast({ title: `${added} mesa(s) adicionada(s)!` });
                    } catch {
                      toast({ title: 'Erro ao adicionar mesas', variant: 'destructive' });
                    } finally {
                      setAddingBulk(false);
                    }
                  }}
                >
                  <div>
                    <Label htmlFor="add_quantity">Quantidade de mesas a adicionar</Label>
                    <Input
                      id="add_quantity"
                      type="number"
                      min={1}
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(e.target.value)}
                      placeholder="Ex: 5"
                      className="min-h-[44px] mt-1"
                    />
                  </div>
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
                  <p className="text-xs text-muted-foreground">
                    O sistema cria automaticamente as próximas numerações (ex: se já existem 1, 2 e 5, adiciona 6, 7...).
                  </p>
                  <Button type="submit" disabled={addingBulk}>
                    {addingBulk ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {addingBulk ? 'Adicionando...' : 'Adicionar mesas'}
                  </Button>
                </form>
              </div>

              {/* Sessão Inferior: Lista e exclusão em lote */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Mesas cadastradas</h3>
                {activeTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma mesa cadastrada.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedTableIds.size === activeTables.length && activeTables.length > 0}
                          onCheckedChange={(c) => {
                            if (c) setSelectedTableIds(new Set(activeTables.map((t) => t.id)));
                            else setSelectedTableIds(new Set());
                          }}
                        />
                        Selecionar todas
                      </label>
                      {selectedTableIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={deletingBulk}
                        >
                          {deletingBulk ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          Desativar {selectedTableIds.size} mesa(s)
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[220px] overflow-y-auto border rounded-lg divide-y">
                      {activeTables.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTableIds.has(t.id)}
                            onCheckedChange={(c) => {
                              setSelectedTableIds((prev) => {
                                const next = new Set(prev);
                                if (c) next.add(t.id);
                                else next.delete(t.id);
                                return next;
                              });
                            }}
                          />
                          <span className="font-medium">Mesa {t.number}</span>
                          <span className="text-xs text-muted-foreground">
                            {hallZones.find((z) => z.id === t.hall_zone_id)?.name ?? 'Sem zona'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {/* Mesas inativas — visualizar e reativar */}
                {inactiveTables.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold text-sm text-muted-foreground">Mesas inativas</h3>
                    <p className="text-xs text-muted-foreground">
                      Mesas excluídas (desativadas). Reative para voltar a usá-las sem criar duplicatas.
                    </p>
                    <div className="max-h-[160px] overflow-y-auto border border-dashed rounded-lg divide-y bg-muted/20">
                      {inactiveTables.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div>
                            <span className="font-medium">Mesa {t.number}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {hallZones.find((z) => z.id === t.hall_zone_id)?.name ?? 'Sem zona'}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            disabled={reactivatingId === t.id}
                            onClick={async () => {
                              setReactivatingId(t.id);
                              try {
                                const { error } = await supabase.from('tables').update({ is_active: true }).eq('id', t.id);
                                if (error) throw error;
                                refetchTables();
                                queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                                toast({ title: `Mesa ${t.number} reativada!` });
                              } catch {
                                toast({ title: 'Erro ao reativar mesa', variant: 'destructive' });
                              } finally {
                                setReactivatingId(null);
                              }
                            }}
                          >
                            {reactivatingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            Reativar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de mesas */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar mesas selecionadas?</DialogTitle>
            <DialogDescription>
              As mesas serão desativadas (não excluídas) e sairão da lista. Os QR Codes antigos pararão de funcionar. Você pode reativar mesas inativas em Configurar → Mesas. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!restaurantId || selectedTableIds.size === 0) return;
                setDeletingBulk(true);
                try {
                  const ids = Array.from(selectedTableIds);
                  await supabase.from('table_comanda_links').delete().in('table_id', ids);
                  const { error } = await supabase.from('tables').update({ is_active: false }).in('id', ids);
                  if (error) throw error;
                  refetchTables();
                  queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                  toast({ title: `${ids.length} mesa(s) desativada(s)!` });
                  setSelectedTableIds(new Set());
                  setShowDeleteConfirm(false);
                } catch {
                  toast({ title: 'Erro ao desativar mesas', variant: 'destructive' });
                } finally {
                  setDeletingBulk(false);
                }
              }}
              disabled={deletingBulk}
            >
              {deletingBulk ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deletingBulk ? 'Desativando...' : 'Sim, desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar 1 Mesa */}
      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Mesa</DialogTitle>
            <DialogDescription>
              Cadastre uma mesa por vez. Se o número já existir como mesa inativa, ela será reativada. Para várias mesas em lote, use Configurar Salão.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!restaurantId) return;
              const num = parseInt(addSingleNumber, 10);
              if (isNaN(num) || num < 1) {
                toast({ title: 'Número da mesa inválido', variant: 'destructive' });
                return;
              }
              const existing = tables.find((t) => t.number === num);
              if (existing) {
                if (existing.is_active) {
                  toast({ title: `Mesa ${num} já existe`, variant: 'destructive' });
                  return;
                }
                setAddingSingle(true);
                try {
                  const { error } = await supabase.from('tables').update({
                    is_active: true,
                    hall_zone_id: addSingleZoneId || null,
                  }).eq('id', existing.id);
                  if (error) throw error;
                  refetchTables();
                  queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                  setShowAddTable(false);
                  setAddSingleNumber('');
                  setAddSingleZoneId(null);
                  toast({ title: `Mesa ${num} reativada!` });
                } catch {
                  toast({ title: 'Erro ao reativar mesa', variant: 'destructive' });
                } finally {
                  setAddingSingle(false);
                }
                return;
              }
              setAddingSingle(true);
              try {
                const nextOrder = Math.max(0, ...tables.map((t) => t.order_index ?? 0)) + 1;
                const { error } = await supabase.from('tables').insert({
                  restaurant_id: restaurantId,
                  number: num,
                  order_index: nextOrder,
                  is_active: true,
                  hall_zone_id: addSingleZoneId || null,
                });
                if (error) throw error;
                refetchTables();
                queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                setShowAddTable(false);
                setAddSingleNumber('');
                setAddSingleZoneId(null);
                toast({ title: 'Mesa adicionada!' });
              } catch {
                toast({ title: 'Erro ao adicionar mesa', variant: 'destructive' });
              } finally {
                setAddingSingle(false);
              }
            }}
          >
            <div>
              <Label htmlFor="add_single_number">Número da mesa</Label>
              <Input
                id="add_single_number"
                type="number"
                min={1}
                value={addSingleNumber}
                onChange={(e) => setAddSingleNumber(e.target.value)}
                placeholder="Ex: 5"
                className="min-h-[44px] mt-1"
              />
            </div>
            {hallZones.length > 0 && (
              <div>
                <Label>Zona</Label>
                <Select value={addSingleZoneId ?? 'none'} onValueChange={(v) => setAddSingleZoneId(v === 'none' ? null : v)}>
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTable(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addingSingle}>
                {addingSingle ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {addingSingle ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Cores para badges de zona (estilo Kanban: fundo claro + texto escuro)
const ZONE_BADGE_STYLES = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
];

function getZoneBadgeStyle(zoneName: string): string {
  let hash = 0;
  for (let i = 0; i < zoneName.length; i++) hash = ((hash << 5) - hash) + zoneName.charCodeAt(i);
  return ZONE_BADGE_STYLES[Math.abs(hash) % ZONE_BADGE_STYLES.length];
}

// ─── Table Card (touch-friendly) — exportado para WaiterTerminal ───────────────

function getStatusConfig(t: (k: string) => string) {
  return {
    free: {
      label: t('tablesCentral.status.free'),
      dotClass: 'bg-slate-300',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    occupied: {
      label: t('tablesCentral.status.occupied'),
      dotClass: 'bg-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    },
    calling_waiter: {
      label: t('tablesCentral.status.calling'),
      dotClass: 'bg-amber-500 animate-pulse',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    },
    awaiting_closure: {
      label: t('tablesCentral.status.awaitingClosure'),
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    },
  } as const;
}

export function TableCard({
  table,
  currency,
  zoneName,
  onClick,
  t,
  dateLocale,
}: {
  table: TableWithStatus;
  currency: string;
  zoneName?: string | null;
  onClick: () => void;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const isCalling = table.status === 'calling_waiter' || table.hasPendingWaiterCall;
  const isOccupied = table.status !== 'free';
  const cfg = getStatusConfig(t)[table.status];

  const borderColor = {
    free: 'border-slate-200 dark:border-slate-700',
    occupied: 'border-primary/60',
    calling_waiter: 'border-amber-500/80',
    awaiting_closure: 'border-red-500/60',
  }[table.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[200px] sm:min-h-[220px] w-full flex-col items-stretch rounded-xl border-2 bg-white p-4 sm:p-5 text-left shadow-sm transition-all touch-manipulation active:scale-[0.98] hover:shadow-md dark:bg-card overflow-hidden',
        borderColor
      )}
    >
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        {/* 1. Nome da mesa */}
        <div className="flex items-start justify-between gap-2 shrink-0">
          <span className="text-lg font-bold sm:text-xl break-words">{t('tablesCentral.table')} {table.number}</span>
          {isCalling && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 animate-pulse dark:bg-amber-900/40 dark:text-amber-400" aria-label="Chamando garçom">
              <Bell className="h-4 w-4" />
            </span>
          )}
        </div>

        {/* 2. Status */}
        <div className="shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide',
              cfg.badgeClass
            )}
          >
            <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dotClass)} aria-hidden />
            {cfg.label}
          </span>
        </div>

        {/* 3. Valor (quando ocupada) */}
        {isOccupied && (
          <p className="text-base font-bold text-foreground leading-tight shrink-0">
            {formatPrice(table.totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
          </p>
        )}

        {/* 4. Quantidade de itens (quando ocupada) */}
        {isOccupied && (
          <p className="text-sm text-muted-foreground shrink-0">
            {table.itemsCount > 0 ? `${table.itemsCount} ${t('tablesCentral.items')}` : ''}
            {table.orderIds.length > 1 && (
              <span className="ml-1">
                {table.itemsCount > 0 ? '•' : ''} {table.orderIds.length} {t('tablesCentral.orders')}
              </span>
            )}
          </p>
        )}

        {/* 5. Zona — nome completo (sem truncar) */}
        <div className="pt-2 mt-auto border-t border-border/50 shrink-0">
          {zoneName ? (
            <span
              className={cn(
                'inline-block text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded break-words max-w-full',
                getZoneBadgeStyle(zoneName)
              )}
            >
              {zoneName}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>

        {/* 6. Tempo (quando ocupada) */}
        {isOccupied && table.openedAt && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            {formatDistanceToNow(new Date(table.openedAt), { addSuffix: true, locale: dateLocale })}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Sheet de Operação da Mesa — exportado para WaiterTerminal ─────────────────

export function TableOperationSheet({
  mode,
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
  onTableDeleted,
  isMobile,
}: {
  mode: 'management' | 'operation';
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
  /** Chamado quando a mesa é excluída (apenas modo management). */
  onTableDeleted?: () => void;
  isMobile: boolean;
}) {
  const isManagement = mode === 'management';
  const { data: orders = [] } = useTableOrders(table?.orderIds ?? []);
  const { data: productsData = [] } = useAdminProducts(restaurantId);

  const [showPDV, setShowPDV] = useState(false);
  const [attendingCallId, setAttendingCallId] = useState<string | null>(null);
  const [requestingClosure, setRequestingClosure] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [comandaInput, setComandaInput] = useState('');
  const [updatingTableZone, setUpdatingTableZone] = useState(false);
  const [localHallZoneId, setLocalHallZoneId] = useState<string | null | undefined>(undefined);
  const [deletingTable, setDeletingTable] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const comandaInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado local com a mesa (para corrigir bug de zona não atualizar no dropdown)
  useEffect(() => {
    setLocalHallZoneId(table?.hall_zone_id ?? null);
  }, [table?.id, table?.hall_zone_id]);

  const { data: linkedComandas = [] } = useTableComandaLinks(table?.id ?? null, restaurantId);
  const linkComanda = useLinkComandaToTable(restaurantId);
  const unlinkComanda = useUnlinkComandaFromTable(restaurantId);

  const canAddOrder = !table?.billRequested;
  const totalAmount = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const allItems = orders.flatMap((o) => (o.order_items ?? []).map((i) => ({ ...i, orderId: o.id })));

  // Agrupa itens por customer_name para divisão de conta (João, Maria, Mesa Geral)
  const itemsGroupedByCustomer = (() => {
    const groups = new Map<string, { label: string; items: typeof allItems; subtotal: number }>();
    for (const item of allItems) {
      const key = (item as { customer_name?: string | null }).customer_name?.trim() || '__mesa_geral__';
      const label = key === '__mesa_geral__' ? 'Mesa Geral' : key;
      const existing = groups.get(key);
      const itemTotal = Number((item as { total_price?: number }).total_price ?? 0);
      if (existing) {
        existing.items.push(item);
        existing.subtotal += itemTotal;
      } else {
        groups.set(key, { label, items: [item], subtotal: itemTotal });
      }
    }
    return Array.from(groups.values()).sort((a, b) => (a.label === 'Mesa Geral' ? 1 : 0) - (b.label === 'Mesa Geral' ? 1 : 0) || a.label.localeCompare(b.label));
  })();

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
      setLocalHallZoneId(zoneId); // Atualiza imediatamente o dropdown
      onTableOrZoneUpdated();
      toast({ title: 'Zona atualizada!' });
    } catch {
      toast({ title: 'Erro ao atualizar zona', variant: 'destructive' });
    } finally {
      setUpdatingTableZone(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!table || !onTableDeleted || deletingTable) return;
    setDeletingTable(true);
    try {
      await supabase.from('table_comanda_links').delete().eq('table_id', table.id);
      const { error } = await supabase.from('tables').update({ is_active: false }).eq('id', table.id);
      if (error) throw error;
      setShowDeleteConfirm(false);
      onClose();
      onTableDeleted();
        toast({ title: 'Mesa desativada!' });
    } catch {
      toast({ title: 'Erro ao desativar mesa', variant: 'destructive' });
    } finally {
      setDeletingTable(false);
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

  if (showPDV && !isManagement && restaurantId) {
    return (
      <Sheet open={!!table} onOpenChange={(open) => !open && (setShowPDV(false), onClose())}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 w-full max-w-none sm:max-w-none md:max-w-2xl lg:max-w-4xl overflow-hidden"
        >
          <WaiterPDV
            table={table}
            restaurantId={restaurantId}
            currency={currency}
            products={productsData}
            onOrderPlaced={() => { setShowPDV(false); onOrderPlaced(); }}
            onBack={() => setShowPDV(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

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
            {/* Zona da Mesa (editar — apenas modo gestão) */}
            {isManagement && hallZones.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold">Zona</h3>
                <Select
                  value={localHallZoneId ?? 'none'}
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

            {/* Resumo da Conta — agrupado por pessoa (João, Maria, Mesa Geral) */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <Receipt className="h-4 w-4" />
                Resumo da Conta
              </h3>
              {allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item consumido.</p>
              ) : (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
                  {itemsGroupedByCustomer.map((group) => (
                    <div key={group.label} className="rounded-md border border-border/60 bg-background p-2.5">
                      <p className="mb-2 font-semibold text-sm text-foreground">
                        {group.label} <span className="text-muted-foreground font-normal">(Subtotal: {formatPrice(group.subtotal, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')})</span>
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((item, i) => (
                          <li key={`${item.id}-${i}`} className="flex justify-between text-sm text-muted-foreground">
                            <span>{item.product_name} x{item.quantity}</span>
                            <span className="font-medium text-foreground">
                              {formatPrice(Number(item.total_price), currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {totalAmount > 0 && (
                <p className="mt-2 text-right font-bold">
                  Total: {formatPrice(totalAmount, currency as 'BRL' | 'PYG' | 'ARS' | 'USD')}
                </p>
              )}
            </section>

            {/* Comandas Vinculadas — Central de Mesas (sempre) e Terminal (quando mesa ocupada) */}
            {hasBuffet && (isManagement || table.status !== 'free') && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Link2 className="h-4 w-4" />
                  Comandas Vinculadas
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {linkedComandas.length > 0
                    ? 'Comandas vinculadas a esta mesa. Para vincular outra, digite o número abaixo.'
                    : 'Bipar código ou digitar número da comanda física para vincular à mesa.'}
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
                          title={isManagement ? 'Desvincular comanda da mesa' : undefined}
                        >
                          <Unlink className="h-4 w-4" />
                          {isManagement && <span className="ml-1">Desvincular</span>}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Ações */}
            <div className="grid gap-3">
              {/* Responder Chamado (apenas operação) */}
              {!isManagement && pendingCallIds.length > 0 && (
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

              {/* Lançar Novo Pedido (apenas operação) — abre PDV de Bolso */}
              {!isManagement && canAddOrder && (
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-[48px] touch-manipulation"
                  onClick={() => setShowPDV(true)}
                >
                  <Utensils className="h-5 w-5 mr-2" />
                  Lançar Novo Pedido
                </Button>
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

              {/* Abrir cardápio da mesa */}
              {baseUrl && (
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-[48px] touch-manipulation"
                  asChild
                >
                  <a href={baseUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Abrir cardápio da mesa
                  </a>
                </Button>
              )}

              {/* Solicitar Fechamento (apenas operação) */}
              {!isManagement && !table.billRequested && table.orderIds.length > 0 && (
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

              {!isManagement && table.billRequested && (
                <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                  Conta solicitada. Mesa na fila do Caixa.
                </p>
              )}

              {/* Desativar Mesa — apenas Central de Mesas (modo gestão) */}
              {isManagement && onTableDeleted && (
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-[48px] touch-manipulation border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  Desativar mesa
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal confirmação: Desativar mesa */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar mesa</DialogTitle>
            <DialogDescription>
              A Mesa {table?.number} deixará de aparecer na Central de Mesas. Você pode reativá-la em Configurar → Mesas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deletingTable}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTable} disabled={deletingTable}>
              {deletingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deletingTable ? 'Desativando...' : 'Sim, desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
