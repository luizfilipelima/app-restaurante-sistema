/**
 * Utilitários de geolocalização: distância Haversine e cálculo de frete por quilometragem.
 */

/** Faixa de distância com taxa de entrega */
export interface DeliveryDistanceTier {
  km_min: number;
  km_max: number | null;
  fee: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Calcula a distância em km entre dois pontos (fórmula de Haversine).
 */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Retorna a taxa de entrega com base na distância e nas faixas configuradas.
 * Faixas devem estar ordenadas por km_min ASC.
 * km_max = null indica "acima de km_min".
 *
 * @returns fee em centavos/moeda base, ou null se fora da área de entrega
 */
export function getDeliveryFeeByDistance(
  restaurantLat: number,
  restaurantLng: number,
  clientLat: number,
  clientLng: number,
  tiers: DeliveryDistanceTier[]
): { fee: number; distanceKm: number } | null {
  if (tiers.length === 0) return null;
  if (
    !Number.isFinite(restaurantLat) ||
    !Number.isFinite(restaurantLng) ||
    !Number.isFinite(clientLat) ||
    !Number.isFinite(clientLng)
  ) {
    return null;
  }

  const distanceKm = haversine(restaurantLat, restaurantLng, clientLat, clientLng);

  const sorted = [...tiers].sort((a, b) => a.km_min - b.km_min);

  for (const tier of sorted) {
    if (distanceKm < tier.km_min) continue;
    if (tier.km_max == null) {
      return { fee: tier.fee, distanceKm };
    }
    if (distanceKm < tier.km_max) {
      return { fee: tier.fee, distanceKm };
    }
  }

  return null;
}
