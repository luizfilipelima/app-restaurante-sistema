/**
 * Horários de Funcionamento — seção para a aba "Horários" nas Configurações.
 * Mesma lógica e UI da página Horários, sem layout de página.
 */

import { useEffect, useState } from 'react';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { supabase } from '@/lib/core/supabase';
import type { DayKey } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/shared/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import { Clock, Sun, XCircle, Loader2, Save, CheckCircle2, Truck, CalendarClock } from 'lucide-react';

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tue', label: 'Terça-feira', short: 'Ter' },
  { key: 'wed', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thu', label: 'Quinta-feira', short: 'Qui' },
  { key: 'fri', label: 'Sexta-feira', short: 'Sex' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
];

type OpeningHours = Record<DayKey, { open: string; close: string } | null>;

export default function SettingsHorariosSection() {
  const restaurantId = useAdminRestaurantId();
  const queryClient = useQueryClient();
  const { data: restaurant } = useRestaurant(restaurantId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(() =>
    DAYS.reduce((acc, d) => ({ ...acc, [d.key]: null }), {} as OpeningHours)
  );
  const [deliveryUntilTime, setDeliveryUntilTime] = useState<string>('');
  const [reservationStartTime, setReservationStartTime] = useState<string>('');
  const [reservationEndTime, setReservationEndTime] = useState<string>('');

  useEffect(() => {
    if (restaurant) {
      setAlwaysOpen(!!restaurant.always_open);
      setIsManuallyClosed(!!restaurant.is_manually_closed);
      const hours = (restaurant.opening_hours || {}) as OpeningHours;
      setOpeningHours(
        DAYS.reduce(
          (acc, d) => ({ ...acc, [d.key]: hours[d.key] || null }),
          {} as OpeningHours
        )
      );
      setDeliveryUntilTime(restaurant.delivery_until_time?.trim() || '');
      setReservationStartTime(restaurant.reservation_start_time?.trim() || '');
      setReservationEndTime(restaurant.reservation_end_time?.trim() || '');
    }
    setLoading(false);
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          always_open: alwaysOpen,
          is_manually_closed: isManuallyClosed,
          opening_hours: openingHours,
          delivery_until_time: deliveryUntilTime.trim() || null,
          reservation_start_time: reservationStartTime.trim() || null,
          reservation_end_time: reservationEndTime.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      invalidatePublicMenuCache(queryClient, restaurant?.slug || undefined);
      toast({ title: 'Horários salvos com sucesso!' });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const setDay = (key: DayKey, slot: { open: string; close: string } | null) => {
    setOpeningHours((prev) => ({ ...prev, [key]: slot }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando horários…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-sky-500/10 via-blue-500/10 to-indigo-600/10 border border-sky-200/60 dark:border-sky-800/40 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground max-w-xl">
          Defina quando seu estabelecimento está aberto. Essas informações aparecem no cardápio e nas buscas.
        </p>
      </div>

      {/* Status rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className={`rounded-xl border-2 p-4 flex items-center justify-between gap-4 transition-all ${
            alwaysOpen
              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800'
              : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                alwaysOpen ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Sempre aberto (24h)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ignora os horários por dia da semana.</p>
            </div>
          </div>
          <Switch
            checked={alwaysOpen}
            onCheckedChange={setAlwaysOpen}
            className="data-[state=checked]:bg-emerald-500 shrink-0"
          />
        </div>

        <div
          className={`rounded-xl border-2 p-4 flex items-center justify-between gap-4 transition-all ${
            isManuallyClosed
              ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800'
              : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                isManuallyClosed ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50' : 'bg-muted text-muted-foreground'
              }`}
            >
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Fechado agora (manual)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Força status fechado independente do horário.</p>
            </div>
          </div>
          <Switch
            checked={isManuallyClosed}
            onCheckedChange={setIsManuallyClosed}
            className="data-[state=checked]:bg-amber-500 shrink-0"
          />
        </div>
      </div>

      {/* Grade de horários */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <Clock className="h-[18px] w-[18px] text-sky-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Horários por dia da semana</h2>
              <p className="text-xs text-muted-foreground">
                {alwaysOpen
                  ? 'Ignorados — estabelecimento definido como sempre aberto.'
                  : 'Defina abertura e fechamento para cada dia.'}
              </p>
            </div>
          </div>
        </div>
        <div className={`p-5 space-y-2 ${alwaysOpen ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          {DAYS.map(({ key, label, short }) => {
            const slot = openingHours[key];
            const isClosed = !slot;
            return (
              <div
                key={key}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border transition-colors ${
                  isClosed ? 'bg-muted/50 border-border' : 'bg-card border-border shadow-sm'
                }`}
              >
                <div className="w-24 sm:w-32 shrink-0">
                  <span className={`text-sm font-medium ${isClosed ? 'text-muted-foreground' : 'text-foreground'}`}>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{short}</span>
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={isClosed}
                    onChange={(e) => {
                      setDay(key, e.target.checked ? null : { open: '11:00', close: '23:00' });
                    }}
                    className="h-4 w-4 rounded border-input text-sky-500 focus:ring-sky-500"
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${
                      isClosed ? 'text-muted-foreground' : 'text-emerald-600'
                    }`}
                  >
                    {isClosed ? (
                      <>
                        <XCircle className="h-3.5 w-3.5" /> Fechado
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aberto
                      </>
                    )}
                  </span>
                </label>
                {!isClosed && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="time"
                      value={slot?.open || '11:00'}
                      onChange={(e) => {
                        setDay(key, { open: e.target.value, close: slot?.close || '23:00' });
                      }}
                      className="h-9 w-28 text-sm text-center font-medium"
                    />
                    <span className="text-muted-foreground font-medium">–</span>
                    <Input
                      type="time"
                      value={slot?.close || '23:00'}
                      onChange={(e) => {
                        setDay(key, { open: slot?.open || '11:00', close: e.target.value });
                      }}
                      className="h-9 w-28 text-sm text-center font-medium"
                    />
                  </div>
                )}
                {isClosed && <span className="ml-auto text-xs text-muted-foreground italic">Sem atendimento</span>}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-sky-600 hover:bg-sky-700">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar horários
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Horário do delivery */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <Truck className="h-[18px] w-[18px] text-orange-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Horário do delivery</h2>
              <p className="text-xs text-muted-foreground">
                Até que horas aceitar pedidos de delivery. Deixe em branco para não limitar pelo horário.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Aceitar delivery até</span>
            <Input
              type="time"
              value={deliveryUntilTime}
              onChange={(e) => setDeliveryUntilTime(e.target.value)}
              className="h-9 w-28 text-sm font-medium"
            />
          </label>
          {deliveryUntilTime && (
            <button
              type="button"
              onClick={() => setDeliveryUntilTime('')}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Remover limite
            </button>
          )}
        </div>
      </div>

      {/* Horário das reservas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <CalendarClock className="h-[18px] w-[18px] text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Horário das reservas</h2>
              <p className="text-xs text-muted-foreground">
                Intervalo de horários em que o cliente pode escolher para estar no local. Deixe em branco para permitir qualquer horário.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Reservas a partir de</span>
            <Input
              type="time"
              value={reservationStartTime}
              onChange={(e) => setReservationStartTime(e.target.value)}
              className="h-9 w-28 text-sm font-medium"
            />
          </label>
          <span className="text-muted-foreground font-medium hidden sm:inline">até</span>
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Reservas até</span>
            <Input
              type="time"
              value={reservationEndTime}
              onChange={(e) => setReservationEndTime(e.target.value)}
              className="h-9 w-28 text-sm font-medium"
            />
          </label>
          {(reservationStartTime || reservationEndTime) && (
            <button
              type="button"
              onClick={() => {
                setReservationStartTime('');
                setReservationEndTime('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Remover limite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
