import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@/lib/leaflet-heat-init';
import type { OrderCoordinate } from '@/hooks/queries/useOrderCoordinates';
import { MapPin } from 'lucide-react';

function HeatmapLayer({
  points,
  gradient,
}: {
  points: OrderCoordinate[];
  gradient?: Record<number, string>;
}) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (points.length === 0) return;
    const latlngs: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      p.intensity ?? 1,
    ]);
    const layer = (L as unknown as { heatLayer: (l: [number, number, number][], o?: object) => L.Layer }).heatLayer(latlngs, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: gradient ?? {
        0.2: '#00ff00',
        0.5: '#00ff88',
        1: '#00ffcc',
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, gradient]);

  return null;
}

interface DashboardHeatmapWidgetProps {
  points: OrderCoordinate[];
  center?: [number, number];
  zoom?: number;
}

function computeCenter(points: OrderCoordinate[]): [number, number] {
  if (points.length === 0) return [-23.55, -46.63];
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return [sum.lat / points.length, sum.lng / points.length];
}

/** Mapa de calor neon verde sobre fundo escuro */
const NEON_GRADIENT: Record<number, string> = {
  0.1: '#001a00',
  0.3: '#003300',
  0.5: '#00cc44',
  0.8: '#00ff66',
  1: '#00ff99',
};

export default function DashboardHeatmapWidget({
  points,
  center,
  zoom = 12,
}: DashboardHeatmapWidgetProps) {
  const mapCenter = center ?? computeCenter(points);
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-900 flex flex-col items-center justify-center min-h-[280px] text-slate-400">
        <MapPin className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Sem coordenadas de entregas no período</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      <div className="h-[280px] w-full">
        <MapContainer
          center={mapCenter}
          zoom={zoom}
          className="h-full w-full"
          style={{ background: '#0f172a' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <HeatmapLayer points={points} gradient={NEON_GRADIENT} />
        </MapContainer>
      </div>
    </div>
  );
}
