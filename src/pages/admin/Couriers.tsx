import { useState } from 'react';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useCouriers } from '@/hooks/useCouriers';
import { Courier, CourierStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bike, Plus, Pencil, Trash2, Phone, User, Loader2 } from 'lucide-react';
import { generateWhatsAppLink } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const STATUS_LABELS: Record<CourierStatus, string> = {
  available: 'Disponível',
  busy: 'Ocupado',
  offline: 'Offline',
};

const STATUS_COLORS: Record<CourierStatus, string> = {
  available: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  busy: 'bg-amber-500/15 text-amber-700 border-amber-200',
  offline: 'bg-slate-200 text-slate-600 border-slate-200',
};

export default function AdminCouriers() {
  const restaurantId = useAdminRestaurantId();
  const { couriers, loading, createCourier, updateCourier, deleteCourier } = useCouriers(restaurantId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    status: 'offline' as CourierStatus,
    vehicle_plate: '',
  });

  const openCreate = () => {
    setEditingCourier(null);
    setForm({ name: '', phone: '', status: 'offline', vehicle_plate: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Courier) => {
    setEditingCourier(c);
    setForm({
      name: c.name,
      phone: c.phone || '',
      status: c.status,
      vehicle_plate: c.vehicle_plate || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    setSaving(true);
    try {
      if (editingCourier) {
        await updateCourier(editingCourier.id, {
          name: form.name,
          phone: form.phone || undefined,
          status: form.status,
          vehicle_plate: form.vehicle_plate || undefined,
        });
      } else {
        await createCourier({
          name: form.name,
          phone: form.phone || undefined,
          status: form.status,
          vehicle_plate: form.vehicle_plate || undefined,
        });
      }
      setDialogOpen(false);
      toast({
        title: editingCourier ? 'Entregador atualizado' : 'Entregador criado',
        description: `${form.name} foi ${editingCourier ? 'atualizado' : 'adicionado'} com sucesso.`,
        variant: 'default',
      });
    } catch (err: unknown) {
      console.error(err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Verifique os dados e tente novamente.';
      toast({
        title: 'Erro ao salvar entregador',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este entregador? Pedidos atribuídos a ele não serão removidos.')) return;
    try {
      await deleteCourier(id);
      toast({
        title: 'Entregador excluído',
        description: 'O entregador foi removido com sucesso.',
        variant: 'default',
      });
    } catch (err: unknown) {
      console.error(err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Não foi possível excluir o entregador.';
      toast({
        title: 'Erro ao excluir',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const whatsappLink = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const withCountry = digits.length <= 11 ? '55' + digits : digits;
    return generateWhatsAppLink(withCountry, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entregadores</h1>
          <p className="text-muted-foreground">
            Cadastre motoboys e atribua pedidos a eles
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo entregador
        </Button>
      </div>

      {couriers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bike className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum entregador cadastrado ainda
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro entregador
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5" />
              Lista de entregadores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Nome</th>
                    <th className="text-left p-4 font-medium">Telefone</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Placa</th>
                    <th className="text-right p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{c.name}</span>
                          {!c.active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {c.phone ? (
                          <a
                            href={whatsappLink(c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Phone className="h-4 w-4" />
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={STATUS_COLORS[c.status]}>
                          {STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {c.vehicle_plate || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Excluir" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCourier ? 'Editar entregador' : 'Novo entregador'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do motoboy. O telefone será usado para contato e WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="courier-name">Nome *</Label>
              <Input
                id="courier-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
                required
              />
            </div>
            <div>
              <Label htmlFor="courier-phone">Telefone / WhatsApp</Label>
              <Input
                id="courier-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CourierStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{STATUS_LABELS.available}</SelectItem>
                  <SelectItem value="busy">{STATUS_LABELS.busy}</SelectItem>
                  <SelectItem value="offline">{STATUS_LABELS.offline}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="courier-plate">Placa do veículo</Label>
              <Input
                id="courier-plate"
                value={form.vehicle_plate}
                onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                placeholder="ABC-1D23"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingCourier ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
