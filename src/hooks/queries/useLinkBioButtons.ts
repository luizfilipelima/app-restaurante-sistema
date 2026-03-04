import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { invalidatePublicMenuCache } from '@/lib/cache/invalidatePublicCache';
import type { LinkBioButton } from '@/types';

const QUERY_KEY = 'link-bio-buttons';

async function fetchLinkBioButtons(restaurantId: string | null): Promise<LinkBioButton[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('link_bio_buttons')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LinkBioButton[];
}

/** Busca botões da página Link Bio por restaurant_id (admin e página pública). */
export function useLinkBioButtons(restaurantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, restaurantId],
    queryFn: () => fetchLinkBioButtons(restaurantId),
    enabled: !!restaurantId,
  });
}

/** Payload para criar botão (sem id e timestamps). */
export type CreateLinkBioButtonPayload = {
  restaurant_id: string;
  sort_order: number;
  label: string;
  url?: string | null;
  icon: string;
  button_type: LinkBioButton['button_type'];
};

/** Payload para atualizar botão (campos parciais). */
export type UpdateLinkBioButtonPayload = Partial<
  Omit<LinkBioButton, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>
>;

export function useLinkBioButtonsMutations(restaurantId: string | null, restaurantSlug?: string | null) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['bio-restaurant', restaurantSlug ?? undefined] });
    if (restaurantSlug) invalidatePublicMenuCache(queryClient, restaurantSlug);
  };

  const create = useMutation({
    mutationFn: async (payload: CreateLinkBioButtonPayload) => {
      const { data, error } = await supabase
        .from('link_bio_buttons')
        .insert({
          restaurant_id: payload.restaurant_id,
          sort_order: payload.sort_order,
          label: payload.label.trim(),
          url: payload.button_type === 'url' ? (payload.url?.trim() || null) : null,
          icon: payload.icon || '🔗',
          button_type: payload.button_type,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LinkBioButton;
    },
    onSuccess: () => invalidate(),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & UpdateLinkBioButtonPayload) => {
      const payload: Record<string, unknown> = { ...patch };
      if (payload.label !== undefined) payload.label = (payload.label as string).trim();
      if (payload.button_type !== 'url') payload.url = null;
      else if (payload.url !== undefined) payload.url = (payload.url as string)?.trim() || null;
      const { data, error } = await supabase
        .from('link_bio_buttons')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LinkBioButton;
    },
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('link_bio_buttons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  /** Reordena: passa a lista de ids na nova ordem e atualiza sort_order de cada um. */
  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('link_bio_buttons').update({ sort_order: index }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => invalidate(),
  });

  return { create, update, remove, reorder, invalidate };
}
