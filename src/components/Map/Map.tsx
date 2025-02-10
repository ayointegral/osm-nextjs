'use client';

/**
 * Map Component
 * 
 * A feature-rich map component that provides:
 * 1. Multiple tile layer support with layer controls
 * 2. Settings persistence across sessions
 * 3. High zoom level optimizations
 * 4. Efficient tile loading and caching
 * 
 * @see /docs/CACHING.md for detailed documentation of caching mechanisms
 */

import { useEffect, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { MapContainer, TileLayer, ZoomControl, LayersControl, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileProviders, isValidTile } from '@/utils/tile-utils';
import { HighZoomTileLayer } from './HighZoomTileLayer';

// Initialize Leaflet globals for window object
if (typeof window !== 'undefined') {
  window.L = L;
  window.map = undefined as unknown as L.Map;
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
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 } // London
      };
    }
    return await response.json();
  } catch (error) {
    console.warn('Error loading settings, using defaults:', error);
    return {
      defaultProvider: 'osm',
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
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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

// TileLoadHandler component to handle tile loading and prefetching
function TileLoadHandler({
  onTileLoad,
  onTileError,
  onTileLoading,
  selectedProvider
}: {
  onTileLoad: () => void;
  onTileError: (event: L.TileErrorEvent) => void;
  onTileLoading: () => void;
  selectedProvider: string;
}) {
  const map = useMap();

  const prefetchTiles = useCallback((x: number, y: number, z: number) => {
    const adjacent = [
      { x: x+1, y: y },
      { x: x-1, y: y },
      { x: x, y: y+1 },
      { x: x, y: y-1 }
    ];

    adjacent.forEach(pos => {
      if (isValidTile(pos.x, pos.y, z)) {
        const url = tileLayers[selectedProvider].url
          .replace('{x}', pos.x.toString())
          .replace('{y}', pos.y.toString())
          .replace('{z}', z.toString());
        new Image().src = url;
      }
    });
  }, [selectedProvider]);

  useEffect(() => {
    if (!map) return;

    const handleTileLoad = () => {
      onTileLoad();
      
      const bounds = map.getBounds();
      const z = map.getZoom();
      
      // Calculate visible tile coordinates
      const nw = map.project(bounds.getNorthWest(), z);
      const se = map.project(bounds.getSouthEast(), z);
      const tileSize = 256;
      
      const tileBounds = {
        minX: Math.floor(nw.x / tileSize),
        maxX: Math.floor(se.x / tileSize),
        minY: Math.floor(nw.y / tileSize),
        maxY: Math.floor(se.y / tileSize)
      };
      
      // Prefetch adjacent tiles for visible area
      for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
        for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
          prefetchTiles(x, y, z);
        }
      }
    };

    map.on('tileload', handleTileLoad);
    map.on('tileerror', onTileError);
    map.on('tileloadstart', onTileLoading);

    return () => {
      map.off('tileload', handleTileLoad);
      map.off('tileerror', onTileError);
      map.off('tileloadstart', onTileLoading);
    };
  }, [map, onTileLoad, onTileError, onTileLoading, prefetchTiles]);

  return null;
}

// MapEventHandler component to handle map events
function MapEventHandler({
  onZoomChange, 
  onMoveEnd,
  onLayerChange
}: { 
  onZoomChange: (zoom: number, center: L.LatLng) => void;
  onMoveEnd: (center: L.LatLng) => void;
  onLayerChange: (name: string) => void;
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

    const handleBaseLayerChange = (e: L.LayersControlEvent) => {
      const layerName = Object.entries(tileLayers).find(
        ([, layer]) => layer.name === e.name
      )?.[0];
      if (layerName) {
        onLayerChange(layerName);
      }
    };

    map.on('zoomend', handleZoom);
    map.on('moveend', handleMove);
    map.on('baselayerchange', handleBaseLayerChange);

    return () => {
      map.off('zoomend', handleZoom);
      map.off('moveend', handleMove);
      map.off('baselayerchange', handleBaseLayerChange);
    };
  }, [map, onZoomChange, onMoveEnd, onLayerChange]);

  return null;
}

