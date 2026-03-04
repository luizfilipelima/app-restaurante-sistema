import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import AdminRedirect from '@/components/admin/_layout/AdminRedirect';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [effectiveRole, setEffectiveRole] = useState<string | null | undefined>(undefined);

  // Resolve cargo efetivo (restaurant_user_roles) para saber se é garçom
  useEffect(() => {
    if (!user?.restaurant_id || !user?.id || user.role === UserRole.SUPER_ADMIN) {
      setEffectiveRole(user?.role ?? null);
      return;
    }
    supabase
      .from('restaurant_user_roles')
      .select('role')
      .eq('restaurant_id', user.restaurant_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setEffectiveRole(data?.role ?? user.role ?? null));
  }, [user?.id, user?.restaurant_id, user?.role]);

  // Garçom não tem acesso ao painel; redireciona para o Terminal do Garçom (por user.role ou cargo em RUR)
  const isWaiter = effectiveRole === 'waiter' || user?.role === UserRole.WAITER;
  const stillResolvingRole = !!user?.restaurant_id && effectiveRole === undefined;
  if (isWaiter) return <AdminRedirect />;
  if (stillResolvingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-10 w-10 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-destructive rounded-full p-3">
              <ShieldAlert className="h-6 w-6 text-destructive-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Acesso Negado</CardTitle>
          <CardDescription className="text-center">
            Você não tem permissão para acessar esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={() => navigate(-1)} variant="outline">
            Voltar
          </Button>
          <Button onClick={() => navigate('/login')}>
            Ir para Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
