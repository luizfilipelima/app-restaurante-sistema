/**
 * Fila de Espera Pública — Fase 3
 * Cliente entra na fila (nome, WhatsApp) sem reserva.
 * Será notificado quando uma mesa estiver disponível.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Users, AlertCircle } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
}

type Step = 'form' | 'success';

interface PublicWaitingQueueProps {
  tenantSlug?: string;
}

export default function PublicWaitingQueue({ tenantSlug: slugFromLayout }: PublicWaitingQueueProps = {}) {
  const { restaurantSlug: slugFromParams } = useParams<{ restaurantSlug: string }>();
  const restaurantSlug = slugFromLayout ?? slugFromParams;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!restaurantSlug) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rest, error: restErr } = await supabase
          .from('restaurants')
          .select('id, name, logo')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        if (restErr || !rest) {
          setError('Restaurante não encontrado.');
          return;
        }
        setRestaurant(rest);
      } catch {
        setError('Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !customerName.trim()) {
      setError('Informe seu nome.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('add_to_waiting_queue_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim() || null,
      });
      if (rpcErr) {
        setError(rpcErr.message ?? 'Erro ao entrar na fila.');
        return;
      }
      const res = data as { id: string; position: number };
      setPosition(res.position);
      setStep('success');
    } catch {
      setError('Erro ao entrar na fila.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#F87116]" />
        <p className="text-sm text-slate-500">Carregando…</p>
      </div>
    );
  }

  if (!restaurant || (error && step === 'form')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-slate-50">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-slate-700">{error ?? 'Restaurante não encontrado.'}</p>
        <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'}>
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Você entrou na fila!</h1>
            <p className="text-slate-600 mt-1">
              {position !== null && (
                <>Sua posição: <strong>#{position}</strong></>
              )}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm text-left">
            <p className="text-sm text-slate-600">
              Quando uma mesa estiver disponível, você será avisado.
              {customerPhone && (
                <> Enviaremos uma mensagem no WhatsApp informado.</>
              )}
            </p>
            {!customerPhone && (
              <p className="text-xs text-amber-600 mt-2">
                Você não informou WhatsApp. Fique atento ao seu nome na recepção.
              </p>
            )}
          </div>
          <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'}>
            <Button className="w-full">Ir para o cardápio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        {restaurant?.logo ? (
          <img src={restaurant.logo} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#F87116] to-orange-600 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
        )}
        <div>
          <h1 className="font-bold text-slate-900">{restaurant?.name}</h1>
          <p className="text-xs text-slate-500">Fila de espera</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <p className="text-sm text-slate-600 mb-6">
          Sem reserva? Informe seu nome e WhatsApp para entrar na fila. Avisaremos quando uma mesa estiver livre.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>WhatsApp (para aviso quando a mesa estiver pronta)</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              type="tel"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Entrar na fila
          </Button>
        </form>
        <p className="text-center text-xs text-slate-500 mt-6">
          <Link to={restaurantSlug ? `/${restaurantSlug}` : '/'} className="text-[#F87116] hover:underline">
            Voltar ao cardápio
          </Link>
        </p>
      </main>
    </div>
  );
}
