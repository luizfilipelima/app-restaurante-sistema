/**
 * Resolve o subdomínio de forma síncrona (sin subdomínios da plataforma).
 * Não consulta domínios personalizados — para isso use getTenantFromHostname.
 */
export const getSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // Localhost handling
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null;
  }

  // Vercel / Production — subdomínios de quiero.food
  const parts = hostname.split('.');
  if (parts.length > 2) {
    const sub = parts[0];
    if (sub === 'www') return null;
    return sub;
  }

  return null;
};

const PLATFORM_DOMAIN = 'quiero.food';

/**
 * Resolve o tenant (slug do restaurante ou app/admin/kds) a partir do hostname.
 * Suporta subdomínios da plataforma (sync) e domínios personalizados (via RPC).
 * Retorna: slug do restaurante, 'app'|'admin'|'kds', ou null (domínio principal).
 */
export async function getTenantFromHostname(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // Domínio principal (path-based)
  if (hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}`) {
    return null;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Subdomínios de quiero.food
  if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const sub = hostname.split('.')[0];
    if (sub === 'www') return null;
    return sub;
  }

  // Subdomínios de localhost (dev)
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.split('.')[0];
    if (sub === 'www') return null;
    return sub;
  }

  // Possível domínio personalizado — consulta RPC
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.rpc('get_restaurant_slug_by_hostname', {
    p_hostname: hostname,
  });

  if (error) {
    console.warn('[getTenantFromHostname] RPC error:', error.message);
    return null;
  }

  return typeof data === 'string' && data.length > 0 ? data : null;
}
