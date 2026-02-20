/**
 * Inicializa Leaflet e leaflet.heat. O plugin leaflet.heat requer L no global.
 */
import L from 'leaflet';
if (typeof window !== 'undefined') {
  (window as unknown as { L: typeof L }).L = L;
}
import 'leaflet.heat';
