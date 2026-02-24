/**
 * Página de Reservas — Gestão de reservas via comanda digital
 *
 * Lista reservas, cria novas (com mesa + comanda com código de barras).
 * Integrado com Mesas e Caixa. Tag "Reserva" em mesas e no /cashier.
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import {
  useReservations,
  useCreateReservation,
  useCancelReservation,
  useTables,
  useHallZones,
  useWaitingQueue,
  useAddToWaitingQueue,
  useNotifyQueueItem,
  useTableStatuses,
  type ReservationWithDetails,
} from '@/hooks/queries';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { FeatureGuard } from '@/components/auth/FeatureGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
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
import { Plus, CalendarClock, Loader2, X, User, Clock, MapPin, Users, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';
import { useAdminTranslation } from '@/hooks/useAdminTranslation';
import { generateWhatsAppLink, ensurePhoneForWhatsApp } from '@/lib/utils';

const DATE_LOCALES = { pt: ptBR, es, en: enUS } as const;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  activated: 'Ativada',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

function ReservationsContent() {
  const restaurantId = useAdminRestaurantId();
  useAdminRestaurant();
  const { t, lang } = useAdminTranslation();
  const dateLocale = DATE_LOCALES[lang] ?? ptBR;
  const queryClient = useQueryClient();

  const { data: hasReservations } = useFeatureAccess('feature_reservations', restaurantId);
  const { data: hasTables } = useFeatureAccess('feature_tables', restaurantId);
  const { data: reservations = [], isLoading } = useReservations(restaurantId);
  const { data: tables = [] } = useTables(restaurantId);
  const { data: hallZones = [] } = useHallZones(restaurantId);
  const createReservation = useCreateReservation(restaurantId);
  const cancelReservation = useCancelReservation(restaurantId);
  const { data: waitingQueue = [], refetch: refetchWaitingQueue } = useWaitingQueue(hasReservations ? restaurantId : null);
  const addToQueue = useAddToWaitingQueue(restaurantId);
  const notifyQueue = useNotifyQueueItem(restaurantId);
  const { data: tableStatuses = [] } = useTableStatuses(restaurantId);

  const [showCreate, setShowCreate] = useState(false);
  const [showWaitingQueue, setShowWaitingQueue] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [queuePhone, setQueuePhone] = useState('');
  const [notifyTableId, setNotifyTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableId, setTableId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [lateTolerance, setLateTolerance] = useState(15);
  const [notes, setNotes] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const activeTables = tables.filter((tbl) => tbl.is_active);
  const reservedTableIds = new Set(
    reservations
      .filter((r) => ['pending', 'confirmed'].includes(r.status))
      .map((r) => r.table_id)
  );
  const freeTables = activeTables.filter((t) => !reservedTableIds.has(t.id));

  const filteredReservations = reservations.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId || !customerName.trim()) {
      toast({ title: t('reservations.requiredFields'), variant: 'destructive' });
      return;
    }
    const dateTime = scheduledDate && scheduledTime
      ? `${scheduledDate}T${scheduledTime}:00`
      : new Date().toISOString();
    try {
      const res = await createReservation.mutateAsync({
        table_id: tableId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        scheduled_at: dateTime,
        late_tolerance_minutes: lateTolerance,
        notes: notes.trim() || undefined,
      });
      setShowCreate(false);
      setCustomerName('');
      setCustomerPhone('');
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
    try {
      await cancelReservation.mutateAsync(id);
      toast({ title: t('reservations.cancelled') });
    } catch (err: any) {
      toast({ title: t('reservations.errorCancel'), description: err?.message, variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (!restaurantId || !hasReservations) return;
    const ch = supabase
      .channel(`reservations-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, hasReservations, queryClient]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reservations.title')}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t('reservations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!!hasReservations && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowWaitingQueue(true)}
            >
              <Users className="h-5 w-5 mr-2" />
              {t('cashier.waitingQueue')}
              <span className="ml-1.5 text-muted-foreground">({waitingQueue.length})</span>
            </Button>
          )}
          <Button
            size="lg"
            onClick={() => setShowCreate(true)}
            disabled={freeTables.length === 0 || !hasTables}
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('reservations.newReservation')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('reservations.filterAll')}</SelectItem>
            <SelectItem value="pending">{t('reservations.statusPending')}</SelectItem>
            <SelectItem value="confirmed">{t('reservations.statusConfirmed')}</SelectItem>
            <SelectItem value="activated">{t('reservations.statusActivated')}</SelectItem>
            <SelectItem value="cancelled">{t('reservations.statusCancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted bg-muted/20 p-12 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium text-muted-foreground">{t('reservations.noReservations')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('reservations.noReservationsHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              hallZones={hallZones}
              onCancel={() => handleCancel(r.id)}
              cancelling={cancellingId === r.id}
              t={t}
              dateLocale={dateLocale}
            />
          ))}
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
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
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
                await addToQueue.mutateAsync({ customer_name: queueName.trim(), customer_phone: queuePhone.trim() || undefined });
                setQueueName('');
                setQueuePhone('');
                toast({ title: t('cashier.addToQueue') + ' ✓' });
              } catch (err: any) {
                toast({ title: err?.message, variant: 'destructive' });
              }
            }}
            className="flex gap-2"
          >
            <Input
              placeholder={t('cashier.queueCustomerName')}
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder={t('cashier.queueCustomerPhone')}
              value={queuePhone}
              onChange={(e) => setQueuePhone(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!queueName.trim() || addToQueue.isPending}>
              {addToQueue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
          <div className="space-y-2">
            {waitingQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('cashier.queueEmpty')}</p>
            ) : (
              waitingQueue.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium">{item.customer_name}</p>
                    {item.customer_phone && <p className="text-xs text-muted-foreground">{item.customer_phone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{item.position}</span>
                    <Select value={notifyTableId} onValueChange={setNotifyTableId}>
                      <SelectTrigger className="w-[120px] h-8">
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
                          refetchWaitingQueue();
                          queryClient.invalidateQueries({ queryKey: ['tableStatuses', restaurantId] });
                          const tableNum = freeTables.find((tbl) => tbl.id === tid)?.number ?? res?.table_number ?? '?';
                          toast({ title: t('cashier.callNext') + ' ✓', description: `${t('reservations.table')} ${tableNum} — ${res?.short_code ?? ''}` });
                          if (item.customer_phone && res?.short_code) {
                            const phone = ensurePhoneForWhatsApp(item.customer_phone, 'BR');
                            const msg = `Olá ${item.customer_name}! Sua mesa está pronta. 🍽️ Apresente o código *${res.short_code}* na recepção. Mesa ${tableNum}.`;
                            window.open(generateWhatsAppLink(phone, msg), '_blank');
                          }
                        } catch (err: any) {
                          toast({ title: err?.message, variant: 'destructive' });
                        }
                      }}
                      disabled={notifyQueue.isPending || tableStatuses.filter((tbl) => tbl.status === 'free').length === 0}
                    >
                      {notifyQueue.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : item.customer_phone ? <MessageCircle className="h-3 w-3 mr-1" /> : null}
                      {notifyQueue.isPending ? null : t('cashier.callNext')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReservationCard({
  reservation,
  hallZones,
  onCancel,
  cancelling,
  t,
  dateLocale,
}: {
  reservation: ReservationWithDetails;
  hallZones: { id: string; name: string }[];
  onCancel: () => void;
  cancelling: boolean;
  t: (k: string) => string;
  dateLocale: Locale;
}) {
  const scheduled = new Date(reservation.scheduled_at);
  const isPending = ['pending', 'confirmed'].includes(reservation.status);
  const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-shadow ${
        isPending ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300">
              {t('reservations.reserva')} {reservation.short_code}
            </Badge>
            <Badge variant="outline">{statusLabel}</Badge>
          </div>
          <p className="font-semibold mt-2 flex items-center gap-1.5">
            <User className="h-4 w-4 text-muted-foreground" />
            {reservation.customer_name}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3.5 w-3.5" />
            {format(scheduled, "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3.5 w-3.5" />
            {t('reservations.table')} {reservation.table_number}
            {reservation.tables?.hall_zone_id && hallZones.find((z) => z.id === reservation.tables!.hall_zone_id) && (
              <> — {hallZones.find((z) => z.id === reservation.tables!.hall_zone_id)!.name}</>
            )}
          </p>
        </div>
        {isPending && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </Button>
        )}
      </div>
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
