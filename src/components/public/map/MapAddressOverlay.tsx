import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import MapAddressPicker from './MapAddressPicker';
import { reverseGeocode, formatAddressForDisplay } from '@/lib/geo/geocoding';

interface MapAddressOverlayProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, addressText?: string) => void;
  initialLat: number;
  initialLng: number;
  addressText?: string;
  zoneCenterLat?: number;
  zoneCenterLng?: number;
  zoneRadiusMeters?: number;
  restaurantLat?: number;
  restaurantLng?: number;
}

export default function MapAddressOverlay({
  open,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
  addressText,
  zoneCenterLat,
  zoneCenterLng,
  zoneRadiusMeters,
  restaurantLat,
  restaurantLng,
}: MapAddressOverlayProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [displayAddress, setDisplayAddress] = useState(addressText ?? '');

  useEffect(() => {
    setLat(initialLat);
    setLng(initialLng);
    setDisplayAddress(addressText ?? '');
  }, [open, initialLat, initialLng, addressText]);

  const handleMapLocationChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setReverseLoading(true);
    reverseGeocode(newLat, newLng)
      .then((result) => {
        if (result) setDisplayAddress(formatAddressForDisplay(result));
      })
      .finally(() => setReverseLoading(false));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(lat, lng, displayAddress || undefined);
    onClose();
  }, [lat, lng, displayAddress, onConfirm, onClose]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[90vh] max-h-[90vh] flex flex-col rounded-t-2xl px-4 pb-8 pt-4 gap-4"
        showCloseButton={true}
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Definir localização
          </SheetTitle>
        </SheetHeader>

        {displayAddress && (
          <div className="flex-shrink-0">
            <p className="text-sm text-muted-foreground truncate px-1">
              {reverseLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando endereço...
                </span>
              ) : (
                displayAddress
              )}
            </p>
          </div>
        )}

        <div className="flex-1 min-h-[240px] rounded-xl overflow-hidden border border-border">
          <MapAddressPicker
            lat={lat}
            lng={lng}
            onLocationChange={handleMapLocationChange}
            height="min(350px, 45vh)"
            zoneCenterLat={zoneCenterLat}
            zoneCenterLng={zoneCenterLng}
            zoneRadiusMeters={zoneRadiusMeters}
            restaurantLat={restaurantLat}
            restaurantLng={restaurantLng}
          />
        </div>

        <Button
          onClick={handleConfirm}
          className="w-full h-12 rounded-xl font-semibold bg-primary hover:bg-primary/90"
        >
          Confirmar localização
        </Button>
      </SheetContent>
    </Sheet>
  );
}
