/**
 * Reserva Pública — Redesign
 * Tela inicial: "Fazer nova reserva" e "Acessar minhas reservas".
 * Minhas reservas: formulário nome + WhatsApp → listagem com código de barras, mesa, data/hora, status.
 * Mostra posição na fila quando houver.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Barcode from 'react-barcode';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  CalendarClock,
  AlertCircle,
  CalendarPlus,
  UserCheck,
  ArrowLeft,
  Users,
  ChevronDown,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, es } from 'date-fns/locale';
import { normalizePhoneWithCountryCode, generateWhatsAppLink, ensurePhoneForWhatsApp } from '@/lib/core/utils';
import { toast } from '@/hooks/shared/use-toast';
import { PhoneCountryInput } from '@/components/ui/PhoneCountryInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Gera slots de horário (ex: 18:00, 18:30...) entre start e end. Intervalo em minutos. */
function generateReservationTimeSlots(
  start: string,
  end: string,
  intervalMinutes = 30
): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = (sh ?? 0) * 60 + (sm ?? 0);
  const endMins = (eh ?? 0) * 60 + (em ?? 0);
  const slots: string[] = [];
  for (let m = startMins; m <= endMins; m += intervalMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
  phone_country?: 'BR' | 'PY' | 'AR' | null;
  whatsapp?: string | null;
  reservation_start_time?: string | null;
  reservation_end_time?: string | null;
}

interface ZoneOption {
  hall_zone_id: string;
  zone_name: string;
  image_url: string | null;
  available_table_ids: string[];
}

interface MyReservation {
  id: string;
  short_code: string;
  table_number: number;
  customer_name: string;
  scheduled_at: string;
  status: string;
  created_at: string;
}

interface MyWaitingPosition {
  id: string;
  position: number;
  customer_name: string;
  status: string;
  created_at: string;
}

type MainView = 'home' | 'new' | 'my' | 'success';
type MyReservationsStep = 'form' | 'list';


interface PublicReservationProps {
  tenantSlug?: string;
}

const DATE_LOCALES = { pt: ptBR, es } as const;

