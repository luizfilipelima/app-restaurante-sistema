/**
 * AdminRedirect
 *
 * Resolve o slug do restaurante do usuário logado e redireciona
 * para a URL canônica adequada ao seu cargo:
 *   • restaurant_admin → /{slug}/painel
 *   • kitchen          → /{slug}/kds
 *
 * Usado como destino pós-login (PublicRoute) e na rota legada /admin.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function AdminRedirect() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (tried) return;
    setTried(true);

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Super admin sem restaurante próprio → painel super admin
    if (!user.restaurant_id) {
      navigate('/super-admin', { replace: true });
      return;
    }

    supabase
      .from('restaurants')
      .select('slug')
      .eq('id', user.restaurant_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.slug) {
          const subpath = user.role === 'kitchen' ? 'kds' : 'painel';
          navigate(`/${data.slug}/${subpath}`, { replace: true });
        } else {
          // Fallback: slug não configurado
          navigate('/login', { replace: true });
        }
      });
  }, [user, navigate, tried]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-orange-100" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-[#F87116] animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-400 tracking-wide">Redirecionando...</p>
    </div>
  );
}
