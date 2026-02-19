import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  useSuperAdminRestaurants,
  useInvalidateSuperAdminRestaurants,
} from '@/hooks/queries/useSuperAdminRestaurants';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, generateSlug } from '@/lib/utils';
import { uploadRestaurantLogo } from '@/lib/imageUpload';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search,
  ExternalLink,
  MoreHorizontal,
  Power,
  CheckCircle2,
  XCircle,
  ReceiptText,
} from 'lucide-react';
import { Restaurant, DayKey, PrintPaperWidth } from '@/types';
import { toast } from '@/hooks/use-toast';

// ─── Animações ────────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as [number,number,number,number] } },
};

// ─── Dias da semana ───────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Segunda'  },
  { key: 'tue', label: 'Terça'    },
  { key: 'wed', label: 'Quarta'   },
  { key: 'thu', label: 'Quinta'   },
  { key: 'fri', label: 'Sexta'    },
  { key: 'sat', label: 'Sábado'   },
  { key: 'sun', label: 'Domingo'  },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 group"
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accent} rounded-t-2xl`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 truncate">
            {label}
          </p>
          <p className="text-[28px] font-extrabold text-slate-900 leading-tight mt-1.5 tracking-tight">
            {value}
          </p>
          <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent.replace('bg-', 'bg-').replace('from-', 'bg-').replace('to-', '')} bg-opacity-10`}
          style={{ background: 'var(--kpi-bg)' }}>
          <Icon className="h-5 w-5 text-slate-600 group-hover:scale-110 transition-transform duration-200" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────────────────────

