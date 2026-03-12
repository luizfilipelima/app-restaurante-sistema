/**
 * Hook para pedidos prontos (status 'ready') — usado na Expedição do Terminal do Garçom.
 * Inclui Realtime e ação de marcar entregue.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/core/supabase';
import { toast } from '@/hooks/shared/use-toast';

export interface ExpoOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  observations?: string | null;
  pizza_size?: string | null;
  pizza_flavors?: string[] | null;
  pizza_dough?: string | null;
  pizza_edge?: string | null;
  addons?: Array<{ addonItemId: string; name: string; price: number }> | null;
}

export interface ExpoOrder {
  id: string;
  restaurant_id: string;
  customer_name: string;
  order_source?: string | null;
  table_id?: string | null;
  /** Número da mesa e zona (via join tables). Usado para exibir "Mesa X" e filtrar por zona do garçom. */
  tables?: { number: number; hall_zone_id?: string | null } | null;
  notes?: string | null;
  status: string;
  updated_at: string;
  ready_at?: string | null;
  accepted_at?: string | null;
  order_items: ExpoOrderItem[];
}

export interface UseReadyOrdersOptions {
  /** Quando fornecido, só dispara toast de "pronto" para pedidos cuja mesa está no set. */
  tableIdsForNotification?: Set<string> | null;
}

export function useReadyOrders(restaurantId: string | null, options?: UseReadyOrdersOptions) {
  const { tableIdsForNotification } = options ?? {};
  const [orders, setOrders] = useState<ExpoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, restaurant_id, customer_name, order_source, table_id, notes,
          status, updated_at, ready_at, accepted_at, delivered_at,
          tables(number, hall_zone_id),
          order_items(id, product_name, quantity, observations,
            pizza_size, pizza_flavors, pizza_dough, pizza_edge, addons)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ready')
        .order('ready_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      const raw = data ?? [];
      const normalized = raw.map((o: any) => ({
        ...o,
        tables: Array.isArray(o.tables) ? o.tables[0] : o.tables,
      }));
      const sorted = [...normalized].sort((a, b) => {
        const ta = new Date((a.ready_at || a.updated_at)).getTime();
        const tb = new Date((b.ready_at || b.updated_at)).getTime();
        return ta - tb;
      });
      setOrders(sorted as ExpoOrder[]);
    } catch (err) {
      console.error('useReadyOrders: erro ao carregar', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    loadOrders();

    const channel = supabase
      .channel(`ready-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status;
          const oldStatus = (payload.old as { status?: string })?.status;
          if (newStatus === 'ready' && oldStatus !== 'ready') {
            const tableId = (payload.new as { table_id?: string })?.table_id;
            const shouldNotify =
              !tableIdsForNotification ||
              (tableId != null && tableIdsForNotification.has(tableId));
            if (shouldNotify) {
              const orderName = (payload.new as { customer_name?: string })?.customer_name || 'Pedido';
              toast({
                title: '🔔 Pronto para entrega!',
                description: `${orderName} está aguardando no balcão`,
                className: 'bg-emerald-600 text-white border-none',
              });
            }
          }
          loadOrders();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, loadOrders, tableIdsForNotification]);

  const handleDeliver = useCallback(async (order: ExpoOrder) => {
    setDelivering(order.id);
    try {
      const isTableOrComanda =
        order.order_source === 'table' ||
        order.order_source === 'comanda' ||
        !!order.table_id;
      const nextStatus = isTableOrComanda ? 'completed' : 'delivering';

      const { error } = await supabase
        .from('orders')
        .update({
          status: nextStatus,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      if (nextStatus === 'delivering') {
        import('@/lib/whatsapp/notifyOrderStatusWhatsApp').then(({ notifyOrderStatusWhatsApp }) =>
          notifyOrderStatusWhatsApp(order.id, 'delivering')
        ).catch(() => {});
      }

      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast({
        title: '✅ Entregue!',
        description: isTableOrComanda
          ? `Pedido ${order.customer_name || ''} marcado como concluído.`
          : 'Pedido enviado para entrega.',
      });
    } catch (err) {
      console.error('useReadyOrders: erro ao marcar entregue', err);
      toast({ title: 'Erro ao marcar como entregue', variant: 'destructive' });
      loadOrders();
    } finally {
      setDelivering(null);
    }
  }, [loadOrders]);

  return { orders, loading, delivering, handleDeliver, count: orders.length };
}
