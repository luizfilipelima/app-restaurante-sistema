import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix para ícone padrão do Leaflet em React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapAddressPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

function LocationMarker({ lat, lng, onLocationChange }: { lat: number; lng: number; onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <Marker
      position={[lat, lng]}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const pos = e.target.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        },
      }}
    />
  );
}

function MapCenterController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function MapAddressPicker({ lat, lng, onLocationChange, height = '200px' }: MapAddressPickerProps) {
  return (
    <div
      className="relative z-0 overflow-hidden rounded-xl border border-slate-200 isolate"
      style={{ height }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        className="h-full w-full map-address-picker"
        style={{ height } as React.CSSProperties}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={lat} lng={lng} onLocationChange={onLocationChange} />
        <MapCenterController lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
