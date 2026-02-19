import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, generateSlug } from '@/lib/utils';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  LogOut,
  ChefHat,
  Layout,
  BookOpen,
  Plus,
  Eye,
  EyeOff,
  Loader2,
  Instagram,
  Printer,
  CreditCard,
} from 'lucide-react';
import { Restaurant, DayKey, PrintPaperWidth } from '@/types';
import { toast } from '@/hooks/use-toast';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export default function SuperAdminDashboard() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
  });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [ordersByRestaurant, setOrdersByRestaurant] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showNewRestaurantDialog, setShowNewRestaurantDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    phone: '',
    whatsapp: '',
    phone_country: 'BR' as 'BR' | 'PY',
    instagram_url: '',
    logo: '',
    primary_color: '#FF6B35',
    secondary_color: '#FFFFFF',
    is_active: true,
    always_open: false,
    opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width: '80mm' as PrintPaperWidth,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [restaurantsRes, ordersRes] = await Promise.all([
        supabase.from('restaurants').select('*').order('name'),
        supabase.from('orders').select('restaurant_id'),
      ]);

      if (restaurantsRes.error) throw restaurantsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const list = restaurantsRes.data || [];
      setRestaurants(list);

      const countByRestaurant: Record<string, number> = {};
      (ordersRes.data || []).forEach((o: { restaurant_id: string }) => {
        countByRestaurant[o.restaurant_id] = (countByRestaurant[o.restaurant_id] || 0) + 1;
      });
      setOrdersByRestaurant(countByRestaurant);

      const totalRestaurants = list.length;
      const activeRestaurants = list.filter((r) => r.is_active).length;

      const { data: ordersWithTotal } = await supabase.from('orders').select('total');
      const totalRevenue = ordersWithTotal?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const totalOrders = ordersWithTotal?.length || 0;

      setMetrics({
        totalRestaurants,
        activeRestaurants,
        totalRevenue,
        totalOrders,
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRestaurantStatus = async (restaurantId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !isActive })
        .eq('id', restaurantId);
      if (error) throw error;
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, is_active: !isActive } : r))
      );
      setMetrics((m) => ({
        ...m,
        activeRestaurants: m.activeRestaurants + (isActive ? -1 : 1),
      }));
      toast({
        title: 'Status atualizado',
        description: `Restaurante ${!isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do restaurante.',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Para novo restaurante, vamos armazenar o arquivo e fazer upload após criar
    // Por enquanto, vamos usar uma URL temporária ou permitir URL manual
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
    
    toast({
      title: 'Logo selecionado',
      description: 'O logo será salvo ao criar o restaurante.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = formData.slug.trim() || generateSlug(formData.name);
    if (!slug) {
      toast({
        title: 'Nome inválido',
        description: 'Digite um nome para o restaurante.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const restaurantData: any = {
        name: formData.name.trim(),
        slug,
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim(),
        phone_country: formData.phone_country,
        instagram_url: formData.instagram_url.trim() || null,
        logo: formData.logo || null,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        is_active: formData.is_active,
        always_open: formData.always_open,
        opening_hours: formData.opening_hours,
        print_auto_on_new_order: formData.print_auto_on_new_order,
        print_paper_width: formData.print_paper_width,
      };

      const { data, error } = await supabase.from('restaurants').insert(restaurantData).select().single();

      if (error) throw error;

      // Se há logo como data URL, fazer upload para storage
      if (formData.logo && formData.logo.startsWith('data:')) {
        try {
          // Converter data URL para File
          const response = await fetch(formData.logo);
          const blob = await response.blob();
          const file = new File([blob], 'logo.png', { type: blob.type });
          
          // Fazer upload do logo
          const logoUrl = await uploadRestaurantLogo(data.id, file);
          
          // Atualizar restaurante com URL do logo
          await supabase
            .from('restaurants')
            .update({ logo: logoUrl })
            .eq('id', data.id);
        } catch (logoError) {
          console.error('Erro ao fazer upload do logo:', logoError);
          // Não falhar a criação se o logo falhar
        }
      }

      toast({
        title: 'Restaurante criado',
        description: `${formData.name} foi adicionado com sucesso.`,
      });

      // Reset form
      setFormData({
        name: '',
        slug: '',
        phone: '',
        whatsapp: '',
        phone_country: 'BR',
        instagram_url: '',
        logo: '',
        primary_color: '#FF6B35',
        secondary_color: '#FFFFFF',
        is_active: true,
        always_open: false,
        opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
        print_auto_on_new_order: false,
        print_paper_width: '80mm' as PrintPaperWidth,
      });
      setShowNewRestaurantDialog(false);
      await loadData();
    } catch (err: unknown) {
      console.error('Erro ao criar restaurante:', err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Verifique se o slug não está em uso.';
      toast({
        title: 'Erro ao criar restaurante',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-9 w-48 mb-1" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Painel Geral</h1>
              <p className="text-muted-foreground mt-0.5">
                Visão geral do sistema e todos os restaurantes
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="default"
                onClick={() => setShowNewRestaurantDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo restaurante
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Métricas */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Métricas globais</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 gradient-primary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Restaurantes
                </CardTitle>
                <Store className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {metrics.totalRestaurants}
                </div>
                <p className="text-xs text-white/80">{metrics.activeRestaurants} ativos</p>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 gradient-secondary opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Faturamento total
                </CardTitle>
                <DollarSign className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(metrics.totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Total de pedidos
                </CardTitle>
                <ShoppingCart className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">{metrics.totalOrders}</div>
              </CardContent>
            </Card>

            <Card className="relative border-0 shadow-premium overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-90 group-hover:opacity-100 transition-opacity rounded-lg" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-white/90">
                  Ticket médio
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-white/80" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(
                    metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lista de restaurantes */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Restaurantes ({restaurants.length})
          </h2>

          {restaurants.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Store className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum restaurante cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Crie o primeiro restaurante para começar
                </p>
                <Button onClick={() => setShowNewRestaurantDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar restaurante
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {restaurants.map((restaurant) => (
                <Card key={restaurant.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {restaurant.logo ? (
                          <img
                            src={restaurant.logo}
                            alt={restaurant.name}
                            className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Store className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {restaurant.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {restaurant.phone || restaurant.slug}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ordersByRestaurant[restaurant.id] ?? 0} pedidos
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={restaurant.is_active ? 'default' : 'secondary'}
                        className="flex-shrink-0"
                      >
                        {restaurant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[100px]"
                        onClick={() => navigate(`/super-admin/restaurants/${restaurant.id}`)}
                      >
                        <Layout className="h-3.5 w-3.5 mr-1.5" />
                        Admin
                      </Button>
                      {/* Botão de gestão de assinatura */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[100px] border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => navigate(`/super-admin/restaurants/${restaurant.id}/subscription`)}
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        Assinatura
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`${window.location.origin}/kitchen?restaurant_id=${restaurant.id}`, '_blank')
                        }
                      >
                        <ChefHat className="h-3.5 w-3.5 mr-1.5" />
                        Cozinha
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/${restaurant.slug}`, '_blank')}
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                        Cardápio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleRestaurantStatus(restaurant.id, restaurant.is_active)
                        }
                      >
                        {restaurant.is_active ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Novo Restaurante */}
      <Dialog open={showNewRestaurantDialog} onOpenChange={setShowNewRestaurantDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Restaurante</DialogTitle>
            <DialogDescription>
              Preencha todas as informações do restaurante. Você poderá editar depois nas configurações.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="contact">Contato</TabsTrigger>
                <TabsTrigger value="hours">Horários</TabsTrigger>
                <TabsTrigger value="settings">Configurações</TabsTrigger>
              </TabsList>

              {/* Aba Básico */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Restaurante *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData({
                          ...formData,
                          name,
                          slug: formData.slug || generateSlug(name),
                        });
                      }}
                      placeholder="Ex: Pizzaria do João"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="pizzaria-do-joao"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      URL: {window.location.origin}/{formData.slug || 'slug'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo</Label>
                  <div className="flex items-center gap-4">
                    {formData.logo && (
                      <img
                        src={formData.logo}
                        alt="Logo"
                        className="h-20 w-20 rounded-lg object-cover border"
                      />
                    )}
                    <div className="flex-1">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primary_color"
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        className="h-10 w-20"
                      />
                      <Input
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        placeholder="#FF6B35"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondary_color"
                        type="color"
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        className="h-10 w-20"
                      />
                      <Input
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        placeholder="#FFFFFF"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Restaurante ativo (visível no cardápio público)
                  </Label>
                </div>
              </TabsContent>

              {/* Aba Contato */}
              <TabsContent value="contact" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_country">País</Label>
                  <Select
                    value={formData.phone_country}
                    onValueChange={(value: 'BR' | 'PY') => setFormData({ ...formData, phone_country: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">Brasil</SelectItem>
                      <SelectItem value="PY">Paraguai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp (apenas números) *</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="11999999999"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram_url">
                    <Instagram className="h-4 w-4 inline mr-1" />
                    Instagram URL
                  </Label>
                  <Input
                    id="instagram_url"
                    type="url"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/restaurante"
                  />
                </div>
              </TabsContent>

              {/* Aba Horários */}
              <TabsContent value="hours" className="space-y-4 mt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    id="always_open"
                    checked={formData.always_open}
                    onChange={(e) => setFormData({ ...formData, always_open: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="always_open" className="cursor-pointer">
                    Sempre aberto (24 horas)
                  </Label>
                </div>

                {!formData.always_open && (
                  <div className="space-y-4">
                    {DAYS.map((day) => (
                      <div key={day.key} className="flex items-center gap-4">
                        <div className="w-24 flex-shrink-0">
                          <Label>{day.label}</Label>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={formData.opening_hours[day.key]?.open || ''}
                            onChange={(e) => {
                              const open = e.target.value;
                              const close = formData.opening_hours[day.key]?.close || '';
                              setFormData({
                                ...formData,
                                opening_hours: {
                                  ...formData.opening_hours,
                                  [day.key]: open && close ? { open, close } : null,
                                },
                              });
                            }}
                            placeholder="Abertura"
                          />
                          <Input
                            type="time"
                            value={formData.opening_hours[day.key]?.close || ''}
                            onChange={(e) => {
                              const open = formData.opening_hours[day.key]?.open || '';
                              const close = e.target.value;
                              setFormData({
                                ...formData,
                                opening_hours: {
                                  ...formData.opening_hours,
                                  [day.key]: open && close ? { open, close } : null,
                                },
                              });
                            }}
                            placeholder="Fechamento"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              opening_hours: {
                                ...formData.opening_hours,
                                [day.key]: null,
                              },
                            });
                          }}
                        >
                          Fechado
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Aba Configurações */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Printer className="h-5 w-5" />
                      Impressão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="print_auto"
                        checked={formData.print_auto_on_new_order}
                        onChange={(e) =>
                          setFormData({ ...formData, print_auto_on_new_order: e.target.checked })
                        }
                        className="rounded"
                      />
                      <Label htmlFor="print_auto" className="cursor-pointer">
                        Impressão automática ao receber novo pedido
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="print_paper_width">Largura do papel</Label>
                      <Select
                        value={formData.print_paper_width}
                        onValueChange={(value: PrintPaperWidth) =>
                          setFormData({ ...formData, print_paper_width: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="58mm">58mm</SelectItem>
                          <SelectItem value="80mm">80mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewRestaurantDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Restaurante
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