export default function PublicReservation({ tenantSlug: slugFromLayout }: PublicReservationProps = {}) {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[(i18n.language as 'pt' | 'es') ?? 'pt'] ?? ptBR;
  const { restaurantSlug: slugFromParams } = useParams<{ restaurantSlug: string }>();
  const restaurantSlug = slugFromLayout ?? slugFromParams;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>('home');
  const [myStep, setMyStep] = useState<MyReservationsStep>('form');

  // Novo formulário
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoneCountry, setCustomerPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedZone, setSelectedZone] = useState<ZoneOption | null>(null);
  const [notes, setNotes] = useState('');
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Minhas reservas
  const [myName, setMyName] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [myPhoneCountry, setMyPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [myReservations, setMyReservations] = useState<MyReservation[]>([]);
  const [myWaitingPosition, setMyWaitingPosition] = useState<MyWaitingPosition | null>(null);
  const [fetchingMy, setFetchingMy] = useState(false);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);

  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [result, setResult] = useState<{ short_code: string; table_number: string; scheduled_at: string } | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (restaurant?.phone_country && ['BR', 'PY', 'AR'].includes(restaurant.phone_country)) {
      setCustomerPhoneCountry(restaurant.phone_country);
      setMyPhoneCountry(restaurant.phone_country);
    }
  }, [restaurant?.phone_country]);

  useEffect(() => {
    if (!restaurantSlug) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rest, error: restErr } = await supabase
          .from('restaurants')
          .select('id, name, logo, phone_country, whatsapp, reservation_start_time, reservation_end_time')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        if (restErr || !rest) {
          setError(t('reservation.restaurantNotFound'));
          return;
        }
        setRestaurant(rest);
      } catch {
        setError(t('menu.restaurantNotFound'));
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantSlug]);

  // Lista setores ao entrar no formulário (sem depender de data/hora)
  useEffect(() => {
    if (!restaurantSlug || mainView !== 'new') {
      setZones([]);
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      supabase
        .rpc('list_hall_zones_for_reservation_by_slug', {
          p_restaurant_slug: restaurantSlug,
        })
        .then(({ data, error: listErr }) => {
          if (listErr) {
            setZones([]);
            return;
          }
          setZones((data ?? []) as ZoneOption[]);
        });
      return;
    }
    const dt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    supabase
      .rpc('get_available_hall_zones_for_reservation', {
        p_restaurant_slug: restaurantSlug,
        p_scheduled_at: dt,
      })
      .then(({ data, error: zonesErr }) => {
        if (zonesErr) {
          setZones([]);
          setSelectedZone(null);
          return;
        }
        const list = (data ?? []) as ZoneOption[];
        setZones(list);
        setSelectedZone((prev) => {
          if (!prev) return null;
          const stillValid = list.some(
            (z) => z.hall_zone_id === prev.hall_zone_id && (prev.available_table_ids?.length ?? 0) > 0
          );
          if (stillValid) {
            const updated = list.find((z) => z.hall_zone_id === prev.hall_zone_id);
            return updated && (updated.available_table_ids?.length ?? 0) > 0 ? updated : null;
          }
          return null;
        });
      });
  }, [restaurantSlug, scheduledDate, scheduledTime, mainView]);

  // Data mínima em horário local para permitir reserva no dia atual
  const today = format(new Date(), 'yyyy-MM-dd');

  // Horários fixos de reserva (independente de sempre aberto). Se definidos, limitamos as opções.
  const reservationTimeSlots = useMemo(() => {
    const start = restaurant?.reservation_start_time?.trim();
    const end = restaurant?.reservation_end_time?.trim();
    if (!start || !end) return null;
    return generateReservationTimeSlots(start, end, 30);
  }, [restaurant?.reservation_start_time, restaurant?.reservation_end_time]);

  useEffect(() => {
    if (reservationTimeSlots && scheduledTime && !reservationTimeSlots.includes(scheduledTime)) {
      setScheduledTime('');
    }
  }, [reservationTimeSlots, scheduledTime]);

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !selectedZone || !customerName.trim() || !scheduledDate || !scheduledTime) {
      setError(t('reservation.errorFillData'));
      return;
    }
    if (scheduledDate < today) {
      setError(t('reservation.errorPastDate'));
      return;
    }
    const availableIds = selectedZone.available_table_ids ?? [];
    if (availableIds.length === 0) {
      setError(t('reservation.noZonesAvailable'));
      return;
    }
    const tableId = availableIds[Math.floor(Math.random() * availableIds.length)]!;
    const start = restaurant?.reservation_start_time?.trim();
    const end = restaurant?.reservation_end_time?.trim();
    if (start && end && scheduledTime) {
      const [sh, sm] = scheduledTime.split(':').map(Number);
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      const scheduledMins = (sh ?? 0) * 60 + (sm ?? 0);
      const startMins = (startH ?? 0) * 60 + (startM ?? 0);
      const endMins = (endH ?? 0) * 60 + (endM ?? 0);
      if (scheduledMins < startMins || scheduledMins > endMins) {
        setError(t('reservation.errorTimeOutsideRange'));
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const dt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      const phoneVal = customerPhone.trim();
      const phoneNormalized = phoneVal ? normalizePhoneWithCountryCode(phoneVal, customerPhoneCountry) : null;
      const { data, error: rpcErr } = await supabase.rpc('create_reservation_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_table_id: tableId,
        p_customer_name: customerName.trim(),
        p_customer_phone: phoneNormalized,
        p_scheduled_at: dt,
        p_late_tolerance_mins: 15,
        p_notes: notes.trim() || null,
      });
      if (rpcErr) {
        setError(rpcErr.message ?? t('reservation.errorCreate'));
        return;
      }
      const res = data as { short_code: string; table_number: string; scheduled_at: string };
      setResult(res);
      setMainView('success');
    } catch {
      setError(t('reservation.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchMyReservations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !myPhone.trim()) {
      setError(t('reservation.errorPhoneRequired'));
      return;
    }
    setFetchingMy(true);
    setError(null);
    setMyReservations([]);
    setMyWaitingPosition(null);
    try {
      const phoneNormalized = normalizePhoneWithCountryCode(myPhone.trim(), myPhoneCountry);
      const [reservationsRes, positionRes] = await Promise.all([
        supabase.rpc('list_my_reservations_by_slug', {
          p_restaurant_slug: restaurantSlug,
          p_customer_phone: phoneNormalized,
          p_customer_name: myName.trim() || null,
        }),
        supabase.rpc('get_my_waiting_position_by_slug', {
          p_restaurant_slug: restaurantSlug,
          p_customer_phone: phoneNormalized,
        }),
      ]);
      const list = (reservationsRes.data ?? []) as MyReservation[];
      setMyReservations(Array.isArray(list) ? list : []);
      const pos = positionRes.data as MyWaitingPosition | null;
      setMyWaitingPosition(pos && typeof pos === 'object' && pos.position != null ? pos : null);
      setMyStep('list');
    } catch {
      setError(t('reservation.errorFetch'));
    } finally {
      setFetchingMy(false);
    }
  };

  const goBack = () => {
    setMainView('home');
    setError(null);
    setMyStep('form');
    setMyReservations([]);
    setMyWaitingPosition(null);
  };

  const canCancel = (r: MyReservation) => r.status === 'pending' || r.status === 'confirmed';

  const handleCancelReservation = async (r: MyReservation) => {
    if (!restaurantSlug || !canCancel(r)) return;
    setCancellingReservationId(r.id);
    try {
      const phoneNormalized = normalizePhoneWithCountryCode(myPhone.trim(), myPhoneCountry);
      const { error: rpcErr } = await supabase.rpc('cancel_my_reservation_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_reservation_id: r.id,
        p_customer_phone: phoneNormalized,
      });
      if (rpcErr) throw rpcErr;
      setMyReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' as const } : x)));
      toast({ title: t('reservation.cancelSuccess') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t('reservation.cancelError'), description: msg, variant: 'destructive' });
    } finally {
      setCancellingReservationId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('reservation.loading')}</p>
      </div>
    );
  }

  if (!restaurant || (error && mainView === 'home')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-foreground">{error ?? t('reservation.restaurantNotFound')}</p>
        <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'}>
          <Button variant="outline">{t('reservation.back')}</Button>
        </Link>
      </div>
    );
  }

  if (mainView === 'success' && result) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
          <h1 className="text-xl font-bold text-foreground">{t('reservation.successTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('reservation.successSub')}</p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('reservation.comandaCode')}</p>
            <p className="text-2xl font-black font-mono text-primary mb-4">{result.short_code}</p>
            <div className="flex justify-center bg-card p-4 rounded-xl">
              <Barcode value={result.short_code} height={48} margin={0} displayValue={false} />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Mesa {result.table_number} ·{' '}
              {new Date(result.scheduled_at).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{t('reservation.saveScreen')}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={goBack}>
              {t('reservation.makeNew')}
            </Button>
            <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'} className="flex-1">
              <Button className="w-full">{t('reservation.backToMenu')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Tela inicial
  if (mainView === 'home') {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-foreground">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">{t('reservation.title')}</p>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <p className="text-muted-foreground mb-6 text-center">{t('reservation.chooseOption')}</p>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMainView('new')}
              className="w-full rounded-2xl border-2 border-border bg-card p-6 shadow-sm hover:bg-accent/50 transition-colors text-left flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{t('reservation.makeNew')}</h2>
                <p className="text-sm text-muted-foreground">{t('reservation.makeNewSub')}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMainView('my')}
              className="w-full rounded-2xl border-2 border-border bg-card p-6 shadow-sm hover:bg-accent/50 transition-colors text-left flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{t('reservation.myReservations')}</h2>
                <p className="text-sm text-muted-foreground">{t('reservation.myReservationsSub')}</p>
              </div>
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'} className="text-primary hover:underline">
              {t('reservation.backToMenu')}
            </Link>
          </p>
        </main>
      </div>
    );
  }

  // Minhas reservas — formulário ou listagem
  if (mainView === 'my') {
    if (myStep === 'form') {
      return (
        <div className="min-h-screen bg-background">
          <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
            <button type="button" onClick={goBack} className="p-1 -ml-1 rounded-lg hover:bg-primary/10 active:bg-primary/15 transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
            <h1 className="font-bold text-foreground">{t('reservation.myReservationsTitle')}</h1>
            <p className="text-xs text-muted-foreground">{t('reservation.myReservationsFormSub')}</p>
            </div>
          </header>

          <main className="max-w-md mx-auto px-4 py-6">
            <form onSubmit={handleFetchMyReservations} className="space-y-4">
              <div>
                <Label>{t('reservation.name')}</Label>
                <Input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder={t('reservation.nameOptional')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('reservation.whatsappRequired')}</Label>
                <PhoneCountryInput
                  value={myPhone}
                  country={myPhoneCountry}
                  onValueChange={(phone, country) => {
                    setMyPhone(phone);
                    setMyPhoneCountry(country);
                  }}
                  showWhatsAppIcon
                  className="mt-1"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={fetchingMy}>
                {fetchingMy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('reservation.searchMyReservations')}
              </Button>
            </form>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={() => setMyStep('form')} className="p-1 -ml-1 rounded-lg hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-bold text-foreground">{t('reservation.myReservationsTitle')}</h1>
            <p className="text-xs text-muted-foreground">{t('reservation.myReservationsListSub')}</p>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6 space-y-6">
          {myWaitingPosition && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{t('reservation.waitingPosition')}</h3>
              </div>
              <p className="text-2xl font-bold text-primary">#{myWaitingPosition.position}</p>
              <p className="text-sm text-muted-foreground">{t('reservation.waitingForTable')}</p>
            </div>
          )}

          {myReservations.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">{t('reservation.yourReservations')}</h3>
              {myReservations.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === 'activated' || r.status === 'completed'
                          ? 'bg-success/20 text-success'
                          : r.status === 'cancelled' || r.status === 'no_show'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {t(`reservation.status_${r.status}` as const) || r.status}
                    </span>
                    <span className="text-sm font-mono font-bold text-primary">{r.short_code}</span>
                  </div>
                  <p className="text-sm text-foreground font-medium">{r.customer_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mesa {r.table_number} ·{' '}
                    {new Date(r.scheduled_at).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                  <div className="mt-3 flex justify-center bg-background rounded-lg p-2">
                    <Barcode value={r.short_code} height={36} margin={0} displayValue={false} />
                  </div>
                  {canCancel(r) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={cancellingReservationId === r.id}
                      onClick={() => handleCancelReservation(r)}
                    >
                      {cancellingReservationId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      {t('reservation.cancelReservation')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : !myWaitingPosition ? (
            <p className="text-center text-muted-foreground py-8">{t('reservation.noReservationsFound')}</p>
          ) : null}

          {restaurant?.whatsapp && (
            <a
              href={generateWhatsAppLink(
                ensurePhoneForWhatsApp(restaurant.whatsapp, restaurant.phone_country ?? 'BR'),
                t('reservation.whatsappMessage')
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg border-2 border-[#25D366] bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 px-4 py-3 font-medium transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              {t('reservation.contactWhatsApp')}
            </a>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setMyStep('form')}>
              {t('reservation.newSearch')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={goBack}>
              {t('reservation.back')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Novo formulário
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={goBack} className="p-1 -ml-1 rounded-lg hover:bg-primary/10 active:bg-primary/15 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        {restaurant?.logo ? (
          <img src={restaurant.logo} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="font-bold text-foreground">{restaurant?.name}</h1>
          <p className="text-xs text-muted-foreground">{t('reservation.newReservation')}</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <form onSubmit={handleSubmitNew} className="space-y-4">
          <div>
            <Label>{t('reservation.name')} *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('checkout.namePlaceholder')}
              required
              className="mt-1 transition-colors hover:border-primary/40 focus-visible:border-primary"
            />
          </div>
          <div>
            <Label>WhatsApp / Telefone</Label>
            <PhoneCountryInput
              value={customerPhone}
              country={customerPhoneCountry}
              onValueChange={(phone, country) => {
                setCustomerPhone(phone);
                setCustomerPhoneCountry(country);
              }}
              showWhatsAppIcon
              className="mt-1 [&_input]:transition-colors [&_input]:hover:border-primary/40 [&_input]:focus-visible:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reservation-date">{t('reservation.date')}</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus(); } }}
                className="relative mt-1 min-h-[48px] w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm text-left ring-offset-background transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer touch-manipulation"
              >
                <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className={scheduledDate ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  {scheduledDate
                    ? format(new Date(scheduledDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: dateLocale })
                    : t('reservation.selectDatePlaceholder')}
                </span>
                <input
                  id="reservation-date"
                  ref={dateInputRef}
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val < today) return;
                    setScheduledDate(val);
                  }}
                  min={today}
                  required
                  aria-label={t('reservation.date')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reservation-time">{t('reservation.time')}</Label>
              {reservationTimeSlots ? (
                <Select
                  value={scheduledTime || undefined}
                  onValueChange={(v) => { setScheduledTime(v); setError(''); }}
                >
                  <SelectTrigger
                    id="reservation-time"
                    className="mt-1 min-h-[48px] flex items-center gap-2 [&>span]:flex [&>span]:items-center [&>span]:gap-2"
                  >
                    <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    <SelectValue placeholder={t('reservation.selectTimePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {reservationTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => timeInputRef.current?.showPicker?.() ?? timeInputRef.current?.focus()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); timeInputRef.current?.showPicker?.() ?? timeInputRef.current?.focus(); } }}
                  className="relative mt-1 min-h-[48px] w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm text-left ring-offset-background transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer touch-manipulation"
                >
                  <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className={scheduledTime ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    {scheduledTime || t('reservation.selectTimePlaceholder')}
                  </span>
                  <input
                    id="reservation-time"
                    ref={timeInputRef}
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => { setScheduledTime(e.target.value); setError(''); }}
                    required
                    aria-label={t('reservation.time')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}
            </div>
          </div>
          {scheduledDate && scheduledTime && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground -mt-1">
              <CalendarClock className="h-4 w-4 text-primary shrink-0" />
              {format(new Date(scheduledDate + 'T' + scheduledTime), "EEEE dd/MM · HH:mm", { locale: dateLocale })}
            </p>
          )}
          <div>
            <Label>{t('reservation.sector')}</Label>
            <button
              type="button"
              onClick={() => setZoneModalOpen(true)}
              className="mt-1 w-full min-h-[44px] flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm text-left ring-offset-background transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            >
              <span className={selectedZone ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {selectedZone
                  ? selectedZone.zone_name
                  : t('reservation.selectSectorPlaceholder')}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
            </button>
            {!scheduledDate || !scheduledTime ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('reservation.sectorAvailabilityAfterDateTime')}
              </p>
            ) : null}
            {zones.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">{t('reservation.noZonesAvailable')}</p>
            )}

            <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
              <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-xl">
                <DialogHeader>
                  <DialogTitle>{t('reservation.selectSectorModalTitle')}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{t('reservation.selectSectorModalSub')}</p>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {zones.map((zone) => {
                    const hasAvailabilityInfo = Boolean(scheduledDate && scheduledTime);
                    const isFull = hasAvailabilityInfo && (!zone.available_table_ids || zone.available_table_ids.length === 0);
                    return (
                      <button
                        key={zone.hall_zone_id}
                        type="button"
                        disabled={isFull}
                        onClick={() => {
                          if (!isFull) {
                            setSelectedZone(zone);
                            setZoneModalOpen(false);
                          }
                        }}
                        className={`relative rounded-2xl overflow-hidden border-2 text-left transition-all ${
                          isFull
                            ? 'opacity-60 cursor-not-allowed border-muted bg-muted/30'
                            : 'border-border hover:border-primary/50 hover:bg-accent/50 active:scale-[0.98]'
                        }`}
                      >
                        <div className="p-2 pt-2">
                          <div className="aspect-video w-full bg-muted rounded-2xl overflow-hidden">
                            {zone.image_url ? (
                              <img
                                src={zone.image_url}
                                alt={zone.zone_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                <Users className="h-10 w-10 text-primary/50" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-3 pb-3 pt-0">
                          <p className="font-semibold text-foreground">{zone.zone_name}</p>
                          {isFull && (
                            <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                              {t('reservation.lotado')}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            <Label>{t('reservation.notes')}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('reservation.notesPlaceholder')}
              className="transition-colors hover:border-primary/40 focus-visible:border-primary"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full hover:brightness-105 active:scale-[0.99] transition-all"
            disabled={submitting || !selectedZone || (selectedZone.available_table_ids?.length ?? 0) === 0}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('reservation.confirmReservation')}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link
            to={restaurantSlug ? `/${restaurantSlug}` : '/'}
            className="text-primary hover:text-primary/90 hover:underline transition-colors"
          >
            {t('reservation.backToMenu')}
          </Link>
        </p>
      </main>
    </div>
  );
}
