import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { offlineDB } from '@/lib/offline-db';
import { toast } from '@/hooks/use-toast';

type SyncStatus = 'online' | 'offline' | 'syncing';

export function useOfflineSync(restaurantId: string) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(navigator.onLine ? 'online' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);

  // Verificar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      syncPendingItems();
    };
    
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [restaurantId]);

  // Contar itens pendentes
  useEffect(() => {
    const updatePendingCount = async () => {
      const queue = await offlineDB.syncQueue.toArray();
      setPendingCount(queue.length);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sincronizar itens pendentes
  const syncPendingItems = useCallback(async () => {
    if (!navigator.onLine || !restaurantId) return;

    try {
      setSyncStatus('syncing');
      const queue = await offlineDB.syncQueue.orderBy('timestamp').toArray();

      for (const item of queue) {
        try {
          if (item.type === 'comanda' && item.action === 'create') {
            const { data, error } = await supabase
              .from('comandas')
              .insert({
                restaurant_id: restaurantId,
                number: item.data.number,
                status: item.data.status,
                total_amount: item.data.total_amount,
                opened_at: item.data.opened_at,
              })
              .select()
              .single();

            if (error) throw error;

            // Atualizar ID local com ID do servidor
            if (data && item.data.localId) {
              await offlineDB.comandas.update(item.data.localId, { id: data.id, isLocal: false });
              await offlineDB.comandaItems
                .where('comanda_id')
                .equals(item.data.localId)
                .modify({ comanda_id: data.id });
            }

            await offlineDB.syncQueue.delete(item.id);
          } else if (item.type === 'item' && item.action === 'create') {
            const { error } = await supabase
              .from('comanda_items')
              .insert({
                comanda_id: item.data.comanda_id,
                product_id: item.data.product_id,
                description: item.data.description,
                quantity: item.data.quantity,
                unit_price: item.data.unit_price,
                total_price: item.data.total_price,
                is_pending_sync: false,
              });

            if (error) throw error;

            await offlineDB.syncQueue.delete(item.id);
          }
        } catch (error) {
          console.error('Erro ao sincronizar item:', error);
          // Continua com o próximo item
        }
      }

      setSyncStatus('online');
      if (queue.length > 0) {
        toast({ title: `${queue.length} item(s) sincronizado(s) com sucesso!`, duration: 3000 });
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncStatus('offline');
    }
  }, [restaurantId]);

  // Sincronização automática periódica
  useEffect(() => {
    if (navigator.onLine && restaurantId) {
      syncPendingItems();
      const interval = setInterval(syncPendingItems, 30000); // A cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [syncPendingItems, restaurantId]);

  return {
    syncStatus,
    pendingCount,
    syncNow: syncPendingItems,
    isOnline: syncStatus === 'online' || syncStatus === 'syncing',
    isSyncing: syncStatus === 'syncing',
  };
}
