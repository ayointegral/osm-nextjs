/**
 * HighZoomTileLayer Component
 * 
 * A specialized tile layer component that handles high zoom levels with optimizations:
 * 1. Progressive tile loading with quality controls
 * 2. Smart caching for parent tiles during zoom transitions
 * 3. Efficient tile preloading for adjacent areas
 * 4. Hardware-accelerated transforms for smooth scaling
 * 
 * @see /docs/CACHING.md for detailed documentation of caching mechanisms
 */

import { useEffect, useCallback, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';

/**
 * Props for the HighZoomTileLayer component
 */
interface HighZoomTileLayerProps {
  /** URL template for tile source */
  /** Attribution text for the tile layer */
  /** Maximum zoom level supported */
  /** Minimum zoom level supported */
  /** Maximum zoom level with native tile support */
  /** Callback when a tile finishes loading */
  /** Callback when a tile fails to load */
  /** Callback when a tile starts loading */
  /** Configuration for high zoom behavior */
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
  maxNativeZoom: number;
  onTileLoad?: () => void;
  onTileError?: () => void;
  onTileLoading?: () => void;
  highZoomConfig?: {
    quality: 'low' | 'medium' | 'high';
    progressiveLoading: boolean;
    scaleMethod: 'nearest' | 'bilinear' | 'pixelated' | 'auto';
  };
}

export function HighZoomTileLayer({
  url,
  attribution,
  maxZoom,
  minZoom,
  maxNativeZoom,
  onTileLoad,
  onTileError,
  onTileLoading,
  highZoomConfig
}: HighZoomTileLayerProps) {
  const map = useMap();
  const currentZoom = map.getZoom();

  // Create a loading queue for progressive loading
  // Tile state tracking
  const tileCache = useRef<{
    loading: Set<string>;    // Tiles currently being loaded
    loaded: Set<string>;     // Successfully loaded tiles
    parents: Set<string>;    // Parent tiles for zoom transitions
  }>({
    loading: new Set(),
    loaded: new Set(),
    parents: new Set()
  });

  /**
   * Returns a transparent PNG as fallback for failed tile loads
   * Prevents grey flashing when tiles fail to load
   */
  const getErrorTile = useCallback(() => 
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  []);

  /**
   * Calculates parent tile coordinates for a given tile
   * Used when displaying tiles beyond maxNativeZoom
   */
  const getParentTile = useCallback((x: number, y: number, z: number) => {
    const scale = Math.pow(2, z - maxNativeZoom);
    return {
      x: Math.floor(x / scale),
      y: Math.floor(y / scale),
      z: maxNativeZoom
    };
  }, [maxNativeZoom]);

  /**
   * Preloads adjacent tiles to improve perceived loading speed
   * Only loads tiles that haven't been loaded or aren't currently loading
   */
  const preloadAdjacentTiles = useCallback((x: number, y: number, z: number) => {
    const adjacent = [
      { x: x+1, y },
      { x: x-1, y },
      { x, y: y+1 },
      { x, y: y-1 }
    ];

    adjacent.forEach(pos => {
      const tileKey = `${z}/${pos.x}/${pos.y}`;
      const cache = tileCache.current;
      
      if (!cache.loaded.has(tileKey) && !cache.loading.has(tileKey)) {
        cache.loading.add(tileKey);
        const img = new Image();
        img.onload = () => {
          cache.loaded.add(tileKey);
          cache.loading.delete(tileKey);
        };

        // If beyond maxNativeZoom, load parent tile instead
        if (z > maxNativeZoom) {
          const parent = getParentTile(pos.x, pos.y, z);
          const parentKey = `${parent.z}/${parent.x}/${parent.y}`;
          cache.parents.add(parentKey);
          img.src = url
            .replace('{x}', parent.x.toString())
            .replace('{y}', parent.y.toString())
            .replace('{z}', parent.z.toString());
        } else {
          img.src = url
            .replace('{x}', pos.x.toString())
            .replace('{y}', pos.y.toString())
            .replace('{z}', z.toString());
        }
      }
    });
  }, [url, maxNativeZoom, getParentTile]);

  // Keep track of the last successful parent tiles
  const lastParentTiles = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!map) return;
    // Capture ref value at the start of the effect
    const cache = tileCache.current;

    const handleZoomStart = () => {
      // Keep existing tiles during zoom transition
      const panes = map.getPanes();
      if (panes.tilePane) {
        panes.tilePane.style.transition = 'transform 0.3s ease-out';
      }
    };

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      const isHighZoom = zoom > maxNativeZoom;
      const panes = map.getPanes();
      
      if (!panes.tilePane) return;

      if (isHighZoom) {
        // Calculate scale factor for high zoom levels
        const scale = Math.pow(2, zoom - maxNativeZoom);
        const opacity = Math.max(0.95, 1 - (zoom - maxNativeZoom) * 0.01);
        
        // Apply progressive scaling with improved transitions
        map.getContainer().style.filter = `brightness(${opacity})`;
        
        // Enhanced scaling for high zoom levels
        const scaleMethod = highZoomConfig?.scaleMethod || 'auto';
        panes.tilePane.style.imageRendering = 'auto';
        
        // Optimized transitions
        panes.tilePane.style.willChange = 'transform';
        panes.tilePane.style.backfaceVisibility = 'hidden';
        panes.tilePane.style.transformOrigin = 'center center';
        
        // Enhanced transform with quality-based scaling
        const qualityScale = scale * (highZoomConfig?.quality === 'high' ? 1.1 : 
                                    highZoomConfig?.quality === 'medium' ? 1 : 0.9);
        
        // Apply transform with hardware acceleration
        panes.tilePane.style.transform = `translate3d(0,0,0) scale3d(${qualityScale}, ${qualityScale}, 1)`;
        
        // Fix text scaling
        const textElements = document.querySelectorAll('.leaflet-tile text');
        textElements.forEach((text) => {
          if (text instanceof SVGTextElement) {
            // Counter-scale text to maintain readable size
            const inverseScale = 1 / qualityScale;
            text.style.transform = `scale(${inverseScale})`;
            // Increase base font size for better readability
            text.style.fontSize = '14px';
          }
        });
        
        // Progressive enhancement
        if (highZoomConfig?.progressiveLoading) {
          requestAnimationFrame(() => {
            if (panes.tilePane) {
              panes.tilePane.style.imageRendering = scaleMethod;
              panes.tilePane.style.filter = 'none';
            }
          });
        }

        // Keep successful parent tiles for smoother transitions
        tileCache.current.parents.forEach((key: string) => {
          lastParentTiles.current.add(key);
        });
      } else {
        // Reset styles for normal zoom levels
        map.getContainer().style.filter = '';
        panes.tilePane.style.imageRendering = '';
        panes.tilePane.style.transform = '';
        panes.tilePane.style.filter = '';
        
        // Reset text scaling
        const textElements = document.querySelectorAll('.leaflet-tile text');
        textElements.forEach((text) => {
          if (text instanceof SVGTextElement) {
            text.style.transform = '';
            text.style.fontSize = '';
          }
        });
        
        // Clear parent tile cache only when zooming out completely
        if (zoom <= maxNativeZoom - 1) {
          lastParentTiles.current.clear();
        }
      }

      // Keep tile cache for smoother transitions
      if (zoom > maxNativeZoom - 1) {
        cache.loading = new Set([...cache.loading]);
        cache.loaded = new Set([...cache.loaded]);
        cache.parents = new Set([...cache.parents, ...lastParentTiles.current]);
      } else {
        cache.loading.clear();
        cache.loaded.clear();
        cache.parents.clear();
      }
    };

    map.on('zoomstart', handleZoomStart);

    const handleMoveEnd = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const nw = map.project(bounds.getNorthWest(), zoom);
      const se = map.project(bounds.getSouthEast(), zoom);
      const tileSize = 256;
      
      // Calculate visible tile coordinates
      const tileBounds = {
        minX: Math.floor(nw.x / tileSize),
        maxX: Math.floor(se.x / tileSize),
        minY: Math.floor(nw.y / tileSize),
        maxY: Math.floor(se.y / tileSize)
      };
      
      // Preload tiles for visible area
      for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
        for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
          preloadAdjacentTiles(x, y, zoom);
        }
      }
    };

    map.on('zoomend', handleZoomEnd);
    map.on('moveend', handleMoveEnd);
    
    return () => {
      map.off('zoomstart', handleZoomStart);
      map.off('zoomend', handleZoomEnd);
      map.off('moveend', handleMoveEnd);
      map.getContainer().style.filter = '';
      const panes = map.getPanes();
      if (panes.tilePane) {
        panes.tilePane.style.imageRendering = '';
        panes.tilePane.style.transform = '';
        panes.tilePane.style.filter = '';
      }
      // Use captured cache value in cleanup
      cache.loading.clear();
      cache.loaded.clear();
      cache.parents.clear();
    };
  }, [map, maxNativeZoom, highZoomConfig, preloadAdjacentTiles]);

  return (
    <TileLayer
      attribution={attribution}
      url={url}
      maxZoom={maxZoom}
      minZoom={minZoom}
      maxNativeZoom={maxNativeZoom}
      errorTileUrl={getErrorTile()}
      className="transition-opacity duration-300 ease-in-out"
      keepBuffer={32}
      updateWhenZooming={false}
      updateWhenIdle={true}
      zIndex={currentZoom > maxNativeZoom ? 300 : undefined}
      tileSize={256}
      detectRetina={true}
      updateInterval={150}
      crossOrigin="anonymous"
      eventHandlers={{
        loading: onTileLoading,
        load: onTileLoad,
        error: onTileError,
        tileloadstart: onTileLoading,
        tileload: onTileLoad,
        tileerror: onTileError
      }}
    />
  );
}
