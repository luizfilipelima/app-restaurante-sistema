import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useTables, useWaiterCalls } from '@/hooks/queries';
import { Table } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getCardapioPublicUrl } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Utensils, Bell, Copy, Check, Loader2, QrCode, Download } from 'lucide-react';

export default function AdminTables() {
  const restaurantId = useAdminRestaurantId();
  const queryClient = useQueryClient();
  const { restaurant } = useAdminRestaurant();
  const { data: tablesData, isLoading: loading, refetch: refetchTables } = useTables(restaurantId);
  const { data: waiterCallsData } = useWaiterCalls(restaurantId);
  const tables = tablesData ?? [];
  const waiterCalls = waiterCallsData ?? [];
  const [showForm, setShowForm] = useState(false);
  const [formNumber, setFormNumber] = useState('');
  const [attendingCallId, setAttendingCallId] = useState<string | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);

  // Realtime: chamados de garçom aparecem sem atualizar a página
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('waiter-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waiter_calls',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['waiterCalls', restaurantId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);

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
      refetchTables();
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
      refetchTables();
      toast({ title: 'Mesa excluída!' });
    } catch (e) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const downloadTableQRCode = async () => {
    if (!qrModalTable || !qrCodeRef.current || !restaurant?.slug) return;
    const slug = restaurant.slug;
    setDownloadingQr(true);
    try {
      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) throw new Error('SVG não encontrado');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto do canvas');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const padding = 40;
        const size = Math.max(img.width, img.height) + padding * 2;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, padding, padding, img.width, img.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            setDownloadingQr(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${slug}-qrcode-mesa-${String(qrModalTable.number).padStart(2, '0')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(svgUrl);
          toast({ title: 'QR Code baixado com sucesso!' });
          setDownloadingQr(false);
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setDownloadingQr(false);
        toast({ title: 'Erro ao baixar QR Code', variant: 'destructive' });
      };
      img.src = svgUrl;
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao baixar QR Code', variant: 'destructive' });
      setDownloadingQr(false);
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
      queryClient.invalidateQueries({ queryKey: ['waiterCalls', restaurantId] });
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
              {tables.map((table) => {
                const hasPendingCall = pendingCalls.some((c) => c.table_id === table.id);
                return (
                <div
                  key={table.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    table.is_active ? 'border-border' : 'opacity-60 border-dashed'
                  } ${hasPendingCall ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''}`}
                >
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      Mesa {table.number}
                      {hasPendingCall && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Bell className="h-3 w-3" />
                          Chamado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Cardápio interativo</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQrModalTable(table)}
                      title="Visualizar e baixar QR Code do cardápio"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
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
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Code da Mesa */}
      <Dialog open={!!qrModalTable} onOpenChange={(open) => !open && setQrModalTable(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code — Mesa {qrModalTable?.number}
            </DialogTitle>
          </DialogHeader>
          {qrModalTable && restaurant?.slug && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                ref={qrCodeRef}
                className="p-4 bg-white rounded-lg border-2 border-slate-200"
                style={{ display: 'inline-block' }}
              >
                <QRCodeSVG
                  value={
                    getCardapioPublicUrl(restaurant.slug).endsWith('/')
                      ? `${getCardapioPublicUrl(restaurant.slug)}cardapio/${qrModalTable.number}`
                      : `${getCardapioPublicUrl(restaurant.slug)}/cardapio/${qrModalTable.number}`
                  }
                  size={220}
                  level="H"
                  includeMargin
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Cardápio interativo da Mesa {qrModalTable.number}
              </p>
              <Button
                onClick={downloadTableQRCode}
                disabled={downloadingQr}
                className="w-full"
              >
                {downloadingQr ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar QR Code (PNG)
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
