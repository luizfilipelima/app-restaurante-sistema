import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Restaurant } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { generateSlug } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Plus,
  Store,
  Eye,
  EyeOff,
  ExternalLink,
  Settings,
  BookOpen,
  ChefHat,
  Layout,
} from 'lucide-react';

export default function SuperAdminRestaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
  });

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRestaurants(data || []);
    } catch (error) {
      console.error('Erro ao carregar restaurantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = generateSlug(formData.name);
    if (!slug) {
      toast({
        title: 'Nome inválido',
        description: 'Digite um nome para o restaurante (o slug será gerado a partir dele).',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('restaurants').insert({
        name: formData.name.trim(),
        slug,
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim(),
        is_active: true,
      });

      if (error) throw error;

      setFormData({ name: '', phone: '', whatsapp: '' });
      setShowForm(false);
      await loadRestaurants();
      toast({
        title: 'Restaurante criado',
        description: `${formData.name} foi adicionado. Você pode acessá-lo e configurar usuários.`,
        variant: 'default',
      });
    } catch (err: unknown) {
      console.error('Erro ao criar restaurante:', err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Verifique se o slug não está em uso (nome muito curto ou duplicado).';
      toast({
        title: 'Erro ao criar restaurante',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const toggleRestaurantStatus = async (
    restaurantId: string,
    isActive: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !isActive })
        .eq('id', restaurantId);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === restaurantId ? { ...r, is_active: !isActive } : r
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/super-admin')}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Restaurantes</h1>
                <p className="text-primary-foreground/80">
                  Gerencie todos os restaurantes da plataforma
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Restaurante
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Novo Restaurante</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Restaurante</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Pizzaria do João"
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
                    <Label htmlFor="whatsapp">WhatsApp (apenas números)</Label>
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
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Criar Restaurante</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setFormData({ name: '', phone: '', whatsapp: '' });
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {restaurants.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum restaurante cadastrado ainda
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Restaurante
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {restaurants.map((restaurant) => (
                <Card key={restaurant.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {restaurant.logo ? (
                          <img
                            src={restaurant.logo}
                            alt={restaurant.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Store className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">
                            {restaurant.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {restaurant.phone}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={restaurant.is_active ? 'default' : 'destructive'}
                      >
                        {restaurant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Slug:</span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {restaurant.slug}
                        </code>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Link:</span>
                        <a
                          href={`/${restaurant.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {window.location.origin}/{restaurant.slug}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          navigate(`/super-admin/restaurants/${restaurant.id}`)
                        }
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Gerenciar restaurante
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`/${restaurant.slug}`, '_blank')
                          }
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Cardápio
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `${window.location.origin}/super-admin/restaurants/${restaurant.id}`,
                              '_blank'
                            )
                          }
                        >
                          <Layout className="h-4 w-4 mr-2" />
                          Admin
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(restaurant.slug ? `/${restaurant.slug}/kds` : `/kitchen?restaurant_id=${restaurant.id}`, '_blank')
                          }
                        >
                          <ChefHat className="h-4 w-4 mr-2" />
                          Cozinha
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            toggleRestaurantStatus(
                              restaurant.id,
                              restaurant.is_active
                            )
                          }
                        >
                          {restaurant.is_active ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
