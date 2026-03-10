/**
 * Vercel Edge Middleware — Open Graph / Twitter Cards para links compartilhados
 *
 * Quando um crawler (WhatsApp, Facebook, Twitter, etc.) acessa um link de restaurante,
 * retorna HTML com meta tags OG para exibir foto e nome no preview do link.
 */

const CRAWLER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'Googlebot',
  'Bingbot',
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}

async function extractSlug(
  url: URL,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<string | null> {
  const hostname = url.hostname;
  const pathname = url.pathname;

  // Rotas de brand (landing/login) — middleware retornará OG com logo QuieroFood
  const brandPaths = ['/login', '/register', '/'];
  const isBrandPath = brandPaths.some((p) => pathname === p || (p === '/' && pathname === ''));
  if (isBrandPath) return 'BRAND';

  const skipPaths = ['/unauthorized', '/super-admin', '/api', '/assets', '/_next', '/favicon'];
  if (skipPaths.some((p) => pathname.startsWith(p))) return null;

  // Subdomínio de loja: pizzaria.quiero.food → slug = pizzaria
  if (hostname.endsWith('.quiero.food') || hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    const sub = parts[0];
    if (sub && sub !== 'www' && sub !== 'app' && sub !== 'admin' && sub !== 'kds') {
      return sub;
    }
  }

  // Path: app.quiero.food/pizzaria-da-vitoria ou /pizzaria-da-vitoria/menu
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first && first.length > 1 && !['super-admin'].includes(first)) {
    return first;
  }

  // Domínio personalizado: chamar RPC
  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_restaurant_slug_by_hostname`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_hostname: hostname }),
    });
    if (rpcRes.ok) {
      const slug = await rpcRes.json();
      return typeof slug === 'string' ? slug : null;
    }
  } catch {
    // ignore
  }
  return null;
}

function buildOgHtml(
  title: string,
  description: string,
  imageUrl: string,
  url: string,
  siteName: string
): string {
  const escaped = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const safeImage = escaped(imageUrl);
  const secureImageTag =
    imageUrl.startsWith('https://')
      ? `\n  <meta property="og:image:secure_url" content="${safeImage}" />`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escaped(title)}" />
  <meta property="og:description" content="${escaped(description)}" />
  <meta property="og:image" content="${safeImage}" />${secureImageTag}
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escaped(url)}" />
  <meta property="og:site_name" content="${escaped(siteName)}" />
  <meta property="og:locale" content="pt_BR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escaped(title)}" />
  <meta name="twitter:description" content="${escaped(description)}" />
  <meta name="twitter:image" content="${safeImage}" />
  <title>${escaped(title)}</title>
</head>
<body><p><a href="${escaped(url)}">${escaped(title)}</a></p></body>
</html>`;
}

function buildDynamicManifest(
  name: string,
  logoUrl: string | null,
  baseUrl: string
): string {
  const safeName = name.replace(/"/g, '\\"');
  const iconUrl = logoUrl && (logoUrl.startsWith('http') || logoUrl.startsWith('//'))
    ? logoUrl
    : `${baseUrl}/favicon-quierofood-logo-orange.svg`;
  return JSON.stringify({
    name: safeName,
    short_name: safeName,
    description: `Cardápio de ${safeName} — peça online com facilidade`,
    start_url: '/',
    display: 'standalone',
    background_color: '#F87116',
    theme_color: '#F87116',
    icons: [
      {
        src: iconUrl,
        sizes: 'any',
        type: iconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'any',
      },
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  });
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Manifest dinâmico para subdomínios de restaurante (nome + logo)
  if (pathname === '/manifest.json' && supabaseUrl && supabaseAnonKey) {
    const slug = await extractSlug(url, supabaseUrl, supabaseAnonKey);
    if (slug && slug !== 'BRAND') {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/restaurants?slug=eq.${encodeURIComponent(slug)}&select=name,logo&is_active=eq.true&deleted_at=is.null`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (res.ok) {
          const data = (await res.json()) as { name?: string; logo?: string }[];
          const restaurant = data?.[0];
          if (restaurant?.name) {
            const logo = (restaurant.logo || '').trim();
            const logoAbsolute =
              logo.startsWith('http://') || logo.startsWith('https://') ? logo : null;
            const manifest = buildDynamicManifest(restaurant.name, logoAbsolute, url.origin);
            return new Response(manifest, {
              status: 200,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
              },
            });
          }
        }
      } catch {
        // fall through to static manifest
      }
    }
  }

  const userAgent = request.headers.get('user-agent');
  if (!isCrawler(userAgent)) {
    return fetch(request);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return fetch(request);
  }

  const slug = await extractSlug(url, supabaseUrl, supabaseAnonKey);

  // Rotas de brand: landing (/) e login (/login) — retorna OG com logo QuieroFood
  if (slug === 'BRAND') {
    const siteName = 'QuieroFood';
    const isLogin = url.pathname === '/login' || url.pathname.startsWith('/login/');
    const title = isLogin ? 'Login | QuieroFood' : 'QuieroFood — Sistema de Gestão para Restaurantes';
    const description = isLogin
      ? 'Acesse sua conta e gerencie seu restaurante com o QuieroFood.'
      : 'Cardápio digital, pedidos online, delivery e gestão completa. Aumente suas vendas com o QuieroFood.';
    const imageUrl = `${url.origin}/og-image.png`;
    const html = buildOgHtml(title, description, imageUrl, url.href, siteName);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  if (!slug) {
    return fetch(request);
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/restaurants?slug=eq.${encodeURIComponent(slug)}&select=name,logo&is_active=eq.true&deleted_at=is.null`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) return fetch(request);

    const data = (await res.json()) as { name?: string; logo?: string }[];
    const restaurant = data?.[0];

    const siteName = 'QuieroFood';
    const title = restaurant?.name ? `${restaurant.name} — Cardápio` : siteName;
    const description = restaurant?.name
      ? `Confira o cardápio de ${restaurant.name}. Peça online com facilidade.`
      : 'Sistema de cardápio e pedidos online.';

    // Logo do restaurante (Supabase Storage retorna URL completa https://...)
    let imageUrl = (restaurant?.logo || '').trim();
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // Fallback para logos salvas como path relativo (legado)
      imageUrl = imageUrl.startsWith('/') ? `${url.origin}${imageUrl}` : `${url.origin}/${imageUrl}`;
    }
    if (!imageUrl) {
      imageUrl = `${url.origin}/og-image.png`;
    }

    const html = buildOgHtml(title, description, imageUrl, url.href, siteName);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return fetch(request);
  }
}

export const config = {
  matcher: [
    '/((?!assets/|favicon|api/).*)',
  ],
};
