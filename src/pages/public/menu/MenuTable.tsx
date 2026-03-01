import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/core/supabase';
import { getSubdomain } from '@/lib/core/subdomain';
import PublicMenu from './Menu';
import { useTableOrderStore } from '@/store/tableOrderStore';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/hooks/shared/use-toast';
import { Loader2 } from 'lucide-react';

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
  const { setTable, clearTable, clearTableStorage } = useTableOrderStore();
  const clearCart = useCartStore((s) => s.clearCart);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAndClearIfTableReset = useCallback(async (tableId: string) => {
    try {
      const { data: available } = await supabase.rpc('is_table_available_for_new_session', {
        p_table_id: tableId,
      });
      if (available === true) {
        clearTableStorage(tableId);
        clearCart();
        const { tableId: currentId, tableNumber } = useTableOrderStore.getState();
        if (currentId === tableId && tableNumber != null) {
          setTable(tableId, tableNumber, { skipLoadFromStorage: true });
        }
      }
    } catch {
      /* ignore */
    }
  }, [clearTableStorage, clearCart, setTable]);

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
          const { data: available } = await supabase.rpc('is_table_available_for_new_session', {
            p_table_id: table.id,
          });
          const isFresh = available === true;
          if (isFresh) {
            clearTableStorage(table.id);
            setTable(table.id, table.number, { skipLoadFromStorage: true });
          } else {
            setTable(table.id, table.number);
            const { tableCustomerName } = useTableOrderStore.getState();
            if (!tableCustomerName?.trim()) {
              const { data } = await supabase.rpc('get_reservation_customer_for_table', {
                p_table_id: table.id,
              });
              const name = data?.customer_name;
              if (name?.trim()) {
                useTableOrderStore.getState().setTableCustomerName(name.trim());
              }
            }
          }
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

  useEffect(() => {
    if (!tableFound?.id) return;
    const tableId = tableFound.id;

    const onTableRelatedChange = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        checkAndClearIfTableReset(tableId);
      }, 600);
    };

    const ch = supabase
      .channel(`menu-table-reset-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` }, onTableRelatedChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `table_id=eq.${tableId}` }, onTableRelatedChange)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [tableFound?.id, checkAndClearIfTableReset]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tableFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-center text-muted-foreground">Mesa não encontrada. Verifique o número.</p>
      </div>
    );
  }

  return (
    <PublicMenu
      tenantSlug={restaurantSlug ?? undefined}
      tableId={tableFound.id}
      tableNumber={tableFound.number}
      onCallWaiter={handleCallWaiter}
      callingWaiter={callingWaiter}
    />
  );
}
