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
      </div>
    </div>
  );
}
