import { useState } from 'react';
import { useCouriers } from '@/hooks/shared/useCouriers';
import { Courier, CourierStatus } from '@/types';
import { Button } from '@/components/ui/button';
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
import { generateWhatsAppLink, normalizePhoneWithCountryCode } from '@/lib/core/utils';
import { toast } from '@/hooks/shared/use-toast';

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

interface DeliveryCouriersSectionProps {
  restaurantId: string | null;
}

export function DeliveryCouriersSection({ restaurantId }: DeliveryCouriersSectionProps) {
  const { couriers, loading, createCourier, updateCourier, deleteCourier } = useCouriers(restaurantId);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cadastre os entregadores para atribuir aos pedidos de delivery.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Novo
        </Button>
      </div>

      {couriers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-4 text-center">
          <Bike className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Nenhum entregador cadastrado</p>
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar primeiro entregador
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {couriers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{c.name}</span>
                        {!c.active && (
                          <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {c.phone ? (
                        <a
                          href={whatsappLink(c.phone, c.phone_country)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {c.phone}
                          <span className="text-muted-foreground" title="País">
                            {getPhoneFlag((c.phone_country as PhoneCountry) ?? 'BR')}
                          </span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_COLORS[c.status]}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCourier ? 'Editar entregador' : 'Novo entregador'}</DialogTitle>
            <DialogDescription>
              Preencha os dados. Escolha o país do telefone para contato por WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="courier-name">Nome *</Label>
              <Input
                id="courier-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>País do contato</Label>
              <Select
                value={form.phone_country}
                onValueChange={(v) => setForm({ ...form, phone_country: v as PhoneCountry })}
              >
                <SelectTrigger className="mt-1">
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
            </div>
            <div>
              <Label htmlFor="courier-phone">Telefone / WhatsApp</Label>
              <Input
                id="courier-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={getPhonePlaceholder(form.phone_country)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CourierStatus })}>
                <SelectTrigger className="mt-1">
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
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingCourier ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
