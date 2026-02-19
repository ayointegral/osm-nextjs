'use client';

/**
 * Map Component
 * 
 * A feature-rich map component that provides:
 * 1. Local tile layer support with high zoom optimizations
 * 2. Settings persistence across sessions
 * 3. High zoom level optimizations
 * 4. Efficient tile loading and caching
 * 
 * @see /docs/CACHING.md for detailed documentation of caching mechanisms
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { MapContainer, ZoomControl, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileProviders } from '@/utils/tile-utils';
import { HighZoomTileLayer } from './HighZoomTileLayer';

// Initialize Leaflet globals for window object
if (typeof window !== 'undefined') {
  window.L = L;
  const windowWithMap = window as Window & { map?: L.Map };
  if ('map' in windowWithMap) {
    delete windowWithMap.map;
  }
}

/**
 * Loads map settings from the API
 * Falls back to default values if API call fails
 * @returns Promise<MapSettings>
 */
async function loadSettings(): Promise<MapSettings> {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) {
      console.warn('Failed to load settings, using defaults');
      return {
        defaultProvider: 'osm_local',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 } // London
      };
    }
    return await response.json();
  } catch (error) {
    console.warn('Error loading settings, using defaults:', error);
    return {
      defaultProvider: 'osm_local',
      defaultZoom: 13,
      defaultCenter: { lat: 51.505, lng: -0.09 } // London
    };
  }
}

/**
 * Map settings interface
 */
interface MapSettings {
  /** Default tile provider ID */
  defaultProvider: string;
  /** Default zoom level */
  defaultZoom: number;
  /** Default center coordinates */
  defaultCenter: {
    lat: number;
    lng: number;
  };
}

/**
 * Saves map settings to the API
 * Handles various error cases and response formats
 * @param settings MapSettings to save
 * @returns Promise<MapSettings | null>
 */
async function saveSettings(settings: MapSettings): Promise<MapSettings | null> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        throw new Error(data.error || 'Failed to save settings');
      } catch {
        throw new Error(`Failed to save settings: ${text}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(`Expected JSON response but got ${contentType}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return null;
  }
}

// Fix Leaflet's icon paths
delete ((L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string }))._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/images/marker-icon-2x.png',
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
});

interface MapProps {
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

// MapInitializer component to handle map initialization
function MapInitializer({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      onMapReady(map);
      
      // Set global map instance and trigger a custom event
      window.map = map;
      window.dispatchEvent(new CustomEvent('map-initialized'));
    }
  }, [map, onMapReady]);
  
  return null;
}

// MapEventHandler component to handle map events
function MapEventHandler({
  onZoomChange, 
  onMoveEnd
}: { 
  onZoomChange: (zoom: number, center: L.LatLng) => void;
  onMoveEnd: (center: L.LatLng) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      onZoomChange(map.getZoom(), map.getCenter());
    };

    const handleMove = () => {
      onMoveEnd(map.getCenter());
    };

    map.on('zoomend', handleZoom);
    map.on('moveend', handleMove);

    return () => {
      map.off('zoomend', handleZoom);
      map.off('moveend', handleMove);
    };
  }, [map, onZoomChange, onMoveEnd]);

  return null;
}

export const Map = ({ 
  center = [51.505, -0.09], // Default to London
  zoom = 13,
  minZoom = 0,
  maxZoom = 19
}: MapProps) => {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const selectedProvider = 'osm_local';

  // Load initial settings
  useEffect(() => {
    loadSettings().then(settings => {
      if (settings) {
        setCurrentZoom(settings.defaultZoom);
      }
    });
  }, []);

  const debouncedSave = useMemo(
    () => debounce(async (settings: MapSettings) => {
      try {
        await saveSettings(settings);
      } catch (error) {
        console.error('Error in debouncedSaveSettings:', error);
      }
    }, 1000),
    []
  );

  const debouncedSaveSettings = useCallback((settings: MapSettings) => {
    if (!settings?.defaultProvider || !settings?.defaultCenter || typeof settings?.defaultZoom !== 'number') {
      console.error('Invalid settings object:', settings);
      return;
    }
    debouncedSave(settings);
  }, [debouncedSave]);

  const handleZoomChange = useCallback((zoom: number, center: L.LatLng) => {
    setCurrentZoom(zoom);
    debouncedSaveSettings({
      defaultProvider: selectedProvider,
      defaultZoom: zoom,
      defaultCenter: {
        lat: center.lat,
        lng: center.lng
      }
    });
  }, [selectedProvider, debouncedSaveSettings]);

  const handleMoveEnd = useCallback((center: L.LatLng) => {
    debouncedSaveSettings({
      defaultProvider: selectedProvider,
      defaultZoom: currentZoom,
      defaultCenter: {
        lat: center.lat,
        lng: center.lng
      }
    });
  }, [currentZoom, selectedProvider, debouncedSaveSettings]);

  const provider = tileProviders.osm_local;

  return (
    <div className="relative w-full h-screen [&_.leaflet-tile-container]:text-[12px] md:text-[14px]">
      <style jsx global>{`
        .leaflet-tile text {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          paint-order: stroke;
          stroke: white;
          stroke-width: 2px;
          stroke-linecap: round;
          stroke-linejoin: round;
          font-weight: 500;
        }
        
        /* Ensure text remains readable at all zoom levels */
        .leaflet-tile-container {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Improve text contrast */
        .leaflet-tile text {
          filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.5));
        }
      `}</style>
      <MapContainer
        id="map"
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        zoomControl={false}
        className="w-full h-full"
      >
        {/* Map initialization handler - runs before other components */}
        <MapInitializer onMapReady={() => {}} />
        
        <MapEventHandler 
          onZoomChange={handleZoomChange}
          onMoveEnd={handleMoveEnd}
        />

        {/* Base map layer */}
        <HighZoomTileLayer
          attribution={provider.attribution}
          url={provider.url}
          maxZoom={provider.maxZoom}
          minZoom={provider.minZoom}
          maxNativeZoom={provider.maxNativeZoom}
          highZoomConfig={provider.highZoomConfig}
        />

        {/* Zoom controls */}
        <div className="leaflet-control-container">
          <div className="leaflet-bottom leaflet-right">
            <ZoomControl />
          </div>
        </div>

        {/* Scale control */}
        <ScaleControl position="bottomleft" />
        
      </MapContainer>
    </div>
  );
};
