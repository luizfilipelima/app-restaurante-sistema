import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getSubdomain } from '@/lib/subdomain';
import { Button } from '@/components/ui/button';
import PublicMenu from './Menu';
import { useTableOrderStore } from '@/store/tableOrderStore';
import { toast } from '@/hooks/use-toast';
import { Bell, Loader2 } from 'lucide-react';

interface MenuTableProps {
  tenantSlug?: string;
}

export default function MenuTable({ tenantSlug: tenantSlugProp }: MenuTableProps) {
  const params = useParams<{ restaurantSlug?: string; tableNumber: string }>();
  const subdomain = getSubdomain();
  const restaurantSlug =
    tenantSlugProp ??
    params.restaurantSlug ??
    (subdomain && !['app', 'www', 'localhost'].includes(subdomain) ? subdomain : null);

  const tableNum = parseInt(params.tableNumber || '0', 10);
  const [loading, setLoading] = useState(true);
  const [tableFound, setTableFound] = useState<{ id: string; number: number } | null>(null);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const { setTable, clearTable } = useTableOrderStore();

  useEffect(() => {
    if (!restaurantSlug || Number.isNaN(tableNum) || tableNum < 1) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', restaurantSlug)
          .eq('is_active', true)
          .single();
        if (!restaurant) {
          setTableFound(null);
          return;
        }

        const { data: table } = await supabase
          .from('tables')
          .select('id, number')
          .eq('restaurant_id', restaurant.id)
          .eq('number', tableNum)
          .eq('is_active', true)
          .single();

        if (table) {
          setTableFound({ id: table.id, number: table.number });
          setTable(table.id, table.number);
        } else {
          setTableFound(null);
        }
      } catch {
        setTableFound(null);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => clearTable();
  }, [restaurantSlug, tableNum]);

  const handleCallWaiter = async () => {
    if (!tableFound) return;
    setCallingWaiter(true);
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', restaurantSlug)
        .eq('is_active', true)
        .single();
      if (!restaurant) {
        toast({ title: 'Restaurante não encontrado', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('waiter_calls').insert({
        restaurant_id: restaurant.id,
        table_id: tableFound.id,
        table_number: tableFound.number,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Garçom chamado!', description: 'A equipe foi notificada e logo estará aí.' });
    } catch {
      toast({ title: 'Erro ao chamar garçom', variant: 'destructive' });
    } finally {
      setCallingWaiter(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!tableFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <p className="text-center text-slate-600">Mesa não encontrada. Verifique o número.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <PublicMenu tenantSlug={restaurantSlug ?? undefined} tableId={tableFound.id} tableNumber={tableFound.number} />
      {/* Botão flutuante Chamar Garçom */}
      <div
        className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Button
          size="lg"
          variant="outline"
          className="rounded-full h-14 w-14 md:h-16 md:w-16 shadow-lg bg-white hover:bg-amber-50 border-amber-300 hover:border-amber-400"
          onClick={handleCallWaiter}
          disabled={callingWaiter}
          title="Chamar garçom"
        >
          {callingWaiter ? (
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          ) : (
            <Bell className="h-6 w-6 text-amber-600" />
          )}
        </Button>
      </div>
    </div>
  );
}
