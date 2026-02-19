import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  X,
  Mail,
  Key,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  UserX,
  ChevronDown,
  Loader2,
  Crown,
  User,
  UtensilsCrossed,
  Briefcase,
  CreditCard,
  SendHorizonal,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RestaurantUser {
  user_id: string;
  email: string;
  login: string | null;
  system_role: string;
  restaurant_role: RestaurantRole;
  is_active: boolean;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

type RestaurantRole = 'owner' | 'manager' | 'waiter' | 'cashier' | 'kitchen';

// ─── Config de Cargos ─────────────────────────────────────────────────────────

const ROLES: {
  value: RestaurantRole;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'owner',
    label: 'Proprietário',
    description: 'Acesso total ao restaurante',
    icon: Crown,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'manager',
    label: 'Gerente',
    description: 'Acesso operacional sem dados financeiros',
    icon: Briefcase,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    value: 'waiter',
    label: 'Garçom',
    description: 'Pedidos e mesas, sem editar cardápio',
    icon: User,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  {
    value: 'cashier',
    label: 'Caixa',
    description: 'Operador de caixa e buffet',
    icon: CreditCard,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    value: 'kitchen',
    label: 'Cozinha (KDS)',
    description: 'Acesso apenas ao KDS',
    icon: UtensilsCrossed,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
];

const getRoleConfig = (role: RestaurantRole) =>
  ROLES.find((r) => r.value === role) ?? ROLES[1];

// ─── Componente principal ─────────────────────────────────────────────────────

interface RestaurantUsersPanelProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName?: string;
}

export default function RestaurantUsersPanel({
  open,
  onClose,
  restaurantId,
  restaurantName,
}: RestaurantUsersPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RestaurantRole>('manager');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Query: lista de usuários ─────────────────────────────────────────────────
  const queryKey = ['restaurant-users', restaurantId];

  const { data: users = [], isLoading } = useQuery<RestaurantUser[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'super_admin_list_restaurant_users',
        { p_restaurant_id: restaurantId }
      );
      if (error) throw error;
      return (data as RestaurantUser[]) ?? [];
    },
    enabled: open && !!restaurantId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  // ── Mutation: alterar cargo ───────────────────────────────────────────────────
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: RestaurantRole }) => {
      const { data, error } = await supabase.rpc('super_admin_update_user_role', {
        p_user_id: userId,
        p_restaurant_id: restaurantId,
        p_role: role,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Cargo atualizado com sucesso.' });
      setEditingUserId(null);
      invalidate();
    },
    onError: (err) =>
      toast({ title: 'Erro ao atualizar cargo', description: String(err), variant: 'destructive' }),
  });

  // ── Mutation: desativar/reativar ──────────────────────────────────────────────
  const toggleActive = async (user: RestaurantUser) => {
    const fn = user.is_active
      ? 'super_admin_deactivate_restaurant_user'
      : 'super_admin_reactivate_restaurant_user';

    setActionLoading(`toggle-${user.user_id}`);
    try {
      const { error } = await supabase.rpc(fn, {
        p_user_id: user.user_id,
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      toast({
        title: user.is_active ? 'Usuário desativado.' : 'Usuário reativado.',
      });
      invalidate();
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Ação: reenviar e-mail de confirmação (via admin API do Supabase) ──────────
  const resendConfirmation = async (email: string) => {
    setActionLoading(`resend-${email}`);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      toast({ title: 'E-mail de confirmação reenviado.' });
    } catch (err) {
      toast({ title: 'Erro ao reenviar e-mail', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Ação: enviar link para redefinição de senha ───────────────────────────────
  const sendPasswordReset = async (email: string) => {
    setActionLoading(`reset-${email}`);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'Link de redefinição enviado.',
        description: `Um link foi enviado para ${email}.`,
      });
    } catch (err) {
      toast({ title: 'Erro ao enviar link', description: String(err), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reset ao fechar ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      setEditingUserId(null);
    }
  }, [open]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900">
                  Gestão de Usuários
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  {restaurantName ?? 'Restaurante'} · acesso exclusivo do super-admin
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showAddForm && (
                <Button
                  size="sm"
                  className="h-8 bg-[#F87116] hover:bg-[#ea580c] text-white text-xs gap-1.5"
                  onClick={() => setShowAddForm(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Novo usuário
                </Button>
              )}
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body (scrollável) ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Formulário de novo usuário */}
          {showAddForm && (
            <div className="border-b border-slate-100 bg-slate-50/60">
              <AddUserForm
                restaurantId={restaurantId}
                onSuccess={() => { setShowAddForm(false); invalidate(); }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Lista de usuários */}
          <div className="px-6 py-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Nenhum usuário cadastrado</p>
                <p className="text-xs text-slate-400 mt-1">
                  Clique em "Novo usuário" para adicionar o primeiro acesso.
                </p>
              </div>
            ) : (
              users.map((user) => {
                const roleConfig = getRoleConfig(user.restaurant_role);
                const RoleIcon = roleConfig.icon;
                const isEditingThis = editingUserId === user.user_id;

                return (
                  <div
                    key={user.user_id}
                    className={`rounded-xl border transition-colors ${
                      user.is_active
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="px-4 py-3.5 flex items-start gap-3">
                      {/* Avatar */}
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${roleConfig.bg} ${roleConfig.border}`}
                      >
                        <RoleIcon className={`h-4 w-4 ${roleConfig.color}`} />
                      </div>

                      {/* Dados */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {user.login ? `@${user.login}` : user.email}
                          </span>
                          {user.login && (
                            <span className="text-xs text-slate-400 truncate">{user.email}</span>
                          )}
                          {!user.is_active && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              Inativo
                            </Badge>
                          )}
                          {!user.email_confirmed && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 border-amber-300 text-amber-700"
                            >
                              E-mail pendente
                            </Badge>
                          )}
                        </div>

                        {/* Cargo (view/edit) */}
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Select
                              value={editingRole}
                              onValueChange={(v) => setEditingRole(v as RestaurantRole)}
                            >
                              <SelectTrigger className="h-7 text-xs w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    <div className="flex items-center gap-2">
                                      <r.icon className={`h-3.5 w-3.5 ${r.color}`} />
                                      <span>{r.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-[#F87116] hover:bg-[#ea580c] text-white px-3"
                              disabled={updateRole.isPending}
                              onClick={() =>
                                updateRole.mutate({
                                  userId: user.user_id,
                                  role: editingRole,
                                })
                              }
                            >
                              {updateRole.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Salvar'
                              )}
                            </Button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${roleConfig.bg} ${roleConfig.border} ${roleConfig.color}`}
                            onClick={() => {
                              setEditingUserId(user.user_id);
                              setEditingRole(user.restaurant_role);
                            }}
                            title="Clique para alterar cargo"
                          >
                            <RoleIcon className="h-2.5 w-2.5" />
                            {roleConfig.label}
                            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                          </button>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Reenviar confirmação */}
                        {!user.email_confirmed && (
                          <ActionButton
                            icon={Mail}
                            label="Reenviar e-mail de confirmação"
                            loading={actionLoading === `resend-${user.email}`}
                            onClick={() => resendConfirmation(user.email)}
                          />
                        )}

                        {/* Enviar link de redefinição de senha */}
                        <ActionButton
                          icon={Key}
                          label="Enviar link para redefinir senha"
                          loading={actionLoading === `reset-${user.email}`}
                          onClick={() => sendPasswordReset(user.email)}
                        />

                        {/* Ativar / Desativar */}
                        <ActionButton
                          icon={user.is_active ? UserX : UserCheck}
                          label={user.is_active ? 'Desativar usuário' : 'Reativar usuário'}
                          loading={actionLoading === `toggle-${user.user_id}`}
                          danger={user.is_active}
                          onClick={() => toggleActive(user)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="h-3 w-3" />
            <span>Apenas super-admins podem gerenciar usuários de restaurantes.</span>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componente: botão de ação com ícone ──────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  loading,
  danger = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  loading: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      disabled={loading}
      onClick={onClick}
      className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-400 border-red-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
          : 'text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
      }`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── Sub-componente: formulário de adição de usuário ─────────────────────────

interface AddUserFormProps {
  restaurantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddUserForm({ restaurantId, onSuccess, onCancel }: AddUserFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    email: '',
    login: '',
    password: '',
    confirmPassword: '',
    role: 'manager' as RestaurantRole,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo de 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('super_admin_add_restaurant_user', {
        p_restaurant_id: restaurantId,
        p_email: form.email.trim().toLowerCase(),
        p_password: form.password,
        p_login: form.login.trim() || null,
        p_role: form.role,
      });

      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('duplicate_email'))
          throw new Error('Já existe um usuário com este e-mail.');
        if (msg.includes('duplicate_login'))
          throw new Error('Já existe um usuário com este nome de usuário.');
        throw new Error(msg);
      }

      toast({ title: 'Usuário criado com sucesso!' });
      onSuccess();
    } catch (err) {
      toast({ title: 'Erro ao criar usuário', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLES.find((r) => r.value === form.role)!;

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#F87116]" />
          <span className="text-sm font-semibold text-slate-800">Novo usuário</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">E-mail *</Label>
          <Input
            type="email"
            placeholder="usuario@email.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Usuário (login)
            <span className="ml-1 text-slate-400 font-normal">opcional</span>
          </Label>
          <Input
            type="text"
            placeholder="nome_usuario"
            value={form.login}
            onChange={(e) => set('login', e.target.value.toLowerCase().replace(/\s/g, '_'))}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Cargo *</Label>
          <Select value={form.role} onValueChange={(v) => set('role', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <div className="flex items-center gap-2">
                    <r.icon className={`h-3.5 w-3.5 ${r.color}`} />
                    <span>{r.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Senha *</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required
              className="h-9 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Confirmar senha *</Label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              required
              className="h-9 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Preview do cargo selecionado */}
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${selectedRole.bg} ${selectedRole.border}`}
      >
        <selectedRole.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${selectedRole.color}`} />
        <div>
          <p className={`font-semibold ${selectedRole.color}`}>{selectedRole.label}</p>
          <p className="text-slate-500 mt-0.5">{selectedRole.description}</p>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="h-8 text-xs bg-[#F87116] hover:bg-[#ea580c] text-white gap-1.5"
        >
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando…</>
          ) : (
            <><SendHorizonal className="h-3.5 w-3.5" />Criar usuário</>
          )}
        </Button>
      </div>
    </form>
  );
}
