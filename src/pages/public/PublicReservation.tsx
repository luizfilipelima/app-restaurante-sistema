/**
 * Reserva Pública — Fase 2
 * Cliente faz reserva e recebe comanda digital com código de barras para bipar na chegada.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Barcode from 'react-barcode';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, CalendarClock, AlertCircle } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo: string | null;
}

interface TableOption {
  table_id: string;
  table_number: number;
  zone_name: string;
}

type Step = 'form' | 'success';

interface PublicReservationProps {
  tenantSlug?: string;
}

export default function PublicReservation({ tenantSlug: slugFromLayout }: PublicReservationProps = {}) {
  const { restaurantSlug: slugFromParams } = useParams<{ restaurantSlug: string }>();
  const restaurantSlug = slugFromLayout ?? slugFromParams;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [tables, setTables] = useState<TableOption[]>([]);
  const [result, setResult] = useState<{ short_code: string; table_number: string; scheduled_at: string } | null>(null);

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

  useEffect(() => {
    if (!restaurantSlug || !scheduledDate || !scheduledTime) {
      setTables([]);
      return;
    }
    const dt = `${scheduledDate}T${scheduledTime}:00`;
    supabase
      .rpc('get_available_tables_for_reservation', {
        p_restaurant_slug: restaurantSlug,
        p_scheduled_at: dt,
      })
      .then(({ data, error: tblErr }) => {
        if (tblErr) {
          setTables([]);
          setTableId('');
          return;
        }
        const list = (data ?? []) as TableOption[];
        setTables(list);
        setTableId((prev) => {
          const exists = list.some((t) => t.table_id === prev);
          return list.length > 0 && !exists ? list[0]!.table_id : prev;
        });
      });
  }, [restaurantSlug, scheduledDate, scheduledTime]);

  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantSlug || !tableId || !customerName.trim() || !scheduledDate || !scheduledTime) {
      setError('Preencha nome, data, horário e mesa.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const dt = `${scheduledDate}T${scheduledTime}:00`;
      const { data, error: rpcErr } = await supabase.rpc('create_reservation_by_slug', {
        p_restaurant_slug: restaurantSlug,
        p_table_id: tableId,
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim() || null,
        p_scheduled_at: dt,
        p_late_tolerance_mins: 15,
        p_notes: notes.trim() || null,
      });
      if (rpcErr) {
        setError(rpcErr.message ?? 'Erro ao criar reserva.');
        return;
      }
      const res = data as { short_code: string; table_number: string; scheduled_at: string };
      setResult(res);
      setStep('success');
    } catch {
      setError('Erro ao criar reserva.');
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

  if (!restaurant || error && step === 'form') {
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

  if (step === 'success' && result) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reserva confirmada!</h1>
            <p className="text-slate-600 mt-1">
              Apresente o código abaixo na recepção ao chegar.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Código da comanda</p>
            <p className="text-2xl font-black font-mono text-[#F87116] mb-4">{result.short_code}</p>
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <Barcode value={result.short_code} height={48} margin={0} displayValue={false} />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Mesa {result.table_number} · {new Date(result.scheduled_at).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Guarde esta tela ou tire um print. O código será bipado na recepção.
          </p>
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
            <CalendarClock className="h-5 w-5 text-white" />
          </div>
        )}
        <div>
          <h1 className="font-bold text-slate-900">{restaurant?.name}</h1>
          <p className="text-xs text-slate-500">Fazer reserva</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
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
            <Label>WhatsApp / Telefone</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              type="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={today}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Horário *</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Mesa *</Label>
            <Select value={tableId} onValueChange={setTableId} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a mesa" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.table_id} value={t.table_id}>
                    Mesa {t.table_number}
                    {t.zone_name ? ` — ${t.zone_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tables.length === 0 && scheduledDate && scheduledTime && (
              <p className="text-xs text-amber-600 mt-1">Nenhuma mesa disponível nesta data. Tente outro horário.</p>
            )}
          </div>
          <div>
            <Label>Observações</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Aniversariante, sem glúten..."
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting || tables.length === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar reserva
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
