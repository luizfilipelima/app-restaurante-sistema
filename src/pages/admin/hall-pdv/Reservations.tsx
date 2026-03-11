/**
 * Página de Reservas — Gestão de reservas via comanda digital
 *
 * Lista reservas, cria novas (com mesa + comanda com código de barras).
 * Integrado com Mesas e Caixa. Tag "Reserva" em mesas e no /cashier.
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { useAdminRestaurantId, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import {
  useReservations,
  useCreateReservation,
  useCancelReservation,
  useUpdateReservationTable,
  useTables,
  useHallZones,
  useWaitingQueue,
  useAddToWaitingQueue,
  useNotifyQueueItem,
  useTableStatuses,
  useResetTable,
  type ReservationWithDetails,
} from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { AdminPageHeader, AdminPageLayout } from '@/components/admin/_shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/shared/use-toast';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CalendarClock, Loader2, X, User, MapPin, Users, MessageCircle, Link2, RotateCcw, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { useCanAccess } from '@/hooks/auth/useUserRole';
import { PhoneCountryInput } from '@/components/ui/PhoneCountryInput';
import { generateWhatsAppLink, ensurePhoneForWhatsApp, normalizePhoneWithCountryCode, getCardapioPublicUrl } from '@/lib/core/utils';

const DATE_LOCALES = { pt: ptBR, es, en: enUS } as const;

const STATUS_KEY_MAP: Record<string, string> = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  activated: 'statusActivated',
  cancelled: 'statusCancelled',
  completed: 'statusCompleted',
  no_show: 'statusCancelled', // fallback
};

function ReservationsContent() {
  const restaurantId = useAdminRestaurantId();
  const { restaurant } = useAdminRestaurant();
  const { t, lang } = useAdminTranslation();
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;
  const queryClient = useQueryClient();

  const { data: hasReservations } = useFeatureAccess('feature_reservations', restaurantId);
  const { data: hasTables } = useFeatureAccess('feature_tables', restaurantId);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const { data: reservations = [], isLoading } = useReservations(restaurantId, { date: dateFilter ?? undefined });
  const { data: tables = [] } = useTables(restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  const createReservation = useCreateReservation(restaurantId);
  const cancelReservation = useCancelReservation(restaurantId);
  const { data: waitingQueue = [] } = useWaitingQueue(hasReservations ? restaurantId : null);
  const addToQueue = useAddToWaitingQueue(restaurantId);
  const notifyQueue = useNotifyQueueItem(restaurantId);
  const { data: tableStatuses = [] } = useTableStatuses(restaurantId);
  const resetTableMutation = useResetTable(restaurantId);
  const updateTableMutation = useUpdateReservationTable(restaurantId);
  const canResetTable = useCanAccess(['manager', 'waiter', 'restaurant_admin', 'super_admin']);
  const canChangeTable = useCanAccess(['manager', 'waiter', 'restaurant_admin', 'super_admin']);

  const [showCreate, setShowCreate] = useState(false);
  const [showWaitingQueue, setShowWaitingQueue] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [queuePhone, setQueuePhone] = useState('');
  const [queuePhoneCountry, setQueuePhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [notifyTableId, setNotifyTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoneCountry, setCustomerPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [tableId, setTableId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [lateTolerance, setLateTolerance] = useState(15);
  const [notes, setNotes] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<string | null>(null);
  const [changeTableTarget, setChangeTableTarget] = useState<ReservationWithDetails | null>(null);
  const [changeTableNewTableId, setChangeTableNewTableId] = useState<string>('');

  const activeTables = tables.filter((tbl) => tbl.is_active);
  const reservedTableIds = new Set(
    reservations
      .filter((r) => ['pending', 'confirmed'].includes(r.status))
      .map((r) => r.table_id)
  );
  const freeTables = activeTables.filter((t) => !reservedTableIds.has(t.id));

  const kanbanReserved = reservations.filter((r) => ['pending', 'confirmed', 'activated'].includes(r.status));
  const kanbanCancelled = reservations.filter((r) => ['cancelled', 'no_show'].includes(r.status));
  const kanbanCompleted = reservations.filter((r) => r.status === 'completed');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId || !customerName.trim()) {
      toast({ title: t('reservations.requiredFields'), variant: 'destructive' });
      return;
    }
    const dateTime = scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      : new Date().toISOString();
    try {
      const phoneVal = customerPhone.trim();
      const phoneNormalized = phoneVal ? normalizePhoneWithCountryCode(phoneVal, customerPhoneCountry) : undefined;
      const res = await createReservation.mutateAsync({
        table_id: tableId,
        customer_name: customerName.trim(),
        customer_phone: phoneNormalized,
        scheduled_at: dateTime,
        late_tolerance_minutes: lateTolerance,
        notes: notes.trim() || undefined,
      });
      setShowCreate(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerPhoneCountry('BR');
      setTableId('');
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');
      toast({
        title: t('reservations.created'),
        description: `${t('reservations.code')} ${(res as { short_code: string }).short_code} — Mesa ${(res as { table_number: string }).table_number}`,
      });
    } catch (err: any) {
      toast({ title: t('reservations.errorCreate'), description: err?.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setCancelConfirmTarget(null);
    try {
      await cancelReservation.mutateAsync(id);
      toast({
        title: t('reservations.cancelled'),
        description: t('reservations.cancelSuccessDescription'),
      });
    } catch (err: any) {
      toast({ title: t('reservations.errorCancel'), description: err?.message, variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`reservations-realtime-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_queue', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['waitingQueue', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, queryClient]);

  // Data mínima em horário local para permitir reserva no dia atual
  const today = format(new Date(), 'yyyy-MM-dd');
  const basePublicUrl = restaurant?.slug ? getCardapioPublicUrl(restaurant.slug) : '';
  const linkReservar = basePublicUrl ? `${basePublicUrl.replace(/\/$/, '')}/reservar` : '';
  const linkFila = basePublicUrl ? `${basePublicUrl.replace(/\/$/, '')}/fila` : '';

  return (
    <AdminPageLayout className="pb-8">
      <AdminPageHeader
        title={t('reservations.title')}
        description={
          <>
            {t('reservations.subtitle')}
            {!!hasReservations && linkReservar && (
              <div className="flex items-center gap-2 mt-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={linkReservar} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  {t('reservations.linkReservation')}
                </a>
                <span className="text-muted-foreground">·</span>
                <a href={linkFila} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  {t('reservations.linkWaitingQueue')}
                </a>
              </div>
            )}
          </>
        }
        icon={CalendarClock}
        actions={
          <>
            {!!hasReservations && (
              <Button variant="outline" size="lg" onClick={() => setShowWaitingQueue(true)}>
                <Users className="h-5 w-5 mr-2" />
                {t('cashier.waitingQueue')}
                <span className="ml-1.5 text-muted-foreground">({waitingQueue.length})</span>
              </Button>
            )}
            <Button size="lg" onClick={() => setShowCreate(true)} disabled={freeTables.length === 0 || !hasTables}>
              <Plus className="h-5 w-5 mr-2" />
              {t('reservations.newReservation')}
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {t('reservations.filterByDate')}
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateFilter(null)}
          className={!dateFilter ? 'ring-2 ring-primary' : ''}
        >
          {t('reservations.filterAll')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateFilter(format(startOfDay(new Date()), 'yyyy-MM-dd'))}
          className={dateFilter === format(new Date(), 'yyyy-MM-dd') ? 'ring-2 ring-primary' : ''}
        >
          {t('reservations.today')}
        </Button>
        <Input
          type="date"
          value={dateFilter ?? ''}
          onChange={(e) => setDateFilter(e.target.value || null)}
          className="w-[160px]"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted bg-muted/20 p-12 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">
            {dateFilter ? t('reservations.noReservationsForDate') : t('reservations.noReservations')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{t('reservations.noReservationsHint')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Principal: Kanban de Reservadas (cards) */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              {t('reservations.kanbanReserved')}
              <Badge variant="secondary" className="text-xs">{kanbanReserved.length}</Badge>
            </h2>
            <KanbanColumn
              title=""
              count={0}
              reservations={kanbanReserved}
              variant="reserved"
              hallZones={hallZones}
              onCancel={setCancelConfirmTarget}
              cancellingId={cancellingId}
              onChangeTable={canChangeTable ? (r) => { setChangeTableTarget(r); setChangeTableNewTableId(r.table_id ?? ''); } : undefined}
              onResetTable={canResetTable ? async (r) => {
                if (!restaurantId || !r.table_id) return;
                if (!window.confirm(t('reservations.tableResetConfirm'))) return;
                try {
                  await resetTableMutation.mutateAsync(r.table_id);
                  toast({ title: t('tablesCentral.resetTable'), description: t('reservations.tableResetSuccess') });
                } catch (err: any) {
                  toast({ title: t('common.error'), description: err?.message, variant: 'destructive' });
                }
              } : undefined}
              resettingTable={resetTableMutation.isPending}
              hideHeader
              t={t}
              dateLocale={dateLocale}
            />
          </section>

          {/* Histórico: Tabs Cancelados | Concluídos (listas) */}
          <section className="rounded-xl border-2 border-muted bg-muted/10 overflow-hidden">
            <Tabs defaultValue="cancelled" className="w-full">
              <div className="border-b border-border bg-card/50 px-4">
                <TabsList className="h-12 w-full max-w-md bg-transparent p-0 gap-0">
                  <TabsTrigger
                    value="cancelled"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:text-destructive gap-2 px-6"
                  >
                    {t('reservations.kanbanCancelled')}
                    <Badge variant="secondary" className="text-xs">{kanbanCancelled.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="completed"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary gap-2 px-6"
                  >
                    {t('reservations.kanbanCompleted')}
                    <Badge variant="secondary" className="text-xs">{kanbanCompleted.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="cancelled" className="mt-0 p-4">
                {kanbanCancelled.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{t('reservations.noReservations')}</p>
                ) : (
                  <ReservationList
                    reservations={kanbanCancelled}
                    hallZones={hallZones}
                    t={t}
                    dateLocale={dateLocale}
                  />
                )}
              </TabsContent>
              <TabsContent value="completed" className="mt-0 p-4">
                {kanbanCompleted.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{t('reservations.noReservations')}</p>
                ) : (
                  <ReservationList
                    reservations={kanbanCompleted}
                    hallZones={hallZones}
                    t={t}
                    dateLocale={dateLocale}
                  />
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('reservations.newReservation')}</DialogTitle>
            <DialogDescription>{t('reservations.newReservationDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>{t('reservations.customerName')}</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="João Silva"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('reservations.customerPhone')}</Label>
              <PhoneCountryInput
                value={customerPhone}
                country={customerPhoneCountry}
                onValueChange={(phone, country) => { setCustomerPhone(phone); setCustomerPhoneCountry(country); }}
                showWhatsAppIcon
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('reservations.table')}</Label>
              <Select value={tableId} onValueChange={setTableId} required>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('reservations.selectTable')} />
                </SelectTrigger>
                <SelectContent>
                  {freeTables.map((tbl) => (
                    <SelectItem key={tbl.id} value={tbl.id}>
                      {t('reservations.table')} {tbl.number}
                      {hallZones.find((z) => z.id === tbl.hall_zone_id) && (
                        <span className="text-muted-foreground ml-1">
                          — {hallZones.find((z) => z.id === tbl.hall_zone_id)!.name}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('reservations.date')}</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={today}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('reservations.time')}</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>{t('reservations.lateTolerance')}</Label>
              <Input
                type="number"
                min={5}
                max={60}
                value={lateTolerance}
                onChange={(e) => setLateTolerance(parseInt(e.target.value, 10) || 15)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('reservations.lateToleranceHint')}</p>
            </div>
            <div>
              <Label>{t('reservations.notes')}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('reservations.notesPlaceholder')}
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createReservation.isPending}>
                {createReservation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('reservations.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alterar mesa da reserva */}
      <Dialog open={!!changeTableTarget} onOpenChange={(open) => { if (!open) { setChangeTableTarget(null); setChangeTableNewTableId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('reservations.changeTableTitle')}</DialogTitle>
            <DialogDescription>{t('reservations.changeTableDesc')}</DialogDescription>
          </DialogHeader>
          {changeTableTarget && (
            <div className="space-y-4">
              <div>
                <Label>{t('reservations.table')}</Label>
                <Select value={changeTableNewTableId} onValueChange={setChangeTableNewTableId} required>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('reservations.selectTable')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTables.map((tbl) => (
                      <SelectItem key={tbl.id} value={tbl.id}>
                        {t('reservations.table')} {tbl.number}
                        {hallZones.find((z) => z.id === tbl.hall_zone_id) && (
                          <span className="text-muted-foreground ml-1">
                            — {hallZones.find((z) => z.id === tbl.hall_zone_id)!.name}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setChangeTableTarget(null)} disabled={updateTableMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!changeTableTarget || !changeTableNewTableId || changeTableNewTableId === changeTableTarget.table_id) return;
                try {
                  const res = await updateTableMutation.mutateAsync({
                    reservation_id: changeTableTarget.id,
                    table_id: changeTableNewTableId,
                  }) as { table_number: string };
                  setChangeTableTarget(null);
                  setChangeTableNewTableId('');
                  toast({
                    title: t('reservations.changeTableSuccess', { num: res?.table_number ?? '' }),
                  });
                } catch (err: any) {
                  toast({ title: t('reservations.errorChangeTable'), description: err?.message, variant: 'destructive' });
                }
              }}
              disabled={!changeTableNewTableId || changeTableNewTableId === changeTableTarget?.table_id || updateTableMutation.isPending}
            >
              {updateTableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('reservations.changeTable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de cancelamento */}
      <Dialog open={!!cancelConfirmTarget} onOpenChange={(open) => !open && setCancelConfirmTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('reservations.cancelReservationConfirm')}</DialogTitle>
            <DialogDescription>{t('reservations.cancelReservationDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelConfirmTarget(null)} disabled={!!cancellingId}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelConfirmTarget && handleCancel(cancelConfirmTarget)}
              disabled={!!cancellingId}
            >
              {cancellingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
              {t('reservations.cancelReservationConfirmBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fila de Espera Modal */}
      <Dialog open={showWaitingQueue} onOpenChange={setShowWaitingQueue}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cashier.waitingQueue')}</DialogTitle>
            <DialogDescription>{t('cashier.addToQueue')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!queueName.trim()) return;
              try {
                const phoneVal = queuePhone.trim();
                const phoneNormalized = phoneVal ? normalizePhoneWithCountryCode(phoneVal, queuePhoneCountry) : undefined;
                await addToQueue.mutateAsync({ customer_name: queueName.trim(), customer_phone: phoneNormalized });
                setQueueName('');
                setQueuePhone('');
                setQueuePhoneCountry('BR');
                toast({ title: t('cashier.addToQueue') + ' ✓' });
              } catch (err: any) {
                toast({ title: err?.message, variant: 'destructive' });
              }
            }}
            className="space-y-2"
          >
            <Input
              placeholder={t('cashier.queueCustomerName')}
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2">
              <PhoneCountryInput
                value={queuePhone}
                country={queuePhoneCountry}
                onValueChange={(phone, country) => { setQueuePhone(phone); setQueuePhoneCountry(country); }}
                placeholder={t('cashier.queueCustomerPhone')}
                showWhatsAppIcon
                className="flex-1"
              />
              <Button type="submit" disabled={!queueName.trim() || addToQueue.isPending}>
                {addToQueue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </form>
          <div className="space-y-2">
            {waitingQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('cashier.queueEmpty')}</p>
            ) : (
              waitingQueue.map((item) => {
                const queuePhoneCountry = (restaurant as { phone_country?: string })?.phone_country === 'PY' ? 'PY' as const
                  : (restaurant as { phone_country?: string })?.phone_country === 'AR' ? 'AR' as const : 'BR' as const;
                const itemPhoneForWa = item.customer_phone
                  ? ensurePhoneForWhatsApp(item.customer_phone, queuePhoneCountry)
                  : null;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{item.customer_name}</p>
                      {item.customer_phone && <p className="text-xs text-muted-foreground">{item.customer_phone}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">#{item.position}</span>
                      {item.customer_phone && itemPhoneForWa && (
                        <a
                          href={generateWhatsAppLink(itemPhoneForWa, '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                          title="Abrir WhatsApp do cliente"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <Select value={notifyTableId} onValueChange={setNotifyTableId}>
                        <SelectTrigger className="w-[100px] h-8">
                          <SelectValue placeholder={t('cashier.callNext')} />
                        </SelectTrigger>
                        <SelectContent>
                          {tableStatuses
                            .filter((tbl) => tbl.status === 'free')
                            .map((tbl) => (
                              <SelectItem key={tbl.id} value={tbl.id}>
                                {t('reservations.table')} {tbl.number}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => {
                          const freeTables = tableStatuses.filter((tbl) => tbl.status === 'free');
                          if (freeTables.length === 0) {
                            toast({ title: t('cashier.noFreeTables'), variant: 'destructive' });
                            return;
                          }
                          const tid = notifyTableId || freeTables[0]?.id;
                          if (!tid) return;
                          try {
                            const res = await notifyQueue.mutateAsync({ queue_id: item.id, table_id: tid }) as { short_code: string; table_number: string };
                            setNotifyTableId('');
                            queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                            const tableNum = freeTables.find((tbl) => tbl.id === tid)?.number ?? res?.table_number ?? '?';
                            toast({ title: t('cashier.callNext') + ' ✓', description: `${t('reservations.table')} ${tableNum} — ${res?.short_code ?? ''}` });
                            if (item.customer_phone && res?.short_code && itemPhoneForWa) {
                              const firstName = item.customer_name.split(' ')[0] || item.customer_name;
                              const msg = `Olá ${firstName}! Sua mesa está pronta. 🍽️ Apresente o código *${res.short_code}* na recepção. Mesa ${tableNum}.`;
                              window.open(generateWhatsAppLink(itemPhoneForWa, msg), '_blank');
                            }
                          } catch (err: any) {
                            toast({ title: err?.message, variant: 'destructive' });
                          }
                        }}
                        disabled={notifyQueue.isPending || tableStatuses.filter((tbl) => tbl.status === 'free').length === 0}
                      >
                        {notifyQueue.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3 mr-1" />}
                        {notifyQueue.isPending ? null : t('cashier.callNext')}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminPageLayout>
  );
}

function KanbanColumn({
  title,
  count,
  reservations,
  variant,
  hallZones,
  onCancel,
  cancellingId,
  onChangeTable,
  onResetTable,
  resettingTable,
  hideHeader,
  t,
  dateLocale,
}: {
  title: string;
  count: number;
  reservations: ReservationWithDetails[];
  variant: 'reserved' | 'cancelled' | 'completed';
  hallZones: { id: string; name: string }[];
  onCancel: (id: string) => void;
  cancellingId: string | null;
  onChangeTable?: (r: ReservationWithDetails) => void;
  onResetTable?: (r: ReservationWithDetails) => void | Promise<void>;
  resettingTable?: boolean;
  hideHeader?: boolean;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const borderClass =
    variant === 'reserved'
      ? 'border-amber-300 dark:border-amber-700'
      : variant === 'cancelled'
        ? 'border-red-200 dark:border-red-800'
        : 'border-emerald-200 dark:border-emerald-800';
  const headerClass =
    variant === 'reserved'
      ? 'bg-amber-50 dark:bg-amber-950/30'
      : variant === 'cancelled'
        ? 'bg-red-50 dark:bg-red-950/20'
        : 'bg-emerald-50 dark:bg-emerald-950/20';

  return (
    <div className={`rounded-xl border-2 ${borderClass} overflow-hidden flex flex-col min-h-[200px]`}>
      {!hideHeader && (
        <div className={`px-4 py-3 ${headerClass} border-b ${borderClass}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{title}</span>
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          </div>
        </div>
      )}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('reservations.noReservations')}</p>
        ) : (
          reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              hallZones={hallZones}
              onCancel={() => onCancel(r.id)}
              cancelling={cancellingId === r.id}
              onChangeTable={variant === 'reserved' && onChangeTable ? () => onChangeTable(r) : undefined}
              onResetTable={variant === 'reserved' && onResetTable ? () => onResetTable(r) : undefined}
              resettingTable={resettingTable}
              t={t}
              dateLocale={dateLocale}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Lista compacta de reservas (Cancelados/Concluídos). */
function ReservationList({
  reservations,
  hallZones,
  t,
  dateLocale,
}: {
  reservations: ReservationWithDetails[];
  hallZones: { id: string; name: string }[];
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
      <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
        <div className="sm:col-span-2">{t('reservations.code')}</div>
        <div className="sm:col-span-3">{t('reservations.customerName')}</div>
        <div className="sm:col-span-1">{t('reservations.table')}</div>
        <div className="sm:col-span-2">{t('reservations.scheduledFor')}</div>
        <div className="sm:col-span-2">{t('reservations.statusColumn')}</div>
        <div className="sm:col-span-2">{t('reservations.notes')}</div>
      </div>
      {reservations.map((r) => (
        <ReservationListRow key={r.id} reservation={r} hallZones={hallZones} t={t} dateLocale={dateLocale} />
      ))}
    </div>
  );
}

function ReservationListRow({
  reservation,
  hallZones,
  t,
  dateLocale,
}: {
  reservation: ReservationWithDetails;
  hallZones: { id: string; name: string }[];
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const scheduled = new Date(reservation.scheduled_at);
  const statusKey = STATUS_KEY_MAP[reservation.status];
  const statusLabel = statusKey ? t(`reservations.${statusKey}`) : reservation.status;
  const zoneName = reservation.tables?.hall_zone_id
    ? hallZones.find((z) => z.id === reservation.tables!.hall_zone_id)?.name ?? null
    : null;
  const tableDisplay = reservation.table_number != null ? String(reservation.table_number) : '—';
  const notesShort = reservation.notes?.trim() ? (reservation.notes!.length > 40 ? reservation.notes!.slice(0, 40) + '…' : reservation.notes!.trim()) : '—';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3 px-4 py-3 sm:py-2.5 hover:bg-muted/30 transition-colors items-start sm:items-center">
      <div className="sm:col-span-2 flex items-center gap-2">
        <span className="font-mono font-semibold text-primary">{reservation.short_code ?? '—'}</span>
        <Badge className={`shrink-0 text-[10px] sm:hidden ${getStatusBadgeClass(reservation.status)}`}>
          {statusLabel}
        </Badge>
      </div>
      <div className="sm:col-span-3 font-medium text-foreground truncate">
        {reservation.customer_name?.trim() || '—'}
      </div>
      <div className="sm:col-span-1 text-sm text-muted-foreground">
        {t('reservations.table')} {tableDisplay}
        {zoneName ? ` — ${zoneName}` : ''}
      </div>
      <div className="sm:col-span-2 text-sm text-muted-foreground">
        {format(scheduled, "dd/MM 'às' HH:mm", { locale: dateLocale })}
      </div>
      <div className="hidden sm:block sm:col-span-2">
        <Badge className={`shrink-0 text-[10px] ${getStatusBadgeClass(reservation.status)}`}>
          {statusLabel}
        </Badge>
      </div>
      <div className="sm:col-span-2 text-sm text-muted-foreground truncate">
        {notesShort}
      </div>
    </div>
  );
}

/** Estilos do card por status: completed/cancelled no_show / reserved (pending, confirmed, activated). */
function getCardStyles(status: string): string {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20';
  }
  if (['cancelled', 'no_show'].includes(status)) {
    return 'border-red-100 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10';
  }
  if (status === 'activated') {
    return 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/30';
  }
  if (status === 'confirmed') {
    return 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/30';
  }
  return 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20';
}

/** Badge do status com cor por tipo (todas as colunas). */
function getStatusBadgeClass(status: string): string {
  if (status === 'activated') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700';
  }
  if (status === 'confirmed') {
    return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700';
  }
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700';
  }
  if (['cancelled', 'no_show'].includes(status)) {
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700';
  }
  return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700';
}

function ReservationCard({
  reservation,
  hallZones,
  onCancel,
  cancelling,
  onChangeTable,
  onResetTable,
  resettingTable,
  t,
  dateLocale,
}: {
  reservation: ReservationWithDetails;
  hallZones: { id: string; name: string }[];
  onCancel: () => void;
  cancelling: boolean;
  onChangeTable?: () => void;
  onResetTable?: () => void | Promise<void>;
  resettingTable?: boolean;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const scheduled = new Date(reservation.scheduled_at);
  const isPending = ['pending', 'confirmed'].includes(reservation.status);
  const isActivated = reservation.status === 'activated';
  const statusKey = STATUS_KEY_MAP[reservation.status];
  const statusLabel = statusKey ? t(`reservations.${statusKey}`) : reservation.status;
  const zoneName = reservation.tables?.hall_zone_id
    ? hallZones.find((z) => z.id === reservation.tables!.hall_zone_id)?.name ?? null
    : null;
  const tableDisplay = reservation.table_number != null ? String(reservation.table_number) : '—';
  const shortCodeDisplay = reservation.short_code ?? '—';
  const customerDisplay = reservation.customer_name?.trim() || '—';
  const hasActions = (['pending', 'confirmed', 'activated'].includes(reservation.status) && (onResetTable || onChangeTable)) || isPending;

  return (
    <div className={`rounded-lg border p-4 transition-shadow ${getCardStyles(reservation.status)}`}>
      {/* Bloco 1: código + status (sem botões para não quebrar em mobile) */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
          {t('reservations.reserva')} {shortCodeDisplay}
        </Badge>
        <Badge className={`shrink-0 ${getStatusBadgeClass(reservation.status)}`}>
          {statusLabel}
        </Badge>
        {isActivated && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('reservations.atTable')}
          </span>
        )}
      </div>

      {/* Bloco 2: conteúdo — nome, mesa/zona, data e horário escolhido */}
      <div className="mt-3 min-w-0 space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-1.5 truncate">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          {customerDisplay}
        </p>
        <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-primary/80 shrink-0" />
          <span className="text-muted-foreground">{t('reservations.scheduledFor')}:</span>{' '}
          {format(scheduled, "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}
        </p>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {t('reservations.table')} {tableDisplay}
          {zoneName ? ` — ${zoneName}` : ''}
        </p>
        {reservation.notes?.trim() && (
          <p className="text-sm text-muted-foreground flex items-start gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-medium text-foreground/90">{t('reservations.notes')}:</span>{' '}
              {reservation.notes.trim()}
            </span>
          </p>
        )}
      </div>

      {/* Bloco 3: ações (só renderiza quando houver botões) */}
      {hasActions && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1 flex-wrap">
          {['pending', 'confirmed', 'activated'].includes(reservation.status) && onChangeTable && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
            onClick={onChangeTable}
            title={t('reservations.changeTable')}
            aria-label={t('reservations.changeTable')}
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reservations.changeTable')}</span>
          </Button>
        )}
          {['pending', 'confirmed', 'activated'].includes(reservation.status) && onResetTable && (
          <Button
            variant={isActivated ? 'default' : 'ghost'}
            size="sm"
            className={`shrink-0 gap-1 ${isActivated ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
            onClick={onResetTable}
            disabled={resettingTable}
            title={t('tablesCentral.resetTable')}
          >
            {resettingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span className="hidden sm:inline">{t('tablesCentral.resetTable')}</span>
          </Button>
        )}
        {isPending && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
            disabled={cancelling}
            title={t('reservations.cancelReservation')}
            aria-label={t('reservations.cancelReservation')}
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            <span className="hidden sm:inline ml-1">{t('reservations.cancelReservation')}</span>
          </Button>
        )}
        </div>
      )}
    </div>
  );
}

export default function Reservations() {
  return (
    <FeatureGuard feature="feature_reservations">
      <ReservationsContent />
    </FeatureGuard>
  );
}
