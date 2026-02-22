import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';

/** Corrige ícones do Leaflet que quebram com bundlers (webpack/vite) */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/** Corrige tiles não carregando quando o mapa é exibido em containers dinâmicos */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

/** Atualiza o centro do mapa quando as coordenadas mudam (ex: nova zona selecionada) */
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevCenter = useRef<[number, number]>([0, 0]);
  const isFirstMount = useRef(true);
  useEffect(() => {
    const lat = center[0];
    const lng = center[1];
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevCenter.current = [lat, lng];
      map.setView(center, zoom); // setView evita animação no mount — reduz piscada
    } else if (prevCenter.current[0] !== lat || prevCenter.current[1] !== lng) {
      prevCenter.current = [lat, lng];
      map.flyTo(center, zoom, { duration: 0.5 });
    }
  }, [map, center, zoom]);
  return null;
}

interface MapAddressPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
  /** Centro da zona de entrega — quando definido, o mapa exibe o círculo de limite */
  zoneCenterLat?: number;
  zoneCenterLng?: number;
  zoneRadiusMeters?: number;
}

function MapMoveHandler({
  onLocationChange,
  onMoveStart,
  onMoveEnd,
}: {
  onLocationChange: (lat: number, lng: number) => void;
  onMoveStart: () => void;
  onMoveEnd: () => void;
}) {
  useMapEvents({
    movestart: () => onMoveStart(),
    moveend(e) {
      const { lat, lng } = e.target.getCenter();
      onLocationChange(lat, lng);
      onMoveEnd();
    },
  });
  return null;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapAddressPicker({
  lat,
  lng,
  onLocationChange,
  height = '256px',
  zoneCenterLat,
  zoneCenterLng,
  zoneRadiusMeters,
}: MapAddressPickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useTranslation();
  const hasZoneBounds =
    Number.isFinite(zoneCenterLat) && Number.isFinite(zoneCenterLng) && (zoneRadiusMeters ?? 0) > 0;
  const mapCenter: [number, number] = hasZoneBounds && zoneCenterLat != null && zoneCenterLng != null
    ? [Number(zoneCenterLat), Number(zoneCenterLng)]
    : [lat, lng];
  const mapZoom = hasZoneBounds ? 15 : 17;

  const instruction = hasZoneBounds
    ? t('checkout.mapInstructionZone')
    : 'Arraste o mapa para posicionar o pino exatamente na sua localização';

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-slate-500 select-none">
        <span className="text-sm leading-none">✋</span>
        {instruction}
      </p>

      <div
        data-testid="map-address-picker"
        className="map-address-picker relative overflow-hidden rounded-xl border border-slate-200 isolate cursor-grab active:cursor-grabbing bg-slate-100"
        style={{ height }}
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          style={{ height: '100%', minHeight: height }}
          scrollWheelZoom={true}
        >
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          <MapInvalidateSize />
          <MapUpdater center={mapCenter} zoom={mapZoom} />
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
          <MapMoveHandler
            onLocationChange={onLocationChange}
            onMoveStart={() => setIsDragging(true)}
            onMoveEnd={() => setIsDragging(false)}
          />
        </MapContainer>

        {/* Pin anchored at map center */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1000,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -100%) translateY(${isDragging ? '-10px' : '0px'})`,
            transition: 'transform 150ms ease-out',
          }}
        >
          <svg
            width="32"
            height="44"
            viewBox="0 0 32 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 0C7.163 0 0 7.163 0 16C0 27.5 16 44 16 44C16 44 32 27.5 32 16C32 7.163 24.837 0 16 0Z"
              fill="#ea580c"
            />
            <circle cx="16" cy="16" r="7" fill="white" />
            <circle cx="16" cy="16" r="3.5" fill="#ea580c" />
          </svg>
        </div>

        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 999,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className={`rounded-full bg-black/25 blur-sm transition-all duration-150 ${
              isDragging ? 'w-6 h-2.5 opacity-50' : 'w-3 h-1.5 opacity-35'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
