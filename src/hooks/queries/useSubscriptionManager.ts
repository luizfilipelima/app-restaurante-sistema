/**
 * Hooks para gerenciamento de assinaturas e feature flags no painel Super Admin.
 *
 * Tabelas envolvidas:
 *   subscription_plans          → lista de planos disponíveis
 *   features                    → catálogo de todas as feature flags
 *   plan_features               → quais features estão em cada plano
 *   restaurant_subscriptions    → assinatura atual de cada restaurante
 *   restaurant_feature_overrides → overrides manuais por restaurante
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Feature } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Feature };

export interface SubscriptionPlan {
  id: string;
  name: string;   // 'core' | 'standard' | 'enterprise'
  label: string;
  description: string | null;
  price_brl: number;
  sort_order: number;
}

export interface PlanFeature {
  plan_id: string;
  feature_id: string;
}

export interface RestaurantSubscription {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  notes: string | null;
}

export interface FeatureOverride {
  id: string;
  restaurant_id: string;
  feature_id: string;
  is_enabled: boolean;
  reason: string | null;
  expires_at: string | null;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const subscriptionKeys = {
  plans:           () => ['subscription-plans']                              as const,
  features:        () => ['features-catalog']                                as const,
  planFeatures:    (planId: string) => ['plan-features', planId]             as const,
  subscription:    (restaurantId: string) => ['subscription', restaurantId]  as const,
  overrides:       (restaurantId: string) => ['feature-overrides', restaurantId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Lista todos os planos disponíveis (ordenados por sort_order). */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: subscriptionKeys.plans(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, label, description, price_brl, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30, // 30 min — planos mudam pouco
  });
}

/** Lista todas as features do catálogo, agrupáveis por module. */
export function useFeaturesCatalog() {
  return useQuery<Feature[]>({
    queryKey: subscriptionKeys.features(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('features')
        .select('id, flag, label, description, module, min_plan, category')
        .eq('is_active', true)
        .order('category')
        .order('label');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });
}

/** Retorna os feature_ids incluídos em um plano específico. */
export function usePlanFeatures(planId: string | null | undefined) {
  return useQuery<PlanFeature[]>({
    queryKey: subscriptionKeys.planFeatures(planId ?? ''),
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from('plan_features')
        .select('plan_id, feature_id')
        .eq('plan_id', planId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!planId,
    staleTime: 1000 * 60 * 30,
  });
}

/** Retorna a assinatura atual de um restaurante (ou null se não cadastrada). */
export function useRestaurantSubscription(restaurantId: string | null | undefined) {
  return useQuery<RestaurantSubscription | null>({
    queryKey: subscriptionKeys.subscription(restaurantId ?? ''),
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurant_subscriptions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!restaurantId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

/** Retorna todos os overrides de features para um restaurante. */
export function useFeatureOverrides(restaurantId: string | null | undefined) {
  return useQuery<FeatureOverride[]>({
    queryKey: subscriptionKeys.overrides(restaurantId ?? ''),
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('restaurant_feature_overrides')
        .select('*')
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!restaurantId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Atualiza (upsert) o plano de um restaurante em restaurant_subscriptions. */
export function useUpdateSubscription(restaurantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const payload = {
        restaurant_id: restaurantId,
        plan_id: planId,
        status: 'active' as const,
        current_period_start: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('restaurant_subscriptions')
        .upsert(payload, { onConflict: 'restaurant_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalida a subscription E o cache de feature-access (plano mudou)
      qc.invalidateQueries({ queryKey: subscriptionKeys.subscription(restaurantId) });
      qc.invalidateQueries({ queryKey: ['feature-access', restaurantId] });
    },
  });
}

/** Adiciona ou remove uma feature de um plano (plan_features). */
export function useTogglePlanFeature(planId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      featureId,
      included,
    }: {
      featureId: string;
      included: boolean;
    }) => {
      if (included) {
        const { error } = await supabase.from('plan_features').upsert(
          { plan_id: planId, feature_id: featureId },
          { onConflict: 'plan_id,feature_id' },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plan_features')
          .delete()
          .eq('plan_id', planId)
          .eq('feature_id', featureId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subscriptionKeys.planFeatures(planId) });
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'feature-access',
      });
    },
  });
}

/** Habilita ou desabilita um override de feature para um restaurante.
 *  - isEnabled = true  → upsert com is_enabled = true
 *  - isEnabled = false → remove o override (restaura comportamento do plano)
 */
export function useToggleFeatureOverride(restaurantId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureId, isEnabled }: { featureId: string; isEnabled: boolean }) => {
      if (isEnabled) {
        // Upsert: habilitar override
        const { error } = await supabase
          .from('restaurant_feature_overrides')
          .upsert(
            { restaurant_id: restaurantId, feature_id: featureId, is_enabled: true },
            { onConflict: 'restaurant_id,feature_id' },
          );
        if (error) throw error;
      } else {
        // Remover o override (restaura o estado padrão do plano)
        const { error } = await supabase
          .from('restaurant_feature_overrides')
          .delete()
          .eq('restaurant_id', restaurantId)
          .eq('feature_id', featureId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { featureId }) => {
      qc.invalidateQueries({ queryKey: subscriptionKeys.overrides(restaurantId) });
      // Invalida o cache de verificação da feature específica
      qc.invalidateQueries({ queryKey: ['feature-access', restaurantId] });
      // Invalida por flag também (caso o restaurantId esteja em outro formato de cache)
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'feature-access' &&
          q.queryKey[1] === restaurantId &&
          typeof q.queryKey[2] === 'string',
      });
      // A UI precisa do featureId para update otimista — passamos adiante
      return featureId;
    },
  });
}
