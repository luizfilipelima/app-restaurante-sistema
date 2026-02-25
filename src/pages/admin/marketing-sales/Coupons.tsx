import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { useAdminRestaurantId, useAdminCurrency, useAdminBasePath, useAdminRestaurant } from '@/contexts/AdminRestaurantContext';
import { useRestaurant } from '@/hooks/queries';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import { useDiscountCoupons } from '@/hooks/queries/useDiscountCoupons';
import type { DiscountCoupon } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Ticket, Plus, Pencil, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { useAdminTranslation } from '@/hooks/admin/useAdminTranslation';
import { toast } from '@/hooks/shared/use-toast';
import { formatPrice } from '@/lib/priceHelper';
import { convertPriceToStorage, convertPriceFromStorage, getCurrencySymbol } from '@/lib/priceHelper';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const restaurantId = useAdminRestaurantId();
  const restaurant = useAdminRestaurant()?.restaurant ?? null;
  const { data: restaurantData } = useRestaurant(restaurantId);
  const currency = useAdminCurrency();
  const basePath = useAdminBasePath();
  const { t } = useAdminTranslation();
  const { coupons, loading, createCoupon, updateCoupon, deleteCoupon, refetch } = useDiscountCoupons(restaurantId);

  const discountCouponsEnabled = (restaurantData as { discount_coupons_enabled?: boolean | null })?.discount_coupons_enabled !== false;
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCoupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    is_active: true,
    max_uses: '',
    valid_from: '',
    valid_until: '',
  });

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({
      code: '',
      discount_type: 'percent',
      discount_value: '10',
      is_active: true,
      max_uses: '',
      valid_from: '',
      valid_until: '',
    });
    setModalOpen(true);
  };

  const openEdit = (coupon: DiscountCoupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_type === 'percent'
        ? String(coupon.discount_value)
        : String(convertPriceFromStorage(coupon.discount_value, currency)),
      is_active: coupon.is_active,
      max_uses: coupon.max_uses != null ? String(coupon.max_uses) : '',
      valid_from: coupon.valid_from ? format(new Date(coupon.valid_from), 'yyyy-MM-dd') : '',
      valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), 'yyyy-MM-dd') : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !form.code.trim()) return;

    const discountValue = form.discount_type === 'percent'
      ? Math.min(100, Math.max(0, parseInt(form.discount_value, 10) || 0))
      : convertPriceToStorage(form.discount_value, currency);

    if (Number.isNaN(discountValue) || discountValue < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    if (form.discount_type === 'percent' && discountValue > 100) {
      toast({ title: 'Percentual deve ser entre 0 e 100', variant: 'destructive' });
      return;
    }

    const maxUses = form.max_uses.trim() ? parseInt(form.max_uses, 10) : null;
    if (maxUses != null && (Number.isNaN(maxUses) || maxUses < 1)) {
      toast({ title: 'Uso máximo inválido', variant: 'destructive' });
      return;
    }

    const validFrom = form.valid_from ? `${form.valid_from}T00:00:00` : null;
    const validUntil = form.valid_until ? `${form.valid_until}T23:59:59` : null;
    if (validFrom && validUntil && new Date(validUntil) < new Date(validFrom)) {
      toast({ title: 'Data de fim deve ser após o início', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, {
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_type === 'percent' ? discountValue : Math.round(discountValue),
          is_active: form.is_active,
          max_uses: maxUses,
          valid_from: validFrom,
          valid_until: validUntil,
        });
        toast({ title: t('coupons.updateOk') });
      } else {
        await createCoupon({
          restaurant_id: restaurantId,
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_type === 'percent' ? discountValue : Math.round(discountValue),
          is_active: form.is_active,
          max_uses: maxUses,
          valid_from: validFrom,
          valid_until: validUntil,
        });
        toast({ title: t('coupons.createOk') });
      }
      setModalOpen(false);
      setEditingCoupon(null);
      refetch();
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar cupom',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!deleteTarget || deleteTarget.id !== id) return;
    setDeleting(true);
    try {
      await deleteCoupon(id);
      toast({ title: t('coupons.deleteOk') });
      setDeleteTarget(null);
      refetch();
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const toggleDiscountCouponsEnabled = async () => {
    if (!restaurantId) return;
    setTogglingGlobal(true);
    try {
      const newValue = !discountCouponsEnabled;
      const { error } = await supabase
        .from('restaurants')
        .update({ discount_coupons_enabled: newValue, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      invalidatePublicMenuCache(queryClient, restaurant?.slug);
      toast({ title: newValue ? 'Cupons de desconto ativados' : 'Cupons de desconto desativados' });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setTogglingGlobal(false);
    }
  };

  const stats = {
    all: coupons.length,
    active: coupons.filter((c) => c.is_active).length,
    inactive: coupons.filter((c) => !c.is_active).length,
    totalUses: coupons.reduce((s, c) => s + (c.use_count ?? 0), 0),
  };

  const filteredCoupons =
    statusFilter === 'all'
      ? coupons
      : statusFilter === 'active'
      ? coupons.filter((c) => c.is_active)
      : coupons.filter((c) => !c.is_active);

  const formatDiscount = (c: DiscountCoupon) =>
    c.discount_type === 'percent'
      ? `${c.discount_value}%`
      : formatPrice(c.discount_value, currency);

  const formatValidity = (c: DiscountCoupon) => {
    if (!c.valid_from && !c.valid_until) return '—';
    const from = c.valid_from ? format(new Date(c.valid_from), 'dd/MM/yyyy', { locale: ptBR }) : '...';
    const until = c.valid_until ? format(new Date(c.valid_until), 'dd/MM/yyyy', { locale: ptBR }) : '...';
    return `${from} → ${until}`;
  };

  if (loading && coupons.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full">
      {/* Etapa 1: Header + botões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            {t('coupons.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('coupons.subtitle')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link to={`${basePath}/menu`}>
              Central do Cardápio
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button onClick={openCreate} size="sm" className="sm:h-10 sm:px-6">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {t('coupons.addCoupon')}
          </Button>
        </div>
      </div>

      {/* Etapa 2: Toggle global com Switch */}
      <Card className="rounded-xl border border-border">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Cupons no checkout</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {discountCouponsEnabled
                  ? 'Clientes podem aplicar cupons no checkout.'
                  : 'Cupons não aparecem no checkout.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {togglingGlobal && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={discountCouponsEnabled}
              onCheckedChange={toggleDiscountCouponsEnabled}
              disabled={togglingGlobal}
              aria-label="Ativar ou desativar cupons de desconto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas (quando há cupons) */}
      {coupons.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl border border-border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.all}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ativos</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inativos</p>
              <p className="text-2xl font-bold text-muted-foreground mt-1">{stats.inactive}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usos totais</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.totalUses}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {coupons.length === 0 ? (
        /* Etapa 6: Empty state melhorado */
        <Card className="rounded-xl border border-border">
          <CardContent className="p-14 sm:p-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
              <Ticket className="h-10 w-10 text-primary" />
            </div>
            <p className="font-semibold text-lg sm:text-xl text-foreground mb-2">{t('coupons.noCoupons')}</p>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">{t('coupons.noCouponsDesc')}</p>
            <Button size="lg" onClick={openCreate} className="min-w-[200px]">
              <Plus className="h-5 w-5 mr-2" />
              Criar primeiro cupom
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList className="h-11 px-1 rounded-xl">
                <TabsTrigger value="all" className="gap-2 px-4">
                  {t('coupons.filterAll')}
                  <span className="text-xs text-muted-foreground">({stats.all})</span>
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-2 px-4">
                  {t('coupons.filterActive')}
                  <span className="text-xs text-muted-foreground">({stats.active})</span>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="gap-2 px-4">
                  {t('coupons.filterInactive')}
                  <span className="text-xs text-muted-foreground">({stats.inactive})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="rounded-xl border border-border">
            {filteredCoupons.length === 0 ? (
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-4">
                  {statusFilter === 'active' ? 'Nenhum cupom ativo.' : 'Nenhum cupom inativo.'}
                </p>
                <Button variant="outline" onClick={() => setStatusFilter('all')}>
                  Ver todos
                </Button>
              </CardContent>
            ) : (
              <>
                {/* Etapa 3: Tabela desktop com ajustes */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-border">
                        <TableHead className="px-4 py-4">{t('coupons.tableCode')}</TableHead>
                        <TableHead className="px-4 py-4">{t('coupons.tableType')}</TableHead>
                        <TableHead className="px-4 py-4">{t('coupons.tableValue')}</TableHead>
                        <TableHead className="px-4 py-4">{t('coupons.tableUses')}</TableHead>
                        <TableHead className="px-4 py-4">{t('coupons.tableStatus')}</TableHead>
                        <TableHead className="px-4 py-4">{t('coupons.tableValid')}</TableHead>
                        <TableHead className="w-[100px] px-4 py-4 text-right">{t('coupons.tableActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCoupons.map((coupon) => (
                        <TableRow
                          key={coupon.id}
                          className="hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                        >
                          <TableCell className="px-4 py-4">
                            <code className="font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                              {coupon.code}
                            </code>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <span className="text-sm text-muted-foreground">
                              {coupon.discount_type === 'percent' ? t('coupons.percent') : t('coupons.fixed')}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatDiscount(coupon)}</span>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <span className="text-sm">
                              {coupon.use_count}
                              {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ''}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge
                              variant="outline"
                              className={coupon.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}
                            >
                              {coupon.is_active ? t('coupons.filterActive') : t('coupons.filterInactive')}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm text-muted-foreground">{formatValidity(coupon)}</TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(coupon)}
                                aria-label={`Editar cupom ${coupon.code}`}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget({ id: coupon.id, name: coupon.code })}
                                className="text-destructive hover:text-destructive"
                                aria-label={`Excluir cupom ${coupon.code}`}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Etapa 4: Cards responsivos mobile */}
                <div className="md:hidden divide-y divide-border">
                  {filteredCoupons.map((coupon) => (
                    <Card key={coupon.id} className="rounded-none border-0 shadow-none">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <code className="font-mono font-semibold text-primary text-sm">{coupon.code}</code>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${coupon.is_active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                          >
                            {coupon.is_active ? t('coupons.filterActive') : t('coupons.filterInactive')}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            {coupon.discount_type === 'percent' ? t('coupons.percent') : t('coupons.fixed')} · <strong className="text-emerald-600 text-foreground">{formatDiscount(coupon)}</strong>
                          </span>
                          <span>
                            {coupon.use_count}
                            {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatValidity(coupon)}</p>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(coupon)}
                            aria-label={`Editar cupom ${coupon.code}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget({ id: coupon.id, name: coupon.code })}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            aria-label={`Excluir cupom ${coupon.code}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('coupons.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? t('coupons.deleteDesc', { name: deleteTarget.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingCoupon(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 pb-4">
            <DialogTitle className="flex items-center gap-2.5 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Ticket className="h-5 w-5" />
              </div>
              {editingCoupon ? 'Editar cupom' : t('coupons.addCoupon')}
            </DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Configure o código e o valor do desconto. O cliente digita o código no checkout.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            {/* Seção 1: Básico */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Básico</h3>
              <div className="space-y-2">
                <Label htmlFor="code">{t('coupons.code')} *</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder={t('coupons.codePlaceholder')}
                  className="font-mono uppercase"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('coupons.discountType')}</Label>
                  <div className="flex gap-2">
                    <label
                      className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                        form.discount_type === 'percent'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="discount_type"
                        checked={form.discount_type === 'percent'}
                        onChange={() => setForm((f) => ({ ...f, discount_type: 'percent', discount_value: f.discount_value || '10' }))}
                        className="sr-only"
                      />
                      {t('coupons.percent')}
                    </label>
                    <label
                      className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                        form.discount_type === 'fixed'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="discount_type"
                        checked={form.discount_type === 'fixed'}
                        onChange={() => setForm((f) => ({ ...f, discount_type: 'fixed', discount_value: '' }))}
                        className="sr-only"
                      />
                      {t('coupons.fixed')}
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_value">{t('coupons.discountValue')} *</Label>
                  <div className="relative">
                    {form.discount_type === 'percent' ? (
                      <>
                        <Input
                          id="discount_value"
                          type="number"
                          min={1}
                          max={100}
                          value={form.discount_value}
                          onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                          placeholder={t('coupons.discountPercentPlaceholder')}
                          className="pr-8"
                          required
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </>
                    ) : (
                      <>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{getCurrencySymbol(currency)}</span>
                        <Input
                          id="discount_value"
                          type="text"
                          inputMode="decimal"
                          value={form.discount_value}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              discount_value: currency === 'PYG' ? e.target.value.replace(/\D/g, '') : e.target.value,
                            }))
                          }
                          placeholder={t('coupons.discountFixedPlaceholder')}
                          className="pl-10"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Seção 2: Limites */}
            <section className="space-y-4 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold text-foreground">Limites</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_uses">{t('coupons.maxUses')}</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    placeholder={t('coupons.maxUsesPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para ilimitado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_from">{t('coupons.validFrom')}</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">{t('coupons.validUntil')}</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
            </section>

            {/* Seção 3: Status */}
            <section className="space-y-4 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold text-foreground">Status</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium">{t('coupons.isActive')}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Cupom ativo pode ser aplicado no checkout.</p>
                </div>
              </label>
            </section>

            <DialogFooter className="pt-4 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[120px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingCoupon ? 'Salvar alterações' : 'Criar cupom'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
