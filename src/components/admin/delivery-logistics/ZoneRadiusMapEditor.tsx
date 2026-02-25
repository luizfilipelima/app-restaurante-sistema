import { useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface ZoneRadiusMapEditorProps {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
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

export default function ZoneRadiusMapEditor({
  centerLat,
  centerLng,
  radiusMeters,
  onCenterChange,
  height = '280px',
}: ZoneRadiusMapEditorProps) {
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
        Clique no mapa para definir o centro da zona de entrega
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
          {radiusMeters > 0 && (
            <Circle
              center={center}
              radius={radiusMeters}
              pathOptions={{
                color: 'rgb(234, 88, 12)',
                fillColor: 'rgb(234, 88, 12)',
                fillOpacity: 0.2,
                weight: 2,
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
