import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Se definido, só permite acesso para esses roles. */
  allowedRoles?: UserRole[];
  /**
   * Se definido, verifica se o restaurante do usuário tem acesso à feature.
   * Redireciona para /admin/upgrade caso não tenha.
   */
  requiredFeature?: string;
}

/**
 * Guarda de rota que verifica autenticação, role e (opcionalmente) feature flag.
 *
 * Ordem de verificação:
 *   1. Sessão inicializada?
 *   2. Usuário autenticado?
 *   3. Role permitido?
 *   4. Feature contratada? (se `requiredFeature` fornecido)
 */
export function ProtectedRoute({ children, allowedRoles, requiredFeature }: ProtectedRouteProps) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();

  // O restaurantId vem do perfil do usuário (restaurant_admin) ou é null (super_admin sem restaurante).
  const restaurantId = user?.restaurant_id ?? null;

  // A query de feature só roda quando `requiredFeature` está definido e o usuário está autenticado.
  const { data: hasFeature, isLoading: featureLoading } = useFeatureAccess(
    requiredFeature ?? '',
    requiredFeature && restaurantId ? restaurantId : null,
  );

  // ── 1. Aguarda inicialização da sessão ───────────────────────────────────
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // ── 2. Usuário não autenticado ───────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── 3. Role não permitido ────────────────────────────────────────────────
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ── 4. Verificação de feature (só para restaurant_admin — super_admin passa livre) ──
  if (requiredFeature && user.role !== UserRole.SUPER_ADMIN) {
    // Aguarda a query de feature terminar antes de redirecionar.
    if (featureLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      );
    }

    if (!hasFeature) {
      // Extrai o basePath da URL atual para redirecionar para /{slug}/painel/upgrade
      // Formatos possíveis: /{slug}/painel/... ou /admin/...
      const slugPainelMatch = location.pathname.match(/^\/([^/]+)\/painel/);
      const upgradePath = slugPainelMatch
        ? `/${slugPainelMatch[1]}/painel/upgrade`
        : '/admin/upgrade';
      return <Navigate to={upgradePath} state={{ from: location, feature: requiredFeature }} replace />;
    }
  }

  return <>{children}</>;
}
