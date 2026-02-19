import { ReactNode } from 'react';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';

interface FeatureGuardProps {
  /** Código da feature (ex: 'feature_bcg_matrix') */
  feature: string;
  /** Conteúdo renderizado quando o restaurante TEM acesso à feature */
  children: ReactNode;
  /**
   * Conteúdo renderizado quando o restaurante NÃO tem acesso.
   * Se omitido, renderiza null (oculta completamente).
   */
  fallback?: ReactNode;
  /**
   * Conteúdo renderizado durante o carregamento da verificação.
   * Se omitido, renderiza null enquanto carrega.
   */
  loadingFallback?: ReactNode;
}

/**
 * Componente de proteção de feature por plano de assinatura.
 *
 * Usa o restaurantId do AdminRestaurantContext, portanto deve ser usado
 * dentro da árvore do AdminLayout.
 *
 * Exemplo de uso:
 * ```tsx
 * <FeatureGuard
 *   feature="feature_bcg_matrix"
 *   fallback={<UpgradeBanner feature="Matriz BCG" />}
 * >
 *   <MenuMatrixBCG />
 * </FeatureGuard>
 * ```
 */
export function FeatureGuard({
  feature,
  children,
  fallback = null,
  loadingFallback = null,
}: FeatureGuardProps) {
  const restaurantId = useAdminRestaurantId();
  const { data: hasAccess, isLoading } = useFeatureAccess(feature, restaurantId);

  if (isLoading) return <>{loadingFallback}</>;
  if (hasAccess) return <>{children}</>;
  return <>{fallback}</>;
}
