import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Circle, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/** Corrige ícones do Leaflet */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const RESTAURANT_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 44 52" fill="none">
  <path d="M22 0C9.85 0 0 9.85 0 22C0 38.5 22 52 22 52C22 52 44 38.5 44 22C44 9.85 34.15 0 22 0Z" fill="#dc2626" stroke="#b91c1c" stroke-width="2"/>
  <path d="M12 30V18h20v12" fill="white" stroke="#dc2626" stroke-width="1.5"/>
  <path d="M12 18l4-6h12l4 6" fill="white" stroke="#dc2626" stroke-width="1.5"/>
  <rect x="18" y="22" width="8" height="8" fill="#dc2626"/>
</svg>
`;

function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

interface MapAddressPreviewProps {
  lat: number;
  lng: number;
  zoneCenterLat?: number;
  zoneCenterLng?: number;
  zoneRadiusMeters?: number;
  restaurantLat?: number;
  restaurantLng?: number;
  height?: string;
}

export default function MapAddressPreview({
  lat,
  lng,
  zoneCenterLat,
  zoneCenterLng,
  zoneRadiusMeters,
  restaurantLat,
  restaurantLng,
  height = '120px',
}: MapAddressPreviewProps) {
  const hasZoneBounds =
    Number.isFinite(zoneCenterLat) && Number.isFinite(zoneCenterLng) && (zoneRadiusMeters ?? 0) > 0;
  const hasRestaurantMarker = Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng);
  const mapCenter: [number, number] =
    hasZoneBounds && zoneCenterLat != null && zoneCenterLng != null
      ? [Number(zoneCenterLat), Number(zoneCenterLng)]
      : [lat, lng];
  const mapZoom = hasZoneBounds ? 14 : 16;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-muted select-none pointer-events-none touch-none"
      style={{ height }}
    >
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        style={{ height: '100%', minHeight: height }}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <MapInvalidateSize />
        <MapViewUpdater center={mapCenter} zoom={mapZoom} />
        {hasZoneBounds && (
          <Circle
            center={[zoneCenterLat!, zoneCenterLng!]}
            radius={zoneRadiusMeters!}
            pathOptions={{
              color: 'rgb(234, 88, 12)',
              fillColor: 'rgb(234, 88, 12)',
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
        {hasRestaurantMarker && restaurantLat != null && restaurantLng != null && (
          <Marker
            position={[restaurantLat, restaurantLng]}
            icon={L.divIcon({
              html: RESTAURANT_MARKER_SVG,
              className: '!bg-transparent !border-0',
              iconSize: [36, 42],
              iconAnchor: [18, 42],
            })}
            zIndexOffset={500}
          />
        )}
      </MapContainer>
      {/* Pin do endereço do cliente */}
      <div
        className="absolute pointer-events-none"
        style={{
          zIndex: 1000,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -100%)',
        }}
      >
        <svg width="24" height="34" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M16 0C7.163 0 0 7.163 0 16C0 27.5 16 44 16 44C16 44 32 27.5 32 16C32 7.163 24.837 0 16 0Z"
            fill="#ea580c"
          />
          <circle cx="16" cy="16" r="7" fill="white" />
          <circle cx="16" cy="16" r="3.5" fill="#ea580c" />
        </svg>
      </div>
    </div>
  );
}
