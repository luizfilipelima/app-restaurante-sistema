import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { offlineComandaService, offlineDB } from '@/lib/offline-db';
import { Comanda, ComandaItem, ComandaWithItems } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useOfflineSync } from './useOfflineSync';

export function useComandas(restaurantId: string) {
  const [comandas, setComandas] = useState<ComandaWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const { isOnline } = useOfflineSync(restaurantId);

  const loadComandas = useCallback(async (silent = false) => {
    if (!restaurantId) return;

    try {
      if (!silent) setLoading(true);

      // Tentar carregar do Supabase primeiro
      if (isOnline) {
        const { data, error } = await supabase
          .from('comandas')
          .select(`
            *,
            comanda_items (*)
          `)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'open')
          .order('opened_at', { ascending: false });

        if (error) throw error;

        if (data) {
          setComandas(data as ComandaWithItems[]);
          return;
        }
      }

      // Fallback: carregar do IndexedDB
      const localComandas = await offlineComandaService.getOpenComandas(restaurantId);
      const comandasWithItems = await Promise.all(
        localComandas.map(async (comanda) => {
          const items = await offlineComandaService.getComandaItems(comanda.id);
          return { ...comanda, items };
        })
      );
      setComandas(comandasWithItems);
    } catch (error) {
      console.error('Erro ao carregar comandas:', error);
      // Fallback para dados locais
      const localComandas = await offlineComandaService.getOpenComandas(restaurantId);
      const comandasWithItems = await Promise.all(
        localComandas.map(async (comanda) => {
          const items = await offlineComandaService.getComandaItems(comanda.id);
          return { ...comanda, items };
        })
      );
      setComandas(comandasWithItems);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, isOnline]);

  // Carga inicial
  useEffect(() => {
    loadComandas(false);
  }, [loadComandas]);

  // Real-time: Supabase Realtime substitui o polling de 5s
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`buffet-comandas-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => { loadComandas(true); }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [restaurantId, loadComandas]);

  const createComanda = useCallback(async (): Promise<string> => {
    if (!restaurantId) throw new Error('Restaurant ID não fornecido');

    try {
      // Obter próximo número de comanda
      let number = 1;
      if (isOnline) {
        const { data } = await supabase.rpc('get_next_comanda_number', {
          restaurant_uuid: restaurantId,
        });
        number = data || 1;
      } else {
        // Calcular número localmente
        const localComandas = await offlineComandaService.getOpenComandas(restaurantId);
        const maxNumber = localComandas.reduce((max, c) => Math.max(max, c.number), 0);
        number = maxNumber + 1;
      }

      const newComanda: Comanda = {
        id: '',
        restaurant_id: restaurantId,
        number,
        status: 'open',
        total_amount: 0,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Salvar localmente primeiro
      const comandaId = await offlineComandaService.saveComanda(newComanda);

      // Tentar salvar no Supabase em background
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('comandas')
            .insert({
              restaurant_id: restaurantId,
              number,
              status: 'open',
              total_amount: 0,
            })
            .select()
            .single();

          if (!error && data) {
            // Atualizar ID local
            await offlineDB.comandas.update(comandaId, { id: data.id, isLocal: false });
            await offlineDB.comandaItems
              .where('comanda_id')
              .equals(comandaId)
              .modify({ comanda_id: data.id });
          }
        } catch (error) {
          console.error('Erro ao criar comanda no servidor:', error);
        }
      }

      // Aguardar um pouco para garantir que a comanda foi salva
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadComandas();
      toast({ title: `Comanda #${number} criada!` });
      return comandaId;
    } catch (error) {
      console.error('Erro ao criar comanda:', error);
      toast({ title: 'Erro ao criar comanda', variant: 'destructive' });
      throw error;
    }
  }, [restaurantId, isOnline, loadComandas]);

  const addItemToComanda = useCallback(async (
    comandaId: string,
    item: Omit<ComandaItem, 'id' | 'comanda_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const newItem: ComandaItem = {
        id: '',
        comanda_id: comandaId,
        ...item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Salvar localmente primeiro
      const itemId = await offlineComandaService.saveComandaItem(newItem);

      // Tentar salvar no Supabase em background
      if (isOnline) {
        try {
          const { error } = await supabase.from('comanda_items').insert({
            comanda_id: comandaId,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          });

          if (!error) {
            await offlineDB.comandaItems.update(itemId, { isLocal: false, is_pending_sync: false });
          }
        } catch (error) {
          console.error('Erro ao adicionar item no servidor:', error);
        }
      }

      await loadComandas();
      return itemId;
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast({ title: 'Erro ao adicionar item', variant: 'destructive' });
      throw error;
    }
  }, [isOnline, loadComandas]);

  const closeComanda = useCallback(async (comandaId: string) => {
    try {
      const comanda = comandas.find(c => c.id === comandaId);
      if (!comanda) throw new Error('Comanda não encontrada');

      const updateData = {
        status: 'closed' as const,
        closed_at: new Date().toISOString(),
        last_sync: new Date().toISOString(),
      };

      // Atualizar localmente
      await offlineDB.comandas.update(comandaId, updateData);

      // Tentar atualizar no Supabase
      if (isOnline) {
        const { error } = await supabase
          .from('comandas')
          .update(updateData)
          .eq('id', comandaId);

        if (error) throw error;
      }

      await loadComandas();
      toast({ title: `Comanda #${comanda.number} fechada!` });
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      toast({ title: 'Erro ao fechar comanda', variant: 'destructive' });
    }
  }, [comandas, isOnline, loadComandas]);

  return {
    comandas,
    loading,
    isLive,
    createComanda,
    addItemToComanda,
    closeComanda,
    refresh: loadComandas,
  };
}
