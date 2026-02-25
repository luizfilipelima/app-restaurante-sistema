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
import { Bike, Plus, Pencil, Trash2, Phone, User, Loader2, Package, Clock, DollarSign } from 'lucide-react';
import { generateWhatsAppLink, formatCurrency, normalizePhoneWithCountryCode } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCourierMetrics } from '@/hooks/queries';
import { useAdminCurrency } from '@/contexts/AdminRestaurantContext';

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

type PhoneCountry = 'BR' | 'PY' | 'AR';

const PHONE_COUNTRY_OPTIONS: { value: PhoneCountry; label: string; flag: string }[] = [
  { value: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { value: 'PY', label: 'Paraguai', flag: '🇵🇾' },
  { value: 'AR', label: 'Argentina', flag: '🇦🇷' },
];

function getPhonePlaceholder(country: PhoneCountry): string {
  return country === 'BR' ? '(11) 99999-9999' : country === 'PY' ? '981 123 456' : '11 15 1234-5678';
}

function getPhoneFlag(country: PhoneCountry): string {
  return country === 'BR' ? '🇧🇷' : country === 'PY' ? '🇵🇾' : '🇦🇷';
}

export default function AdminCouriers() {
  const restaurantId = useAdminRestaurantId();
  const currency = useAdminCurrency();
  const { couriers, loading, createCourier, updateCourier, deleteCourier } = useCouriers(restaurantId);
  const { data: metricsData } = useCourierMetrics(restaurantId);
  const metricsByCourier = new Map((metricsData ?? []).map((m) => [m.courier_id, m]));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    phone_country: PhoneCountry;
    status: CourierStatus;
    vehicle_plate: string;
  }>({
    name: '',
    phone: '',
    phone_country: 'BR',
    status: 'offline',
    vehicle_plate: '',
  });

  const openCreate = () => {
    setEditingCourier(null);
    setForm({ name: '', phone: '', phone_country: 'BR', status: 'offline', vehicle_plate: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Courier) => {
    setEditingCourier(c);
    const country = (c.phone_country as PhoneCountry) || 'BR';
    setForm({
      name: c.name,
      phone: c.phone || '',
      phone_country: country,
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
          phone_country: form.phone_country,
          status: form.status,
          vehicle_plate: form.vehicle_plate || undefined,
        });
      } else {
        await createCourier({
          name: form.name,
          phone: form.phone || undefined,
          phone_country: form.phone_country,
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

  const whatsappLink = (phone: string, phone_country?: 'BR' | 'PY' | 'AR' | null) => {
    const country = phone_country ?? 'BR';
    const fullPhone = normalizePhoneWithCountryCode(phone, country);
    return generateWhatsAppLink(fullPhone, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Entregadores</h1>
          <p className="text-muted-foreground">
            Cadastre motoboys e atribua pedidos a eles. O país do telefone define o código para contato.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo entregador
        </Button>
      </div>

      {/* Mini BI: Métricas por entregador */}
      {couriers.length > 0 && metricsData && metricsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Métricas por Entregador
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Total de entregas, tempo médio e taxas acumuladas
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {couriers.filter((c) => metricsByCourier.has(c.id)).map((c) => {
                const m = metricsByCourier.get(c.id)!;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" /> Entregas
                        </span>
                        <span className="font-bold">{m.total_deliveries}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Tempo médio
                        </span>
                        <span className="font-bold">{m.avg_delivery_time_minutes > 0 ? `${Math.round(m.avg_delivery_time_minutes)} min` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Taxas
                        </span>
                        <span className="font-bold">{formatCurrency(m.total_fees, currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
          <CardContent className="p-0 overflow-x-auto">
            <div className="w-full min-w-[640px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Nome</th>
                    <th className="text-left p-4 font-medium">Telefone / País</th>
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
                            href={whatsappLink(c.phone, c.phone_country)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Phone className="h-4 w-4" />
                            {c.phone}
                            <span className="text-xs text-muted-foreground" title="País do contato">
                              {getPhoneFlag((c.phone_country as PhoneCountry) ?? 'BR')}
                            </span>
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
              Preencha os dados do motoboy. Escolha o país do telefone para garantir contato correto por WhatsApp (BR, PY ou AR).
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
              <Label>País do contato</Label>
              <Select
                value={form.phone_country}
                onValueChange={(v) => setForm({ ...form, phone_country: v as PhoneCountry })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_COUNTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.flag} {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Brasil (+55), Paraguai (+595) ou Argentina (+54)
              </p>
            </div>
            <div>
              <Label htmlFor="courier-phone">Telefone / WhatsApp</Label>
              <Input
                id="courier-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={getPhonePlaceholder(form.phone_country)}
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
