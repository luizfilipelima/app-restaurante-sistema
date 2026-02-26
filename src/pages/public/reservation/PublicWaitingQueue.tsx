/**
 * Fila de Espera Pública — Redesign
 * Tela inicial: "Entrar na fila" e "Ver minha posição".
 * Entrar na fila: formulário nome + WhatsApp → confirmação com posição.
 * Ver posição: formulário nome + WhatsApp → mostra posição na fila ou "não encontrado".
 * Visual alinhado às reservas e Link Bio.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Users, AlertCircle, UserPlus, Search, ArrowLeft } from 'lucide-react';
import { normalizePhoneWithCountryCode } from '@/lib/core/utils';
import { PhoneCountryInput } from '@/components/ui/PhoneCountryInput';

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
  phone_country?: 'BR' | 'PY' | 'AR' | null;
}

type MainView = 'home' | 'enter' | 'position' | 'success';

interface PublicWaitingQueueProps {
  tenantSlug?: string;
}

export default function PublicWaitingQueue({ tenantSlug: slugFromLayout }: PublicWaitingQueueProps = {}) {
  const { t } = useTranslation();
  const { restaurantSlug: slugFromParams } = useParams<{ restaurantSlug: string }>();
  const restaurantSlug = slugFromLayout ?? slugFromParams;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>('home');

  // Entrar na fila
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoneCountry, setCustomerPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  // Ver posição
  const [myName, setMyName] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [myPhoneCountry, setMyPhoneCountry] = useState<'BR' | 'PY' | 'AR'>('BR');
  const [positionResult, setPositionResult] = useState<{
    id: string;
    position: number;
    customer_name: string;
    status: string;
  } | null>(null);
  const [fetchingPosition, setFetchingPosition] = useState(false);
  const [hasPositionSearched, setHasPositionSearched] = useState(false);

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
          .select('id, name, logo, phone_country')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        if (restErr || !rest) {
          setError(t('reservation.restaurantNotFound'));
          return;
        }
        setRestaurant(rest);
      } catch {
        setError(t('reservation.restaurantNotFound'));
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantSlug]);

  const handleEnterQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !customerName.trim()) {
      setError(t('queue.errorName'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const phoneVal = customerPhone.trim();
      const phoneNormalized = phoneVal ? normalizePhoneWithCountryCode(phoneVal, customerPhoneCountry) : null;
      const { data, error: rpcErr } = await supabase.rpc('add_to_waiting_queue_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_customer_name: customerName.trim(),
        p_customer_phone: phoneNormalized,
      });
      if (rpcErr) {
        setError(rpcErr.message ?? t('queue.errorEnter'));
        return;
      }
      const res = data as { id: string; position: number };
      setPosition(res.position);
      setMainView('success');
    } catch {
      setError(t('queue.errorEnter'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !myPhone.trim()) {
      setError(t('queue.errorPhone'));
      return;
    }
    setFetchingPosition(true);
    setError(null);
    setPositionResult(null);
    setHasPositionSearched(false);
    try {
      const phoneNormalized = normalizePhoneWithCountryCode(myPhone.trim(), myPhoneCountry);
      const { data, error: rpcErr } = await supabase.rpc('get_my_waiting_position_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_customer_phone: phoneNormalized,
      });
      if (rpcErr) {
        setError(t('queue.errorSearch'));
        return;
      }
      setPositionResult(
        data && typeof data === 'object' && data.position != null
          ? (data as { id: string; position: number; customer_name: string; status: string })
          : null
      );
      setHasPositionSearched(true);
    } catch {
      setError(t('queue.errorSearch'));
    } finally {
      setFetchingPosition(false);
    }
  };

  const goBack = () => {
    setMainView('home');
    setError(null);
    setPositionResult(null);
    setHasPositionSearched(false);
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

  if (mainView === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('queue.successTitle')}</h1>
            <p className="text-muted-foreground mt-1">
              {position !== null && (
                <>
                  {t('queue.positionLabel')} <strong className="text-primary">#{position}</strong>
                </>
              )}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm text-left">
            <p className="text-sm text-muted-foreground">
              {t('queue.notifyWhenReady')}
              {customerPhone && ` ${t('queue.whatsappNotify')}`}
            </p>
            {!customerPhone && (
              <p className="text-xs text-amber-600 mt-2">{t('queue.noWhatsappNotice')}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={goBack}>
              {t('reservation.back')}
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
              <Users className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-foreground">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">{t('queue.title')}</p>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <p className="text-sm text-muted-foreground mb-6 text-center">{t('queue.intro')}</p>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMainView('enter')}
              className="w-full rounded-2xl border-2 border-border bg-card p-6 shadow-sm hover:bg-accent/50 transition-colors text-left flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{t('queue.enterQueue')}</h2>
                <p className="text-sm text-muted-foreground">{t('queue.enterQueueSub')}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMainView('position')}
              className="w-full rounded-2xl border-2 border-border bg-card p-6 shadow-sm hover:bg-accent/50 transition-colors text-left flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{t('queue.seePosition')}</h2>
                <p className="text-sm text-muted-foreground">{t('queue.seePositionSub')}</p>
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

  // Entrar na fila — formulário
  if (mainView === 'enter') {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={goBack} className="p-1 -ml-1 rounded-lg hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-bold text-foreground">{t('queue.enterQueue')}</h1>
            <p className="text-xs text-muted-foreground">{t('queue.enterFormSub')}</p>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          <p className="text-sm text-muted-foreground mb-6">{t('queue.enterFormIntro')}</p>
          <form onSubmit={handleEnterQueue} className="space-y-4">
            <div>
              <Label>{t('reservation.name')} *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('queue.whatsappForNotice')}</Label>
              <PhoneCountryInput
                value={customerPhone}
                country={customerPhoneCountry}
                onValueChange={(phone, country) => {
                  setCustomerPhone(phone);
                  setCustomerPhoneCountry(country);
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('queue.enterQueueButton')}
            </Button>
          </form>
        </main>
      </div>
    );
  }

  // Ver posição — formulário e resultado
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={goBack} className="p-1 -ml-1 rounded-lg hover:bg-accent">
          <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
            <h1 className="font-bold text-foreground">{t('queue.seePositionTitle')}</h1>
            <p className="text-xs text-muted-foreground">{t('queue.seePositionFormSub')}</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <form onSubmit={handleFetchPosition} className="space-y-4">
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
          <Button type="submit" className="w-full" disabled={fetchingPosition}>
            {fetchingPosition ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('queue.searchPosition')}
          </Button>
        </form>

        {positionResult && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">{t('queue.positionInQueue')}</p>
            <p className="text-3xl font-bold text-primary">#{positionResult.position}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('reservation.waitingForTable')}</p>
          </div>
        )}

        {hasPositionSearched && !positionResult && (
          <p className="text-center text-muted-foreground py-4">
            {t('queue.noPositionFound')}
          </p>
        )}

        <Button variant="outline" className="w-full" onClick={goBack}>
          {t('reservation.back')}
        </Button>
      </main>
    </div>
  );
}
