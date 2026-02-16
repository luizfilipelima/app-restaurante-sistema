import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import AdminLayout from '@/components/admin/AdminLayout';
import { Restaurant } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

export default function AdminSettings() {
  const { user } = useAuthStore();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    logo: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
  });

  useEffect(() => {
    if (user?.restaurant_id) {
      loadRestaurant();
    }
  }, [user]);

  const loadRestaurant = async () => {
    if (!user?.restaurant_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user.restaurant_id)
        .single();

      if (error) throw error;

      setRestaurant(data);
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        logo: data.logo || '',
        primary_color: data.primary_color || '#000000',
        secondary_color: data.secondary_color || '#ffffff',
      });
    } catch (error) {
      console.error('Erro ao carregar restaurante:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          logo: formData.logo,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.restaurant_id);

      if (error) throw error;

      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Configure as informações do seu restaurante
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Restaurante</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  placeholder="11999999999"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas números, sem parênteses ou traços
                </p>
              </div>

              <div>
                <Label htmlFor="logo">URL da Logo</Label>
                <Input
                  id="logo"
                  type="url"
                  value={formData.logo}
                  onChange={(e) =>
                    setFormData({ ...formData, logo: e.target.value })
                  }
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personalização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primary_color">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondary_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondary_color: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link do Cardápio Digital</CardTitle>
            </CardHeader>
            <CardContent>
              {restaurant && (
                <div>
                  <Label>Seu link público:</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/${restaurant.slug}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/${restaurant.slug}`
                        );
                        alert('Link copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </form>
      </div>
    </AdminLayout>
  );
}
