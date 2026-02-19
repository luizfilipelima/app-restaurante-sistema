import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  useSuperAdminRestaurants,
  useInvalidateSuperAdminRestaurants,
} from '@/hooks/queries/useSuperAdminRestaurants';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, generateSlug } from '@/lib/utils';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { motion } from 'framer-motion';

// ─── Variantes de animação ─────────────────────────────────────────────────────

const metricContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const metricCardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

const restaurantListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const restaurantCardVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};
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
  Trash2,
  AlertTriangle,
  UserPlus,
  ShieldCheck,
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
  useAuthStore();
  const navigate = useNavigate();
  const { data, isLoading: loading } = useSuperAdminRestaurants();
  const invalidate = useInvalidateSuperAdminRestaurants();
  const restaurants = data?.restaurants ?? [];
  const ordersByRestaurant = data?.ordersByRestaurant ?? {};
  const metrics = data?.metrics ?? {
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
  };
  const [showNewRestaurantDialog, setShowNewRestaurantDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  // Soft delete: qual restaurante está prestes a ser removido
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);
  // Campo de confirmação: o usuário deve digitar o nome exato para habilitar o botão
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // ── Dados do admin a ser criado junto com o restaurante ─────────────────
  const [adminData, setAdminData] = useState({
    email: '',
    login: '',
    password: '',
    confirmPassword: '',
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);

  const INITIAL_ADMIN_DATA = { email: '', login: '', password: '', confirmPassword: '' };

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    phone: '',
    whatsapp: '',
    phone_country: 'BR' as 'BR' | 'PY',
    instagram_url: '',
    logo: '',
    is_active: true,
    always_open: false,
    opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width: '80mm' as PrintPaperWidth,
  });

  const toggleRestaurantStatus = async (restaurantId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !isActive })
        .eq('id', restaurantId);
      if (error) throw error;
      invalidate();
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

  /**
   * Soft delete: define deleted_at = NOW() sem apagar os dados reais.
   * O restaurante some da listagem (filtered by deleted_at IS NULL) mas o
   * histórico de pedidos e financeiro permanece intacto para BI.
   */
  const handleSoftDelete = async () => {
    if (!restaurantToDelete) return;

    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', restaurantToDelete.id);

      if (error) throw error;

      invalidate();
      toast({
        title: 'Restaurante removido',
        description: `"${restaurantToDelete.name}" foi removido com segurança. Os dados históricos foram preservados.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o restaurante. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setRestaurantToDelete(null);
      setDeleteConfirmName('');
    }
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

  const INITIAL_FORM_DATA = {
    name: '',
    slug: '',
    phone: '',
    whatsapp: '',
    phone_country: 'BR' as 'BR' | 'PY',
    instagram_url: '',
    logo: '',
    is_active: true,
    always_open: false,
    opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
    print_auto_on_new_order: false,
    print_paper_width: '80mm' as PrintPaperWidth,
  };

  const handleCloseDialog = () => {
    setShowNewRestaurantDialog(false);
    setFormData(INITIAL_FORM_DATA);
    setAdminData(INITIAL_ADMIN_DATA);
    setShowAdminPassword(false);
    setShowAdminConfirmPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = formData.slug.trim() || generateSlug(formData.name);
    if (!slug) {
      toast({ title: 'Nome inválido', description: 'Digite um nome para o restaurante.', variant: 'destructive' });
      return;
    }

    const hasAdmin = adminData.email.trim() !== '';
    if (hasAdmin) {
      if (adminData.password.length < 6) {
        toast({ title: 'Senha muito curta', description: 'A senha do admin deve ter pelo menos 6 caracteres.', variant: 'destructive' });
        return;
      }
      if (adminData.password !== adminData.confirmPassword) {
        toast({ title: 'Senhas não conferem', description: 'A senha e a confirmação devem ser iguais.', variant: 'destructive' });
        return;
      }
    }

    try {
      setSaving(true);

      if (hasAdmin) {
        // ── Criação atômica: restaurante + usuário admin via RPC ─────────
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'super_admin_create_restaurant_with_admin',
          {
            p_restaurant_name: formData.name.trim(),
            p_slug:            slug,
            p_phone:           formData.phone.trim() || null,
            p_whatsapp:        formData.whatsapp.trim() || null,
            p_admin_email:     adminData.email.trim(),
            p_admin_password:  adminData.password,
            p_admin_login:     adminData.login.trim() || null,
          }
        );
        if (rpcError) throw rpcError;

        // Atualizar campos extras não cobertos pela RPC (logo, instagram, etc.)
        const extras: Record<string, unknown> = {};
        if (formData.instagram_url) extras.instagram_url = formData.instagram_url.trim();
        if (formData.logo && !formData.logo.startsWith('data:')) extras.logo = formData.logo;
        extras.phone_country = formData.phone_country;
        extras.always_open = formData.always_open;
        extras.opening_hours = formData.opening_hours;
        extras.print_auto_on_new_order = formData.print_auto_on_new_order;
        extras.print_paper_width = formData.print_paper_width;

        const restaurantId = (rpcData as { restaurant_id: string }).restaurant_id;
        await supabase.from('restaurants').update(extras).eq('id', restaurantId);

        // Logo upload
        if (formData.logo?.startsWith('data:')) {
          try {
            const blob = await (await fetch(formData.logo)).blob();
            const file = new File([blob], 'logo.png', { type: blob.type });
            const logoUrl = await uploadRestaurantLogo(restaurantId, file);
            await supabase.from('restaurants').update({ logo: logoUrl }).eq('id', restaurantId);
          } catch (logoError) {
            console.error('Erro no upload do logo:', logoError);
          }
        }

        toast({
          title: 'Restaurante e admin criados',
          description: `${formData.name} e o usuário ${adminData.email} foram criados com sucesso.`,
        });
      } else {
        // ── Criação simples: apenas restaurante (comportamento original) ──
        const restaurantPayload: Record<string, unknown> = {
          name: formData.name.trim(),
          slug,
          phone: formData.phone.trim(),
          whatsapp: formData.whatsapp.trim(),
          phone_country: formData.phone_country,
          instagram_url: formData.instagram_url.trim() || null,
          logo: formData.logo || null,
          is_active: formData.is_active,
          always_open: formData.always_open,
          opening_hours: formData.opening_hours,
          print_auto_on_new_order: formData.print_auto_on_new_order,
          print_paper_width: formData.print_paper_width,
        };

        const { data: inserted, error } = await supabase.from('restaurants').insert(restaurantPayload).select().single();
        if (error) throw error;

        if (formData.logo?.startsWith('data:')) {
          try {
            const blob = await (await fetch(formData.logo)).blob();
            const file = new File([blob], 'logo.png', { type: blob.type });
            const logoUrl = await uploadRestaurantLogo(inserted.id, file);
            await supabase.from('restaurants').update({ logo: logoUrl }).eq('id', inserted.id);
          } catch (logoError) {
            console.error('Erro no upload do logo:', logoError);
          }
        }

        toast({ title: 'Restaurante criado', description: `${formData.name} foi adicionado com sucesso.` });
      }

      handleCloseDialog();
      invalidate();
    } catch (err: unknown) {
      console.error('Erro ao criar restaurante:', err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Verifique os dados e tente novamente.';
      toast({ title: 'Erro ao criar restaurante', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>

        {/* 4 metric cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'bg-orange-50',
            'bg-emerald-50',
            'bg-sky-50',
            'bg-violet-50',
          ].map((bg, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 space-y-2">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className={`h-9 w-9 rounded-xl ${bg} animate-pulse flex-shrink-0`} />
              </div>
            </div>
          ))}
        </div>

        {/* Restaurant list skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="mx-4 h-px bg-slate-100" />
                <div className="px-4 py-3 flex gap-2">
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Restaurantes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie todos os tenants do SaaS
          </p>
        </div>
        <Button onClick={() => setShowNewRestaurantDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo restaurante
        </Button>
      </div>

      {/* ── Cards de métricas ─────────────────────────────────────────────── */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={metricContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Restaurantes */}
        <motion.div variants={metricCardVariants} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Restaurantes
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics.totalRestaurants}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.activeRestaurants} ativos
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
              <Store className="h-4 w-4 text-[#F87116]" />
            </div>
          </div>
        </motion.div>

        {/* Faturamento */}
        <motion.div variants={metricCardVariants} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Faturamento total
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {formatCurrency(metrics.totalRevenue)}
              </p>
              <p className="text-xs text-slate-400 mt-1">histórico geral</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </motion.div>

        {/* Pedidos */}
        <motion.div variants={metricCardVariants} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Total de pedidos
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {metrics.totalOrders}
              </p>
              <p className="text-xs text-slate-400 mt-1">em todos os tenants</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
              <ShoppingCart className="h-4 w-4 text-sky-600" />
            </div>
          </div>
        </motion.div>

        {/* Ticket médio */}
        <motion.div variants={metricCardVariants} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Ticket médio
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {formatCurrency(
                  metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">por pedido</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Lista de restaurantes ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Todos os restaurantes
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({restaurants.length})
            </span>
          </h2>
        </div>

        {restaurants.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <Store className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600">Nenhum restaurante cadastrado</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">
              Crie o primeiro restaurante para começar
            </p>
            <Button onClick={() => setShowNewRestaurantDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar restaurante
            </Button>
          </div>
        ) : (
          <motion.div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            variants={restaurantListVariants}
            initial="hidden"
            animate="visible"
          >
            {restaurants.map((restaurant) => (
              <motion.div
                key={restaurant.id}
                variants={restaurantCardVariants}
                whileHover={{ scale: 1.018, y: -2, transition: { duration: 0.18 } }}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {restaurant.logo ? (
                      <img
                        src={restaurant.logo}
                        alt={restaurant.name}
                        className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Store className="h-5 w-5 text-[#F87116]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {restaurant.name}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">
                        {restaurant.phone || restaurant.slug}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ordersByRestaurant[restaurant.id] ?? 0} pedidos
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={restaurant.is_active ? 'default' : 'secondary'}
                    className={`flex-shrink-0 text-xs ${
                      restaurant.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                        : ''
                    }`}
                  >
                    {restaurant.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {/* Separador */}
                <div className="mx-4 h-px bg-slate-100" />

                {/* Ações do card */}
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {/* Admin — navega para o painel do restaurante */}
                  <Button
                    size="sm"
                    className="flex-1 min-w-[96px] bg-[#F87116] hover:bg-[#e56910] text-white gap-1.5"
                    onClick={() => {
                      /**
                       * Usa slug como identifier quando disponível.
                       * Fallback para UUID caso slug não esteja configurado.
                       */
                      const identifier = restaurant.slug || restaurant.id;
                      navigate(`/super-admin/restaurants/${identifier}`);
                    }}
                  >
                    <Layout className="h-3.5 w-3.5" />
                    Admin
                  </Button>

                  {/* Assinatura */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[96px] border-orange-200 text-[#F87116] hover:bg-orange-50 hover:border-orange-300 gap-1.5"
                    onClick={() => {
                      const identifier = restaurant.slug || restaurant.id;
                      navigate(`/super-admin/restaurants/${identifier}/subscription`);
                    }}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Assinatura
                  </Button>

                  {/* Cozinha */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-1"
                    onClick={() =>
                      window.open(`${window.location.origin}/kitchen?restaurant_id=${restaurant.id}`, '_blank')
                    }
                  >
                    <ChefHat className="h-3.5 w-3.5" />
                    Cozinha
                  </Button>

                  {/* Cardápio */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-1"
                    onClick={() => window.open(`/${restaurant.slug}`, '_blank')}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Cardápio
                  </Button>

                  {/* Ativar / Desativar */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-600 hover:bg-slate-50"
                    title={restaurant.is_active ? 'Desativar' : 'Ativar'}
                    onClick={() => toggleRestaurantStatus(restaurant.id, restaurant.is_active)}
                  >
                    {restaurant.is_active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {/* Soft delete */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    title="Remover restaurante"
                    onClick={() => {
                      setRestaurantToDelete(restaurant);
                      setDeleteConfirmName('');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Modal de confirmação de exclusão (Danger Modal) ─────────────── */}
      <Dialog
        open={!!restaurantToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setRestaurantToDelete(null);
            setDeleteConfirmName('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-red-700">Remover Restaurante</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  Você está prestes a remover permanentemente{' '}
                  <strong className="text-slate-800">{restaurantToDelete?.name}</strong>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Esta ação é irreversível na visão do painel
                  </p>
                  <p className="text-amber-700 text-xs">
                    Os dados históricos (pedidos, receita) serão preservados no banco para
                    fins de BI e auditoria. O restaurante apenas desaparecerá da listagem.
                  </p>
                </div>
                <div className="space-y-2 pt-1">
                  <Label htmlFor="delete-confirm" className="text-xs font-semibold text-slate-700">
                    Digite o nome do restaurante para confirmar:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={restaurantToDelete?.name}
                    className="border-red-200 focus-visible:ring-red-400"
                    autoComplete="off"
                  />
                  {deleteConfirmName.length > 0 &&
                    deleteConfirmName !== restaurantToDelete?.name && (
                    <p className="text-xs text-red-500">
                      O nome digitado não corresponde. Verifique maiúsculas e espaços.
                    </p>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRestaurantToDelete(null);
                setDeleteConfirmName('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== restaurantToDelete?.name}
              onClick={handleSoftDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Confirmar Remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="contact">Contato</TabsTrigger>
                <TabsTrigger value="hours">Horários</TabsTrigger>
                <TabsTrigger value="settings">Config.</TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </TabsTrigger>
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

              {/* Aba Acesso Admin ───────────────────────────────────────── */}
              <TabsContent value="admin" className="space-y-5 mt-4">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-semibold mb-0.5">Acesso do Administrador (opcional)</p>
                    <p className="text-blue-600 text-xs">
                      Se preencher o e-mail, o sistema cria o usuário administrador
                      automaticamente junto com o restaurante. O login pode ser feito
                      com o e-mail ou com o username.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_email">
                    <UserPlus className="h-3.5 w-3.5 inline mr-1" />
                    E-mail do Admin
                  </Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={adminData.email}
                    onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                    placeholder="admin@restaurante.com"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_login">Username (login alternativo)</Label>
                  <Input
                    id="admin_login"
                    type="text"
                    value={adminData.login}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        login: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
                      })
                    }
                    placeholder="admin.pizzaria"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Permite entrar com username + senha além do e-mail. Apenas letras, números, pontos e hifens.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="admin_password"
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminData.password}
                        onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                        placeholder="Mín. 6 caracteres"
                        autoComplete="new-password"
                        className="pr-10"
                        disabled={!adminData.email.trim()}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowAdminPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin_confirm_password">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="admin_confirm_password"
                        type={showAdminConfirmPassword ? 'text' : 'password'}
                        value={adminData.confirmPassword}
                        onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                        className={`pr-10 ${
                          adminData.confirmPassword && adminData.password !== adminData.confirmPassword
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : ''
                        }`}
                        disabled={!adminData.email.trim()}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowAdminConfirmPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        {showAdminConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {adminData.confirmPassword && adminData.password !== adminData.confirmPassword && (
                      <p className="text-xs text-red-500">As senhas não conferem.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : adminData.email.trim() ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Restaurante + Admin
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
