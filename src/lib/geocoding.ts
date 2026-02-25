/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Rate limit: 1 req/s. Usar debounce na busca.
 * Política Nominatim: User-Agent obrigatório.
 */

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
    state?: string;
  };
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'QuieroFood/1.0 (https://quiero.food)';

function buildHeaders(): HeadersInit {
  return {
    'Accept': 'application/json',
    'Accept-Language': 'pt-BR,pt,en',
    'User-Agent': USER_AGENT,
  };
}

/**
 * Busca endereços por texto (geocoding).
 */
export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const q = query.trim();
  if (!q || q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '5',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: buildHeaders(),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    address?: Record<string, string>;
  }>;

  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name ?? '',
    address: item.address as GeocodingResult['address'],
  }));
}

/**
 * Converte coordenadas em endereço (reverse geocoding).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
    headers: buildHeaders(),
  });
  if (!res.ok) return null;

  const item = (await res.json()) as {
    lat: string;
    lon: string;
    display_name?: string;
    address?: Record<string, string>;
  };

  return {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name ?? '',
    address: item.address as GeocodingResult['address'],
  };
}

/**
 * Formata o endereço para exibição enxuta.
 */
export function formatAddressForDisplay(result: GeocodingResult): string {
  const a = result.address;
  if (!a) return result.displayName;

  const parts: string[] = [];
  if (a.road) {
    parts.push(a.house_number ? `${a.road}, ${a.house_number}` : a.road);
  }
  const locality = a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.municipality ?? a.city;
  if (locality) parts.push(locality);
  if (a.postcode) parts.push(a.postcode);
  if (parts.length === 0) return result.displayName;
  return parts.join(' — ');
}
