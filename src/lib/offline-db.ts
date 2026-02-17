import Dexie, { Table } from 'dexie';
import { Comanda, ComandaItem } from '@/types';

// Interface para armazenamento offline
interface OfflineComanda extends Comanda {
  localId?: string; // ID local temporário antes de sincronizar
  isLocal?: boolean; // Se foi criado offline
}

interface OfflineComandaItem extends ComandaItem {
  localId?: string;
  isLocal?: boolean;
}

class BuffetOfflineDB extends Dexie {
  comandas!: Table<OfflineComanda, string>;
  comandaItems!: Table<OfflineComandaItem, string>;
  syncQueue!: Table<{ id: string; type: 'comanda' | 'item'; action: 'create' | 'update' | 'delete'; data: any; timestamp: number }, string>;

  constructor() {
    super('BuffetOfflineDB');
    this.version(1).stores({
      comandas: 'id, restaurant_id, number, status, opened_at, [restaurant_id+status]',
      comandaItems: 'id, comanda_id, is_pending_sync',
      syncQueue: 'id, type, timestamp',
    });
  }
}

export const offlineDB = new BuffetOfflineDB();

// Funções auxiliares para operações offline
export const offlineComandaService = {
  // Salvar comanda localmente
  async saveComanda(comanda: Comanda): Promise<string> {
    const localId = comanda.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineComanda: OfflineComanda = {
      ...comanda,
      id: localId,
      localId: localId.startsWith('local_') ? localId : undefined,
      isLocal: localId.startsWith('local_'),
    };
    
    await offlineDB.comandas.put(offlineComanda);
    
    // Adicionar à fila de sincronização se for local
    if (offlineComanda.isLocal) {
      await offlineDB.syncQueue.add({
        id: localId,
        type: 'comanda',
        action: 'create',
        data: offlineComanda,
        timestamp: Date.now(),
      });
    }
    
    return localId;
  },

  // Salvar item de comanda localmente
  async saveComandaItem(item: ComandaItem): Promise<string> {
    const localId = item.id || `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineItem: OfflineComandaItem = {
      ...item,
      id: localId,
      localId: localId.startsWith('local_') ? localId : undefined,
      isLocal: localId.startsWith('local_'),
      is_pending_sync: localId.startsWith('local_'),
    };
    
    await offlineDB.comandaItems.put(offlineItem);
    
    // Adicionar à fila de sincronização se for local
    if (offlineItem.isLocal) {
      await offlineDB.syncQueue.add({
        id: localId,
        type: 'item',
        action: 'create',
        data: offlineItem,
        timestamp: Date.now(),
      });
    }
    
    return localId;
  },

  // Buscar comandas abertas localmente
  async getOpenComandas(restaurantId: string): Promise<OfflineComanda[]> {
    return await offlineDB.comandas
      .where('[restaurant_id+status]')
      .equals([restaurantId, 'open'])
      .toArray();
  },

  // Buscar itens de uma comanda
  async getComandaItems(comandaId: string): Promise<OfflineComandaItem[]> {
    return await offlineDB.comandaItems
      .where('comanda_id')
      .equals(comandaId)
      .toArray();
  },

  // Limpar dados sincronizados
  async clearSyncedData() {
    const allComandas = await offlineDB.comandas.toArray();
    const syncedComandas = allComandas.filter(c => !c.isLocal);
    
    const allItems = await offlineDB.comandaItems.toArray();
    const syncedItems = allItems.filter(i => !i.isLocal);
    
    // Manter apenas dados locais pendentes
    await offlineDB.comandas.bulkDelete(syncedComandas.map(c => c.id));
    await offlineDB.comandaItems.bulkDelete(syncedItems.map(i => i.id));
  },
};
