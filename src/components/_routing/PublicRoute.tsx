import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import AdminRedirect from '../admin/_layout/AdminRedirect';

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se já está autenticado, redireciona para a página apropriada
  if (user) {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return <Navigate to="/super-admin" replace />;
      case UserRole.RESTAURANT_ADMIN:
        // AdminRedirect resolve o slug e navega para /{slug}/painel
        return <AdminRedirect />;
      case UserRole.KITCHEN:
        // AdminRedirect vai para /{slug}/kds (usa restaurant_id do usuário)
        return <AdminRedirect />;
      case UserRole.WAITER:
        // Garçom vai direto para o Terminal do Garçom, sem ver o painel
        return <AdminRedirect />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