interface RestaurantCardProps {
  restaurant: Restaurant;
  orderCount: number;
  revenue: number;
  onAdmin: () => void;
  onSubscription: () => void;
  onKitchen: () => void;
  onMenu: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function RestaurantCard({
  restaurant, orderCount, revenue,
  onAdmin, onSubscription, onKitchen, onMenu, onToggle, onDelete,
}: RestaurantCardProps) {
  const initials = restaurant.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.div
      variants={fadeUp}
      layout
      className="group relative rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Status strip */}
      <div
        className={`absolute inset-x-0 top-0 h-[3px] transition-colors ${
          restaurant.is_active
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
            : 'bg-gradient-to-r from-slate-300 to-slate-400'
        }`}
      />

      {/* Main content */}
      <div className="p-4 flex items-start gap-3 pt-5">
        {/* Logo / Avatar */}
        {restaurant.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-12 w-12 rounded-xl object-cover flex-shrink-0 border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-bold text-white select-none">{initials}</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 truncate leading-tight">
              {restaurant.name}
            </h3>
            <span
              className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                restaurant.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {restaurant.is_active ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <XCircle className="h-2.5 w-2.5" />
              )}
              {restaurant.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {restaurant.slug ? `/${restaurant.slug}` : restaurant.phone || '—'}
          </p>

          {/* Mini stats */}
          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ShoppingCart className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-700">{orderCount}</span>
              <span>pedidos</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ReceiptText className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-700">{formatCurrency(revenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-slate-100" />

      {/* Action toolbar */}
      <div className="px-3 py-2.5 flex items-center gap-1.5">
        <ActionBtn icon={Layout}   label="Painel Admin"  accent onClick={onAdmin} />
        <ActionBtn icon={CreditCard} label="Assinatura"  onClick={onSubscription} />
        <ActionBtn icon={BookOpen}  label="Cardápio"     onClick={onMenu} />
        <ActionBtn icon={ChefHat}   label="Cozinha (KDS)" onClick={onKitchen} />
        <div className="flex-1" />
        <ActionBtn
          icon={restaurant.is_active ? EyeOff : Eye}
          label={restaurant.is_active ? 'Desativar' : 'Ativar'}
          onClick={onToggle}
        />
        <ActionBtn icon={Trash2} label="Remover restaurante" danger onClick={onDelete} />
      </div>
    </motion.div>
  );
}

// ─── Botão de ação do card ────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, onClick, accent = false, danger = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`relative flex items-center justify-center h-8 rounded-lg border text-xs font-medium transition-all duration-150 group/btn
        ${accent
          ? 'px-3 gap-1.5 bg-[#F87116] border-[#F87116] text-white hover:bg-[#e56910] hover:border-[#e56910] shadow-sm'
          : danger
          ? 'w-8 border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
          : 'w-8 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
        }`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {accent && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const INITIAL_FORM = {
  name: '', slug: '', phone: '', whatsapp: '',
  phone_country: 'BR' as 'BR' | 'PY',
  instagram_url: '', logo: '', is_active: true, always_open: false,
  opening_hours: {} as Record<DayKey, { open: string; close: string } | null>,
  print_auto_on_new_order: false, print_paper_width: '80mm' as PrintPaperWidth,
};
const INITIAL_ADMIN = { email: '', login: '', password: '', confirmPassword: '' };

export default function SuperAdminDashboard() {
  useAuthStore();
  const navigate  = useNavigate();
  const { data, isLoading } = useSuperAdminRestaurants();
  const invalidate = useInvalidateSuperAdminRestaurants();

  const restaurants        = data?.restaurants         ?? [];
  const ordersByRestaurant = data?.ordersByRestaurant   ?? {};
  const revenueByRestaurant = data?.revenueByRestaurant ?? {};
  const metrics            = data?.metrics ?? { totalRestaurants: 0, activeRestaurants: 0, totalRevenue: 0, totalOrders: 0 };

  const [search,  setSearch]  = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [toDelete, setToDelete]       = useState<Restaurant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [formData, setFormData]     = useState(INITIAL_FORM);
  const [adminData, setAdminData]   = useState(INITIAL_ADMIN);
  const [showAdminPwd,  setShowAdminPwd]  = useState(false);
  const [showAdminCPwd, setShowAdminCPwd] = useState(false);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.slug ?? '').toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q)
    );
  }, [restaurants, search]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCloseNew = () => {
    setShowNew(false);
    setFormData(INITIAL_FORM);
    setAdminData(INITIAL_ADMIN);
    setShowAdminPwd(false);
    setShowAdminCPwd(false);
  };

  const toggleStatus = async (id: string, active: boolean) => {
    const { error } = await supabase.from('restaurants').update({ is_active: !active }).eq('id', id);
    if (error) toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    else { invalidate(); toast({ title: `Restaurante ${!active ? 'ativado' : 'desativado'}.` }); }
  };

  const softDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', toDelete.id);
    if (error) toast({ title: 'Erro ao remover', variant: 'destructive' });
    else {
      invalidate();
      toast({ title: 'Restaurante removido', description: 'Dados históricos preservados.' });
    }
    setToDelete(null);
    setDeleteConfirm('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData((p) => ({ ...p, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = formData.slug.trim() || generateSlug(formData.name);
    if (!slug) { toast({ title: 'Nome inválido', variant: 'destructive' }); return; }

    const hasAdmin = adminData.email.trim() !== '';
    if (hasAdmin) {
      if (adminData.password.length < 6) { toast({ title: 'Senha do admin muito curta', variant: 'destructive' }); return; }
      if (adminData.password !== adminData.confirmPassword) { toast({ title: 'Senhas não conferem', variant: 'destructive' }); return; }
    }

    try {
      setSaving(true);
      if (hasAdmin) {
        const { data: rpc, error: rpcErr } = await supabase.rpc('super_admin_create_restaurant_with_admin', {
          p_restaurant_name: formData.name.trim(),
          p_slug: slug,
          p_phone: formData.phone.trim() || null,
          p_whatsapp: formData.whatsapp.trim() || null,
          p_admin_email: adminData.email.trim(),
          p_admin_password: adminData.password,
          p_admin_login: adminData.login.trim() || null,
        });
        if (rpcErr) throw rpcErr;
        const rid = (rpc as { restaurant_id: string }).restaurant_id;
        const extras: Record<string, unknown> = {
          instagram_url: formData.instagram_url.trim() || null,
          phone_country: formData.phone_country,
          always_open: formData.always_open,
          opening_hours: formData.opening_hours,
          print_auto_on_new_order: formData.print_auto_on_new_order,
          print_paper_width: formData.print_paper_width,
        };
        await supabase.from('restaurants').update(extras).eq('id', rid);
        if (formData.logo?.startsWith('data:')) {
          const blob = await (await fetch(formData.logo)).blob();
          const file = new File([blob], 'logo.png', { type: blob.type });
          const url  = await uploadRestaurantLogo(rid, file);
          await supabase.from('restaurants').update({ logo: url }).eq('id', rid);
        }
        toast({ title: 'Restaurante e admin criados!' });
      } else {
        const payload: Record<string, unknown> = {
          name: formData.name.trim(), slug,
          phone: formData.phone.trim(), whatsapp: formData.whatsapp.trim(),
          phone_country: formData.phone_country, instagram_url: formData.instagram_url.trim() || null,
          logo: formData.logo || null, is_active: formData.is_active,
          always_open: formData.always_open, opening_hours: formData.opening_hours,
          print_auto_on_new_order: formData.print_auto_on_new_order, print_paper_width: formData.print_paper_width,
        };
        const { data: ins, error } = await supabase.from('restaurants').insert(payload).select().single();
        if (error) throw error;
        if (formData.logo?.startsWith('data:')) {
          const blob = await (await fetch(formData.logo)).blob();
          const file = new File([blob], 'logo.png', { type: blob.type });
          const url  = await uploadRestaurantLogo(ins.id, file);
          await supabase.from('restaurants').update({ logo: url }).eq('id', ins.id);
        }
        toast({ title: 'Restaurante criado!' });
      }
      handleCloseNew();
      invalidate();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Tente novamente.';
      toast({ title: 'Erro ao criar restaurante', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-8 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <div className="p-4 flex gap-3">
                <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="mx-4 h-px bg-slate-100" />
              <div className="px-3 py-2.5 flex gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-6 lg:p-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Restaurantes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {metrics.totalRestaurants} cadastrados · {metrics.activeRestaurants} ativos
          </p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="gap-2 bg-[#F87116] hover:bg-[#e56910] text-white shadow-sm shadow-orange-200 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Novo restaurante
        </Button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={stagger} initial="hidden" animate="visible"
      >
        <KpiCard
          label="Restaurantes"
          value={String(metrics.totalRestaurants)}
          sub={`${metrics.activeRestaurants} ativos`}
          icon={Store}
          accent="bg-gradient-to-r from-orange-400 to-orange-500"
        />
        <KpiCard
          label="Faturamento total"
          value={formatCurrency(metrics.totalRevenue)}
          sub="histórico geral"
          icon={DollarSign}
          accent="bg-gradient-to-r from-emerald-400 to-emerald-500"
        />
        <KpiCard
          label="Total de pedidos"
          value={String(metrics.totalOrders)}
          sub="em todos os tenants"
          icon={ShoppingCart}
          accent="bg-gradient-to-r from-sky-400 to-sky-500"
        />
        <KpiCard
          label="Ticket médio"
          value={formatCurrency(metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0)}
          sub="por pedido"
          icon={TrendingUp}
          accent="bg-gradient-to-r from-violet-400 to-violet-500"
        />
      </motion.div>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Search + label */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Todos os restaurantes
            <span className="ml-2 text-slate-400 font-normal">({filtered.length})</span>
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar restaurante…"
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F87116]/20 focus:border-[#F87116] transition-colors"
            />
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-14 text-center">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Store className="h-6 w-6 text-[#F87116]" />
            </div>
            <p className="font-semibold text-slate-700">
              {search ? 'Nenhum resultado' : 'Nenhum restaurante cadastrado'}
            </p>
            <p className="text-sm text-slate-400 mt-1 mb-5">
              {search
                ? `Não encontramos "${search}". Tente outro termo.`
                : 'Crie o primeiro restaurante para começar.'}
            </p>
            {!search && (
              <Button onClick={() => setShowNew(true)} className="gap-2 bg-[#F87116] hover:bg-[#e56910] text-white">
                <Plus className="h-4 w-4" />
                Criar restaurante
              </Button>
            )}
          </div>
        )}

        {/* Grid */}
        <AnimatePresence mode="popLayout">
          <motion.div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            variants={stagger} initial="hidden" animate="visible"
          >
            {filtered.map((r) => {
              const id = r.slug || r.id;
              return (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  orderCount={ordersByRestaurant[r.id] ?? 0}
                  revenue={revenueByRestaurant[r.id] ?? 0}
                  onAdmin={() => navigate(`/super-admin/restaurants/${id}`)}
                  onSubscription={() => navigate(`/super-admin/restaurants/${id}/subscription`)}
                  onKitchen={() => window.open(`${window.location.origin}/kitchen?restaurant_id=${r.id}`, '_blank')}
                  onMenu={() => window.open(`/${r.slug}`, '_blank')}
                  onToggle={() => toggleStatus(r.id, r.is_active)}
                  onDelete={() => { setToDelete(r); setDeleteConfirm(''); }}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modal: Confirmar exclusão ─────────────────────────────────────── */}
      <Dialog open={!!toDelete} onOpenChange={(v) => { if (!v) { setToDelete(null); setDeleteConfirm(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-red-700">Remover Restaurante</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  Você está prestes a remover{' '}
                  <strong className="text-slate-800">{toDelete?.name}</strong>.
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="font-semibold text-amber-800 mb-1 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Dados históricos serão preservados para BI e auditoria.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Digite o nome do restaurante para confirmar:
                  </Label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={toDelete?.name}
                    className="border-red-200 focus-visible:ring-red-400"
                  />
                  {deleteConfirm.length > 0 && deleteConfirm !== toDelete?.name && (
                    <p className="text-xs text-red-500">Nome não confere. Verifique maiúsculas.</p>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setToDelete(null); setDeleteConfirm(''); }}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteConfirm !== toDelete?.name} onClick={softDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Confirmar Remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Novo Restaurante ───────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Restaurante</DialogTitle>
            <DialogDescription>
              Preencha os dados do restaurante. Você poderá editar depois nas configurações.
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
                  <ShieldCheck className="h-3.5 w-3.5" />Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" value={formData.name}
                      onChange={(e) => { const n = e.target.value; setFormData((p) => ({ ...p, name: n, slug: p.slug || generateSlug(n) })); }}
                      placeholder="Ex: Pizzaria do João" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <Input id="slug" value={formData.slug}
                      onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                      placeholder="pizzaria-do-joao" required />
                    <p className="text-xs text-slate-400">{window.location.origin}/{formData.slug || 'slug'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    {formData.logo && <img src={formData.logo} alt="Logo" className="h-16 w-16 rounded-xl object-cover border" />}
                    <Input type="file" accept="image/*" onChange={handleLogoUpload} className="cursor-pointer" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.is_active}
                    onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-slate-700">Restaurante ativo (visível no cardápio público)</span>
                </label>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>País</Label>
                  <Select value={formData.phone_country} onValueChange={(v: 'BR' | 'PY') => setFormData((p) => ({ ...p, phone_country: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">Brasil</SelectItem>
                      <SelectItem value="PY">Paraguai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input id="phone" type="tel" value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp *</Label>
                    <Input id="whatsapp" type="tel" value={formData.whatsapp}
                      onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="11999999999" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram"><Instagram className="h-4 w-4 inline mr-1" />Instagram</Label>
                  <Input id="instagram" type="url" value={formData.instagram_url}
                    onChange={(e) => setFormData((p) => ({ ...p, instagram_url: e.target.value }))}
                    placeholder="https://instagram.com/restaurante" />
                </div>
              </TabsContent>

              <TabsContent value="hours" className="space-y-4 mt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input type="checkbox" checked={formData.always_open}
                    onChange={(e) => setFormData((p) => ({ ...p, always_open: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-slate-700">Sempre aberto (24 horas)</span>
                </label>
                {!formData.always_open && DAYS.map((day) => (
                  <div key={day.key} className="flex items-center gap-4">
                    <div className="w-24 flex-shrink-0"><Label>{day.label}</Label></div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input type="time" value={formData.opening_hours[day.key]?.open || ''}
                        onChange={(e) => { const open = e.target.value; const close = formData.opening_hours[day.key]?.close || '';
                          setFormData((p) => ({ ...p, opening_hours: { ...p.opening_hours, [day.key]: open && close ? { open, close } : null } })); }} />
                      <Input type="time" value={formData.opening_hours[day.key]?.close || ''}
                        onChange={(e) => { const close = e.target.value; const open = formData.opening_hours[day.key]?.open || '';
                          setFormData((p) => ({ ...p, opening_hours: { ...p.opening_hours, [day.key]: open && close ? { open, close } : null } })); }} />
                    </div>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setFormData((p) => ({ ...p, opening_hours: { ...p.opening_hours, [day.key]: null } }))}>
                      Fechado
                    </Button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Printer className="h-4 w-4" />Impressão
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.print_auto_on_new_order}
                      onChange={(e) => setFormData((p) => ({ ...p, print_auto_on_new_order: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-slate-700">Impressão automática ao receber novo pedido</span>
                  </label>
                  <div className="space-y-2">
                    <Label>Largura do papel</Label>
                    <Select value={formData.print_paper_width} onValueChange={(v: PrintPaperWidth) => setFormData((p) => ({ ...p, print_paper_width: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">58mm</SelectItem>
                        <SelectItem value="80mm">80mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="space-y-5 mt-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-semibold mb-0.5">Acesso do Administrador (opcional)</p>
                    <p className="text-xs text-blue-600">Se preencher o e-mail, o admin é criado automaticamente com o restaurante.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_email"><UserPlus className="h-3.5 w-3.5 inline mr-1" />E-mail do Admin</Label>
                  <Input id="admin_email" type="email" value={adminData.email}
                    onChange={(e) => setAdminData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="admin@restaurante.com" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_login">Username (login alternativo)</Label>
                  <Input id="admin_login" type="text" value={adminData.login}
                    onChange={(e) => setAdminData((p) => ({ ...p, login: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                    placeholder="admin.pizzaria" autoComplete="off" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <div className="relative">
                      <Input type={showAdminPwd ? 'text' : 'password'} value={adminData.password}
                        onChange={(e) => setAdminData((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Mín. 6 caracteres" autoComplete="new-password" className="pr-10" disabled={!adminData.email.trim()} />
                      <button type="button" tabIndex={-1} onClick={() => setShowAdminPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showAdminPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha</Label>
                    <div className="relative">
                      <Input type={showAdminCPwd ? 'text' : 'password'} value={adminData.confirmPassword}
                        onChange={(e) => setAdminData((p) => ({ ...p, confirmPassword: e.target.value }))}
                        placeholder="Repita a senha" autoComplete="new-password" className="pr-10"
                        disabled={!adminData.email.trim()} />
                      <button type="button" tabIndex={-1} onClick={() => setShowAdminCPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showAdminCPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              <Button type="button" variant="outline" onClick={handleCloseNew}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[#F87116] hover:bg-[#e56910] text-white">
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</>
                ) : adminData.email.trim() ? (
                  <><UserPlus className="h-4 w-4 mr-2" />Criar Restaurante + Admin</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />Criar Restaurante</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
