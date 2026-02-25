import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Loader2 } from 'lucide-react';
import MapAddressPicker from './MapAddressPicker';
import { searchAddress, reverseGeocode, formatAddressForDisplay, type GeocodingResult } from '@/lib/geocoding';

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

const DEBOUNCE_MS = 450;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [displayAddress, setDisplayAddress] = useState(addressText ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLat(initialLat);
    setLng(initialLng);
    setDisplayAddress(addressText ?? '');
    setSearchQuery('');
    setSuggestions([]);
  }, [open, initialLat, initialLng, addressText]);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const results = await searchAddress(trimmed);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      handleSearch(searchQuery);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, open, handleSearch]);

  const handleSelectSuggestion = useCallback((result: GeocodingResult) => {
    setLat(result.lat);
    setLng(result.lng);
    setDisplayAddress(formatAddressForDisplay(result));
    setSearchQuery('');
    setSuggestions([]);
  }, []);

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

        <div className="flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite seu endereço (rua, número, bairro ou CEP)"
              className="pl-9 h-12 rounded-xl bg-muted border-border"
            />
          </div>
          {displayAddress && !searchQuery && (
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
          )}
          {suggestions.length > 0 && (
            <ul className="border border-border rounded-xl bg-background shadow-lg overflow-hidden divide-y divide-border max-h-40 overflow-y-auto">
              {loadingSuggestions ? (
                <li className="px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </li>
              ) : (
                suggestions.map((s, i) => (
                  <li key={`${s.lat}-${s.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
                    >
                      {formatAddressForDisplay(s)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

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
