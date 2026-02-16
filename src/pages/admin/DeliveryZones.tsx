import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { DeliveryZone } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';

export default function AdminDeliveryZones() {
  const restaurantId = useAdminRestaurantId();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    location_name: '',
    fee: 0,
  });

  useEffect(() => {
    if (restaurantId) {
      loadZones();
    }
  }, [restaurantId]);

  const loadZones = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('location_name', { ascending: true });

      if (error) throw error;

      setZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      const { error } = await supabase.from('delivery_zones').insert({
        restaurant_id: restaurantId,
        location_name: formData.location_name,
        fee: formData.fee,
        is_active: true,
      });

      if (error) throw error;

      setFormData({ location_name: '', fee: 0 });
      setShowForm(false);
      loadZones();
    } catch (error) {
      console.error('Erro ao criar zona:', error);
      alert('Erro ao criar zona de entrega');
    }
  };

  const toggleZoneStatus = async (zoneId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ is_active: !isActive })
        .eq('id', zoneId);

      if (error) throw error;

      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, is_active: !isActive } : z))
      );
    } catch (error) {
      console.error('Erro ao atualizar zona:', error);
    }
  };

  const deleteZone = async (zoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta zona?')) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;

      setZones((prev) => prev.filter((z) => z.id !== zoneId));
    } catch (error) {
      console.error('Erro ao excluir zona:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Zonas de Entrega</h1>
            <p className="text-muted-foreground">
              Configure os bairros e taxas de entrega
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Zona
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nova Zona de Entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="location_name">Nome do Bairro/Região</Label>
                  <Input
                    id="location_name"
                    value={formData.location_name}
                    onChange={(e) =>
                      setFormData({ ...formData, location_name: e.target.value })
                    }
                    placeholder="Ex: Centro, Bairro Alto"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fee">Taxa de Entrega (R$)</Label>
                  <Input
                    id="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.fee}
                    onChange={(e) =>
                      setFormData({ ...formData, fee: parseFloat(e.target.value) })
                    }
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use 0 para entrega grátis
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Salvar</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ location_name: '', fee: 0 });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {zones.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Você ainda não tem zonas de entrega cadastradas
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Zona
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">
                        {zone.location_name}
                      </h3>
                    </div>
                    {!zone.is_active && (
                      <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
                        Inativa
                      </span>
                    )}
                  </div>
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-primary">
                      {zone.fee === 0
                        ? 'Grátis'
                        : formatCurrency(zone.fee)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Taxa de entrega
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleZoneStatus(zone.id, zone.is_active)}
                    >
                      {zone.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteZone(zone.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