interface TileLayerConfig {
  url: string;
  attribution: string;
  name: string;
  maxZoom: number;
  minZoom: number;
}

// Convert tile providers to Leaflet format
const tileLayers = Object.entries(tileProviders).reduce((acc, [key, provider]) => {
  acc[key] = {
    url: provider.url.replace('{z}', '{z}').replace('{x}', '{x}').replace('{y}', '{y}'),
    attribution: provider.attribution,
    name: provider.name,
    maxZoom: provider.maxZoom,
    minZoom: provider.minZoom
  };
  return acc;
}, {} as Record<string, TileLayerConfig>);

export const Map = ({ 
  center = [51.505, -0.09], // Default to London
  zoom = 13,
  minZoom = 0,
  maxZoom = 20
}: MapProps) => {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(center as [number, number]);
  const [selectedProvider, setSelectedProvider] = useState('osm');
  // Load initial settings
  useEffect(() => {
    loadSettings().then(settings => {
      if (settings) {
        setCurrentCenter([settings.defaultCenter.lat, settings.defaultCenter.lng]);
        setCurrentZoom(settings.defaultZoom);
        setSelectedProvider(settings.defaultProvider);
      }
    });
  }, []);

  const debouncedSaveSettings = useCallback((settings: MapSettings) => {
    if (!settings?.defaultProvider || !settings?.defaultCenter || typeof settings?.defaultZoom !== 'number') {
      console.error('Invalid settings object:', settings);
      return;
    }
    
    const debouncedSave = debounce(async () => {
      try {
        await saveSettings(settings);
      } catch (error) {
        console.error('Error in debouncedSaveSettings:', error);
      }
    }, 1000);

    debouncedSave();
  }, []);

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
    const newCenter: [number, number] = [center.lat, center.lng];
    setCurrentCenter(newCenter);
    debouncedSaveSettings({
      defaultProvider: selectedProvider,
      defaultZoom: currentZoom,
      defaultCenter: {
        lat: center.lat,
        lng: center.lng
      }
    });
  }, [currentZoom, selectedProvider, debouncedSaveSettings]);

  const handleBaseLayerChange = useCallback(async (providerName: string) => {
    setSelectedProvider(providerName);
    
    // Save to database
    try {
      const settings: MapSettings = {
        defaultProvider: providerName,
        defaultZoom: currentZoom,
        defaultCenter: {
          lat: currentCenter[0],
          lng: currentCenter[1]
        }
      };
      await saveSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [currentCenter, currentZoom]);

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
          onLayerChange={handleBaseLayerChange}
        />

        {/* Base map layer */}
        <TileLayer
          attribution={tileLayers.osm.attribution}
          url={tileLayers.osm.url}
        />

        {/* Layer control for different map styles */}
        <LayersControl position="topright">
          {Object.entries(tileLayers).map(([key, layer]) => (
            <LayersControl.BaseLayer
              key={key}
              checked={key === selectedProvider}
              name={layer.name}
            >
              <HighZoomTileLayer
                attribution={layer.attribution}
                url={layer.url}
                maxZoom={tileProviders[key as keyof typeof tileProviders].maxZoom}
                minZoom={layer.minZoom}
                maxNativeZoom={tileProviders[key as keyof typeof tileProviders].maxNativeZoom}
                highZoomConfig={tileProviders[key as keyof typeof tileProviders].highZoomConfig}
                onTileLoading={() => console.log('Loading tile')}
                onTileLoad={() => console.log('Tile loaded')}
                onTileError={() => console.error('Error loading tile')}
              />
            </LayersControl.BaseLayer>
          ))}
        </LayersControl>

        {/* Zoom controls */}
        <div className="leaflet-control-container">
          <div className="leaflet-bottom leaflet-right">
            <ZoomControl />
          </div>
        </div>

        {/* Tile loading handler */}
        <TileLoadHandler
          onTileLoad={() => console.log('Tile loaded')}
          onTileError={(event) => console.error('Error loading tile:', event.coords, event.error)}
          onTileLoading={() => console.log('Loading tile')}
          selectedProvider={selectedProvider}
        />

        {/* Scale control */}
        <ScaleControl position="bottomleft" />
        
      </MapContainer>
    </div>
  );
};
