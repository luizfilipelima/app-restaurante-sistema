import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import type { PizzaSize, PizzaFlavor, PizzaDough, PizzaEdge, PizzaExtra } from '@/types';

const pizzaConfigKey = (rid: string | null) => ['pizza-config', rid] as const;

async function fetchPizzaConfig(restaurantId: string | null) {
  if (!restaurantId) return { sizes: [], flavors: [], doughs: [], edges: [], extras: [] };
  const [sizesRes, flavorsRes, doughsRes, edgesRes, extrasRes] = await Promise.all([
    supabase.from('pizza_sizes').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true }),
    supabase.from('pizza_flavors').select('*').eq('restaurant_id', restaurantId).order('name'),
    supabase.from('pizza_doughs').select('*').eq('restaurant_id', restaurantId).order('name'),
    supabase.from('pizza_edges').select('*').eq('restaurant_id', restaurantId).order('name'),
    supabase.from('pizza_extras').select('*').eq('restaurant_id', restaurantId).order('order_index').order('name'),
  ]);
  return {
    sizes: (sizesRes.data ?? []) as PizzaSize[],
    flavors: (flavorsRes.data ?? []) as PizzaFlavor[],
    doughs: (doughsRes.data ?? []) as PizzaDough[],
    edges: (edgesRes.data ?? []) as PizzaEdge[],
    extras: (extrasRes.data ?? []) as PizzaExtra[],
  };
}

export function usePizzaConfig(restaurantId: string | null) {
  const query = useQuery({
    queryKey: pizzaConfigKey(restaurantId),
    queryFn: () => fetchPizzaConfig(restaurantId),
    enabled: !!restaurantId,
  });
  return {
    sizes: query.data?.sizes ?? [],
    flavors: query.data?.flavors ?? [],
    doughs: query.data?.doughs ?? [],
    edges: query.data?.edges ?? [],
    extras: query.data?.extras ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePizzaConfigMutations(restaurantId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: pizzaConfigKey(restaurantId) });
    invalidatePublicMenuCache(qc);
  };

  const createSize = useMutation({
    mutationFn: async (data: { name: string; max_flavors: number; price_multiplier: number }) => {
      if (!restaurantId) throw new Error('restaurant_id required');
      const { data: existing } = await supabase.from('pizza_sizes').select('order_index').eq('restaurant_id', restaurantId).order('order_index', { ascending: false }).limit(1).single();
      const order = (existing?.order_index ?? 0) + 1;
      const { error } = await supabase.from('pizza_sizes').insert({
        restaurant_id: restaurantId,
        name: data.name,
        max_flavors: data.max_flavors,
        price_multiplier: data.price_multiplier,
        order_index: order,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createFlavor = useMutation({
    mutationFn: async (data: { name: string; price?: number }) => {
      if (!restaurantId) throw new Error('restaurant_id required');
      const { error } = await supabase.from('pizza_flavors').insert({
        restaurant_id: restaurantId,
        name: data.name,
        price: data.price ?? 0,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createDough = useMutation({
    mutationFn: async (data: { name: string; extra_price?: number }) => {
      if (!restaurantId) throw new Error('restaurant_id required');
      const { error } = await supabase.from('pizza_doughs').insert({
        restaurant_id: restaurantId,
        name: data.name,
        extra_price: data.extra_price ?? 0,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createEdge = useMutation({
    mutationFn: async (data: {
      name: string;
      price?: number;
      cost?: number;
      cost_currency?: string;
      in_stock?: boolean;
      ingredient_id?: string | null;
    }) => {
      if (!restaurantId) throw new Error('restaurant_id required');
      const { error } = await supabase.from('pizza_edges').insert({
        restaurant_id: restaurantId,
        name: data.name,
        price: data.price ?? 0,
        cost: data.cost ?? 0,
        cost_currency: data.cost_currency ?? 'BRL',
        in_stock: data.in_stock ?? false,
        ingredient_id: data.ingredient_id ?? null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createExtra = useMutation({
    mutationFn: async (data: {
      name: string;
      price?: number;
      cost?: number;
      cost_currency?: string;
      in_stock?: boolean;
      ingredient_id?: string | null;
    }) => {
      if (!restaurantId) throw new Error('restaurant_id required');
      const { data: existing } = await supabase.from('pizza_extras').select('order_index').eq('restaurant_id', restaurantId).order('order_index', { ascending: false }).limit(1).single();
      const order = (existing?.order_index ?? 0) + 1;
      const { error } = await supabase.from('pizza_extras').insert({
        restaurant_id: restaurantId,
        name: data.name,
        price: data.price ?? 0,
        cost: data.cost ?? 0,
        cost_currency: data.cost_currency ?? 'BRL',
        in_stock: data.in_stock ?? false,
        ingredient_id: data.ingredient_id ?? null,
        order_index: order,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pizza_sizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteFlavor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pizza_flavors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteDough = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pizza_doughs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteEdge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pizza_edges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteExtra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pizza_extras').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateFlavor = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; price?: number; is_active?: boolean } }) => {
      const { error } = await supabase.from('pizza_flavors').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateDough = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; extra_price?: number; is_active?: boolean } }) => {
      const { error } = await supabase.from('pizza_doughs').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateEdge = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        price?: number;
        cost?: number;
        cost_currency?: string;
        in_stock?: boolean;
        ingredient_id?: string | null;
        is_active?: boolean;
      };
    }) => {
      const { error } = await supabase.from('pizza_edges').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateExtra = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        price?: number;
        cost?: number;
        cost_currency?: string;
        in_stock?: boolean;
        ingredient_id?: string | null;
        is_active?: boolean;
      };
    }) => {
      const { error } = await supabase.from('pizza_extras').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    createSize,
    createFlavor,
    createDough,
    createEdge,
    createExtra,
    deleteSize,
    deleteFlavor,
    deleteDough,
    deleteEdge,
    deleteExtra,
    updateFlavor,
    updateDough,
    updateEdge,
    updateExtra,
  };
}
