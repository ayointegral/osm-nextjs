import * as L from 'leaflet';

declare global {
  interface Window {
    L: typeof L;
    map?: L.Map;  // Using optional type for better type compatibility
  }
}

export {};
