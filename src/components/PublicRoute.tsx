import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

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
        return <Navigate to="/admin" replace />;
      case UserRole.KITCHEN:
        return <Navigate to="/kitchen" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
