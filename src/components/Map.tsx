import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileProviders } from '@/utils/tile-utils';

interface MapProps {
  provider?: string;
}

export default function Map({ provider = 'osm_local' }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapContainerId = 'map';

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize the map
      const map = L.map(mapContainerId).setView([51.505, -0.09], 13);
      mapRef.current = map;
    }

    // Get the selected provider configuration
    const selectedProvider = tileProviders[provider];
    
    // Remove existing tile layer if it exists
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    // Add the new tile layer
    tileLayerRef.current = L.tileLayer(selectedProvider.url, {
      maxZoom: selectedProvider.maxZoom,
      minZoom: selectedProvider.minZoom,
      attribution: selectedProvider.attribution
    }).addTo(mapRef.current);

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [provider]);

  return <div id={mapContainerId} style={{ height: '100%', width: '100%' }} />;
}
