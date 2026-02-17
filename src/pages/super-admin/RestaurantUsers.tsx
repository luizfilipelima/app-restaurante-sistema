import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users as UsersIcon, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ROLE_LABELS: Record<string, string> = {
  [UserRole.RESTAURANT_ADMIN]: 'Admin do restaurante',
  [UserRole.KITCHEN]: 'Cozinha', // legado: apenas exibição na lista
};

export default function SuperAdminRestaurantUsers() {
  const { restaurantId: paramId } = useParams<{ restaurantId: string }>();
  const contextId = useAdminRestaurantId();
  const restaurantId = paramId || contextId;
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    login: '',
    role: UserRole.RESTAURANT_ADMIN as string,
  });

  useEffect(() => {
    if (restaurantId) loadUsers();
  }, [restaurantId]);

  const loadUsers = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as User[]) || []);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro ao carregar usuários',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      setSubmitting(true);
      const body: { email: string; password: string; role: string; restaurant_id: string; login?: string } = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        restaurant_id: restaurantId,
      };
      if (formData.login.trim()) body.login = formData.login.trim();
      const { data, error } = await supabase.functions.invoke('create-restaurant-user', { body });

      // Mostrar mensagem da Edge Function (ex.: 403, 400) em vez de só "non-2xx"
      if (data?.error) throw new Error(data.error);
      if (error) throw error;

      toast({ title: 'Usuário criado', description: `${formData.email} foi cadastrado.` });
      setFormData({ email: '', password: '', login: '', role: UserRole.RESTAURANT_ADMIN });
      setShowForm(false);
      loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível criar o usuário.';
      toast({
        title: 'Erro ao criar usuário',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Restaurante não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UsersIcon className="h-8 w-8" />
          Usuários do restaurante
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo usuário
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@restaurante.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="login">Usuário / login (opcional)</Label>
                <Input
                  id="login"
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  placeholder="Para entrar com usuário em vez de email"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Label>Função</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.RESTAURANT_ADMIN}>
                      {ROLE_LABELS[UserRole.RESTAURANT_ADMIN]} (recepcionista e cozinha)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ email: '', password: '', login: '', role: UserRole.RESTAURANT_ADMIN });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-4">
              É necessário ter a Edge Function &quot;create-restaurant-user&quot; publicada no Supabase.
              Caso apareça erro ao cadastrar, use o script{' '}
              <code className="bg-muted px-1 rounded">scripts/criar-usuarios.js</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuários deste restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum usuário cadastrado para este restaurante.
            </p>
          ) : (
            <ul className="divide-y">
              {users.map((u) => (
                <li key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{u.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
