import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { Table, WaiterCall } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getCardapioPublicUrl } from '@/lib/utils';
import { Plus, Trash2, Utensils, Bell, Copy, Check, Loader2 } from 'lucide-react';

export default function AdminTables() {
  const restaurantId = useAdminRestaurantId();
  const { restaurant } = useAdminRestaurant();
  const [tables, setTables] = useState<Table[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formNumber, setFormNumber] = useState('');
  const [attendingCallId, setAttendingCallId] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      loadTables();
      loadWaiterCalls();
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('waiter-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waiter_calls',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          loadWaiterCalls();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const loadTables = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('order_index', { ascending: true })
        .order('number', { ascending: true });
      if (error) throw error;
      setTables(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao carregar mesas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadWaiterCalls = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('waiter_calls')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setWaiterCalls(data || []);
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !formNumber.trim()) return;
    const num = parseInt(formNumber, 10);
    if (Number.isNaN(num) || num < 1) {
      toast({ title: 'Número inválido', variant: 'destructive' });
      return;
    }
    const exists = tables.some((t) => t.number === num);
    if (exists) {
      toast({ title: 'Já existe mesa com este número', variant: 'destructive' });
      return;
    }
    try {
      const nextOrder = tables.length;
      const { error } = await supabase.from('tables').insert({
        restaurant_id: restaurantId,
        number: num,
        order_index: nextOrder,
        is_active: true,
      });
      if (error) throw error;
      setFormNumber('');
      setShowForm(false);
      loadTables();
      toast({ title: 'Mesa adicionada!' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao adicionar mesa', variant: 'destructive' });
    }
  };

  const deleteTable = async (table: Table) => {
    if (!confirm(`Excluir mesa ${table.number}? Pedidos associados não serão removidos.`)) return;
    try {
      const { error } = await supabase.from('tables').delete().eq('id', table.id).eq('restaurant_id', restaurantId!);
      if (error) throw error;
      loadTables();
      toast({ title: 'Mesa excluída!' });
    } catch (e) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const markCallAttended = async (callId: string) => {
    try {
      setAttendingCallId(callId);
      const { error } = await supabase
        .from('waiter_calls')
        .update({ status: 'attended', attended_at: new Date().toISOString() })
        .eq('id', callId);
      if (error) throw error;
      loadWaiterCalls();
      toast({ title: 'Chamado atendido!' });
    } catch (e) {
      toast({ title: 'Erro', variant: 'destructive' });
    } finally {
      setAttendingCallId(null);
    }
  };

  const copyTableLink = (tableNumber: number) => {
    const slug = restaurant?.slug || '';
    if (!slug) {
      toast({ title: 'Slug do restaurante não disponível', variant: 'destructive' });
      return;
    }
    const base = getCardapioPublicUrl(slug);
    const url = base.endsWith('/') ? `${base}cardapio/${tableNumber}` : `${base}/cardapio/${tableNumber}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: 'Link copiado!' }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const pendingCalls = waiterCalls.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mesas</h1>
        <p className="text-muted-foreground">
          Gerencie as mesas e pedidos feitos no local físico. Cada mesa tem um cardápio interativo.
        </p>
      </div>

      {/* Chamados de Garçom */}
      {pendingCalls.length > 0 && (
        <div className="admin-card p-6 border-amber-200 bg-amber-50/30">
          <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Chamados de Garçom ({pendingCalls.length})
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Mesas que solicitaram atendimento no cardápio digital
          </p>
          <div>
            <div className="flex flex-wrap gap-3">
              {pendingCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-white dark:bg-slate-900 dark:border-amber-800 p-4"
                >
                  <span className="text-lg font-bold">Mesa {call.table_number}</span>
                  <Button
                    size="sm"
                    onClick={() => markCallAttended(call.id)}
                    disabled={attendingCallId === call.id}
                  >
                    {attendingCallId === call.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Atendido
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Mesas */}
      <div className="admin-card overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Mesas cadastradas</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Adicione mesas e compartilhe o link do cardápio para cada uma
              </p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova mesa
            </Button>
          </div>
        </div>
        <div className="px-6 pb-6 space-y-4">
          {showForm && (
            <form onSubmit={handleAddTable} className="flex gap-2 p-4 rounded-lg border bg-muted/30">
              <div className="flex-1">
                <Label htmlFor="table_number">Número da mesa</Label>
                <Input
                  id="table_number"
                  type="number"
                  min={1}
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="Ex: 1, 2, 5"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={!formNumber.trim()}>
                  Adicionar
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setFormNumber(''); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {tables.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma mesa cadastrada. Adicione uma mesa para começar.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    table.is_active ? 'border-border' : 'opacity-60 border-dashed'
                  }`}
                >
                  <div>
                    <p className="font-semibold">Mesa {table.number}</p>
                    <p className="text-xs text-muted-foreground">Cardápio interativo</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyTableLink(table.number)}
                      title="Copiar link do cardápio"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      asChild
                      title="Abrir cardápio"
                    >
                      <a
                        href={restaurant?.slug ? `${getCardapioPublicUrl(restaurant.slug)}/cardapio/${table.number}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={!restaurant?.slug ? 'pointer-events-none opacity-50' : ''}
                      >
                        <Utensils className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteTable(table)}
                      title="Excluir mesa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
