/**
 * Horários de Funcionamento — Página independente
 *
 * Configuração completa e intuitiva de abertura/fechamento por dia,
 * sempre aberto 24h e fechamento manual.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { supabase } from '@/lib/supabase';
import type { DayKey } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { invalidatePublicMenuCache } from '@/lib/invalidatePublicCache';
import { Clock, Sun, XCircle, Loader2, Save, CheckCircle2 } from 'lucide-react';

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

export default function AdminHorarios() {
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
    }
    setLoading(false);
  }, [restaurant?.id, restaurant?.always_open, restaurant?.is_manually_closed, restaurant?.opening_hours]);

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
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#F87116]" />
        <p className="text-sm text-slate-500">Carregando horários…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 p-6 sm:p-8 text-white shadow-xl"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Horários de Funcionamento</h1>
          </div>
          <p className="text-sm sm:text-base text-white/90 max-w-xl">
            Defina quando seu estabelecimento está aberto. Essas informações aparecem no cardápio e nas buscas.
          </p>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2)_0%,_transparent_50%)]" />
      </motion.div>

      {/* ── Status rápido ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div
          className={`rounded-xl border-2 p-4 flex items-center justify-between gap-4 transition-all ${
            alwaysOpen
              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                alwaysOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Sempre aberto (24h)</p>
              <p className="text-xs text-slate-500 mt-0.5">Ignora os horários por dia da semana.</p>
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
              ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                isManuallyClosed ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Fechado agora (manual)</p>
              <p className="text-xs text-slate-500 mt-0.5">Força status fechado independente do horário.</p>
            </div>
          </div>
          <Switch
            checked={isManuallyClosed}
            onCheckedChange={setIsManuallyClosed}
            className="data-[state=checked]:bg-amber-500 shrink-0"
          />
        </div>
      </motion.div>

      {/* ── Grade de horários ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <Clock className="h-[18px] w-[18px] text-sky-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Horários por dia da semana</h2>
              <p className="text-xs text-slate-500">
                {alwaysOpen
                  ? 'Ignorados — estabelecimento definido como sempre aberto.'
                  : 'Defina abertura e fechamento para cada dia.'}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`p-5 space-y-2 ${alwaysOpen ? 'opacity-50 pointer-events-none select-none' : ''}`}
        >
          {DAYS.map(({ key, label, short }) => {
            const slot = openingHours[key];
            const isClosed = !slot;
            return (
              <div
                key={key}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border transition-colors ${
                  isClosed
                    ? 'bg-slate-50/80 border-slate-100'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="w-24 sm:w-32 shrink-0">
                  <span className={`text-sm font-medium ${isClosed ? 'text-slate-400' : 'text-slate-700'}`}>
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
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${
                      isClosed ? 'text-slate-400' : 'text-emerald-600'
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
                        setDay(key, {
                          open: e.target.value,
                          close: slot?.close || '23:00',
                        });
                      }}
                      className="h-9 w-28 text-sm text-center font-medium"
                    />
                    <span className="text-slate-400 font-medium">–</span>
                    <Input
                      type="time"
                      value={slot?.close || '23:00'}
                      onChange={(e) => {
                        setDay(key, {
                          open: slot?.open || '11:00',
                          close: e.target.value,
                        });
                      }}
                      className="h-9 w-28 text-sm text-center font-medium"
                    />
                  </div>
                )}

                {isClosed && (
                  <span className="ml-auto text-xs text-slate-400 italic">Sem atendimento</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-sky-600 hover:bg-sky-700"
          >
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
      </motion.div>
    </div>
  );
}
