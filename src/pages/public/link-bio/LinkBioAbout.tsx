import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/core/supabase';
import { ArrowLeft } from 'lucide-react';
import { RestaurantAboutContent } from '@/components/public/_shared/RestaurantAboutContent';
import type { Restaurant } from '@/types';

interface LinkBioAboutProps {
  tenantSlug?: string;
}

const FIELDS = 'id, name, slug, logo, phone, whatsapp, phone_country, opening_hours, always_open, description, instagram_url, language';

async function fetchRestaurantForAbout(slug: string | null): Promise<Restaurant | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('restaurants')
    .select(FIELDS)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data as Restaurant;
}

export default function LinkBioAbout({ tenantSlug: tenantSlugProp }: LinkBioAboutProps = {}) {
  const params = useParams<{ restaurantSlug?: string }>();
  const slug = tenantSlugProp ?? params.restaurantSlug ?? null;

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['bio-about-restaurant', slug],
    queryFn: () => fetchRestaurantForAbout(slug ?? null),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const lang = (restaurant?.language === 'es' ? 'es' : 'pt') as 'pt' | 'es';
  /** No subdomínio (StoreLayout) não há slug no path; em path-based (/:slug/bio) sim */
  const basePath = tenantSlugProp ? '' : (slug ? `/${slug}` : '');

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-2xl bg-primary/20 animate-pulse" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-foreground">Restaurante não encontrado</p>
        <Link to={basePath ? `${basePath}/bio` : '/bio'} className="text-sm text-primary hover:underline" replace>
          Voltar à página de links
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-md mx-auto flex flex-col bg-background">
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border">
        <Link
          to={basePath ? `${basePath}/bio` : '/bio'}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'pt' ? 'Voltar' : 'Volver'}
        </Link>
      </div>
      <div className="flex-1 overflow-auto">
        <RestaurantAboutContent restaurant={restaurant} lang={lang} basePath={basePath} />
      </div>
    </div>
  );
}
