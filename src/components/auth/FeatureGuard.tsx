import { ReactNode } from 'react';
import { useAdminRestaurantId } from '@/contexts/AdminRestaurantContext';
import { useFeatureAccess } from '@/hooks/queries/useFeatureAccess';
import { UpgradeBanner } from './UpgradeBanner';

// Metadados de marketing das features para o fallback padrão
const FEATURE_META: Record<string, {
  label: string;
  planRequired: string;
  description: string;
}> = {
  feature_buffet_module:       { label: 'Módulo Buffet',              planRequired: 'Enterprise', description: 'Gerencie comandas, escaneie produtos e opere 100% offline.' },
  feature_virtual_comanda:     { label: 'Comandas Digitais (Mobile)', planRequired: 'Enterprise', description: 'Clientes abrem uma comanda via QR Code no celular. O caixa lê o código e fecha a conta em segundos.' },
  feature_tables:              { label: 'Mesas & QR Codes',            planRequired: 'Standard',   description: 'Crie mesas virtuais, gere QR Codes e receba chamadas de garçom.' },
  feature_couriers:            { label: 'Gestão de Entregadores',      planRequired: 'Standard',   description: 'Cadastre entregadores, controle o status e vincule aos pedidos.' },
  feature_delivery_zones:      { label: 'Zonas de Entrega',            planRequired: 'Standard',   description: 'Configure bairros com taxas personalizadas exibidas no checkout.' },
  feature_bcg_matrix:          { label: 'Matriz BCG de Produtos',      planRequired: 'Enterprise', description: 'Classifique seu cardápio em Estrelas, Vacas, Interrogações e Abacaxis.' },
  feature_churn_recovery:      { label: 'Recuperação de Churn',        planRequired: 'Enterprise', description: 'Identifique clientes em risco e contacte-os via WhatsApp.' },
  feature_retention_analytics: { label: 'Análise de Retenção',         planRequired: 'Enterprise', description: 'Veja a taxa de clientes recorrentes e tendência de fidelização.' },
  feature_inventory_cost:      { label: 'Inventário com CMV',          planRequired: 'Enterprise', description: 'Controle custo de insumos, CMV e margem de lucro por produto.' },
};

interface FeatureGuardProps {
  /** Código da feature (ex: 'feature_bcg_matrix') */
  feature: string;
  /** Conteúdo renderizado quando o restaurante TEM acesso à feature */
  children: ReactNode;
  /**
   * Conteúdo renderizado quando o restaurante NÃO tem acesso.
   * Se omitido, exibe um <UpgradeBanner> automático com as informações da feature.
   * Para ocultar completamente, passe `fallback={null}` explicitamente.
   */
  fallback?: ReactNode;
  /**
   * Conteúdo renderizado durante o carregamento da verificação.
   * Se omitido, renderiza null enquanto carrega.
   */
  loadingFallback?: ReactNode;
  /**
   * Variant do banner de upgrade padrão ('full' | 'inline').
   * Ignorado se `fallback` for passado explicitamente.
   * @default 'full'
   */
  bannerVariant?: 'full' | 'inline';
}

/**
 * Componente de proteção de feature por plano de assinatura.
 *
 * Quando o restaurante não tem a feature contratada, exibe automaticamente um
 * <UpgradeBanner> com o contexto correto (nome da feature, plano necessário e
 * link direto para a página de planos). Esse comportamento pode ser substituído
 * passando um `fallback` customizado ou `fallback={null}` para ocultar tudo.
 *
 * Deve ser usado dentro da árvore do AdminLayout (AdminRestaurantContext).
 *
 * Exemplo — com fallback automático:
 * ```tsx
 * <FeatureGuard feature="feature_bcg_matrix">
 *   <MenuMatrixBCG />
 * </FeatureGuard>
 * ```
 *
 * Exemplo — com banner inline em vez do full:
 * ```tsx
 * <FeatureGuard feature="feature_couriers" bannerVariant="inline">
 *   <CouriersList />
 * </FeatureGuard>
 * ```
 */
export function FeatureGuard({
  feature,
  children,
  fallback,
  loadingFallback = null,
  bannerVariant = 'full',
}: FeatureGuardProps) {
  const restaurantId = useAdminRestaurantId();
  const { data: hasAccess, isLoading } = useFeatureAccess(feature, restaurantId);

  if (isLoading) return <>{loadingFallback}</>;
  if (hasAccess) return <>{children}</>;

  // Fallback explícito (incluindo null para ocultar completamente)
  if (fallback !== undefined) return <>{fallback}</>;

  // Fallback padrão: UpgradeBanner com contexto automático
  const meta = FEATURE_META[feature];
  return (
    <UpgradeBanner
      featureFlag={feature}
      featureLabel={meta?.label}
      planRequired={meta?.planRequired}
      description={meta?.description}
      variant={bannerVariant}
    />
  );
}
