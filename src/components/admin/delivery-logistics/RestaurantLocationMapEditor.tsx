import { useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface RestaurantLocationMapEditorProps {
  centerLat: number;
  centerLng: number;
  onCenterChange: (lat: number, lng: number) => void;
  height?: string;
}

function MapClickHandler({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function RestaurantLocationMapEditor({
  centerLat,
  centerLng,
  onCenterChange,
  height = '280px',
}: RestaurantLocationMapEditorProps) {
  const center: [number, number] = useMemo(
    () => [centerLat, centerLng],
    [centerLat, centerLng]
  );

  const handleCenterChange = useCallback(
    (lat: number, lng: number) => {
      onCenterChange(lat, lng);
    },
    [onCenterChange]
  );

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
        <span className="text-sm leading-none">📍</span>
        Clique no mapa para definir a localização do restaurante (origem para cálculo do frete)
      </p>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200 isolate"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={14}
          className="h-full w-full cursor-crosshair"
          style={{ height } as React.CSSProperties}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeView center={center} />
          <MapClickHandler onCenterChange={handleCenterChange} />
        </MapContainer>
        {/* Pin marcando a localização do restaurante no centro do mapa */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1000,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -100%)',
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
      </div>
    </div>
  );
}
