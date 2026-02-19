// Tile coordinate to lat/lon conversion
export function tile2latLon(x: number, y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return {
    lat: (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))),
    lon: (x / Math.pow(2, z) * 360 - 180)
  };
}

// Calculate tile bounds
export function getTileBounds(x: number, y: number, z: number) {
  const topLeft = tile2latLon(x, y, z);
  const bottomRight = tile2latLon(x + 1, y + 1, z);
  return {
    north: topLeft.lat,
    south: bottomRight.lat,
    west: topLeft.lon,
    east: bottomRight.lon
  };
}

// Calculate approximate scale at the center of the tile
export function getApproximateScale(z: number) {
  // Earth's circumference at the equator in meters
  const earthCircumference = 40075016.686;
  // Tile size in pixels
  const tileSize = 256;
  // Number of tiles at this zoom level
  const numTiles = Math.pow(2, z);
  // Meters per pixel at this zoom level
  const metersPerPixel = earthCircumference / (numTiles * tileSize);
  return metersPerPixel;
}

interface TileProvider {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
  maxNativeZoom: number;
  highZoomConfig?: {
    quality: 'low' | 'medium' | 'high';
    progressiveLoading: boolean;
    scaleMethod: 'nearest' | 'bilinear' | 'pixelated' | 'auto';
    preloadAdjacent?: boolean;
    fadeAnimation?: boolean;
    retryOnError?: boolean;
  };
}

// Available tile providers with optimized configurations
export const tileProviders: Record<string, TileProvider> = {
  osm_local: {
    name: 'Local OpenStreetMap',
    url: '/osm/{z}/{x}/{y}.png',
    attribution: ' OpenStreetMap contributors',
    maxZoom: 20,
    minZoom: 0,
    maxNativeZoom: 18,
    highZoomConfig: {
      quality: 'high',
      progressiveLoading: true,
      scaleMethod: 'auto',
      preloadAdjacent: true,
      fadeAnimation: true,
      retryOnError: true
    }
  }
};

// Calculate subtiles with validation
export function getSubtiles(x: number, y: number, z: number, provider?: string) {
  const subtiles = [
    { x: x * 2, y: y * 2, z: z + 1 },
    { x: x * 2 + 1, y: y * 2, z: z + 1 },
    { x: x * 2, y: y * 2 + 1, z: z + 1 },
    { x: x * 2 + 1, y: y * 2 + 1, z: z + 1 }
  ];
  return subtiles.filter(tile => isValidTile(tile.x, tile.y, tile.z, provider));
}

// Format coordinates for display
export function formatCoordinate(value: number) {
  return value.toFixed(6);
}

// Check if tile coordinates are valid for zoom level and provider
export function isValidTile(x: number, y: number, z: number, provider?: string) {
  if (z < 0) return false;
  const maxCoord = Math.pow(2, z) - 1;
  const isValidCoord = x >= 0 && x <= maxCoord && y >= 0 && y <= maxCoord;
  
  if (!isValidCoord) return false;
  
  // Check provider-specific constraints
  if (provider && tileProviders[provider]) {
    const { maxNativeZoom, maxZoom } = tileProviders[provider];
    if (z > maxZoom) return false;
    
    // For high zoom levels, check if parent tiles exist
    if (z > maxNativeZoom) {
      const scaleLevel = z - maxNativeZoom;
      const parentX = Math.floor(x / Math.pow(2, scaleLevel));
      const parentY = Math.floor(y / Math.pow(2, scaleLevel));
      return isValidTile(parentX, parentY, maxNativeZoom, provider);
    }
  }
  
  return true;
}

// Get parent tile coordinates
export function getParentTile(x: number, y: number, z: number, levels: number = 1) {
  const parentZ = z - levels;
  if (parentZ < 0) return null;
  
  const scale = Math.pow(2, levels);
  return {
    x: Math.floor(x / scale),
    y: Math.floor(y / scale),
    z: parentZ
  };
}

// Get adjacent tiles for preloading
export function getAdjacentTiles(x: number, y: number, z: number, includeCorners: boolean = false) {
  const adjacent = [
    { x: x + 1, y, z }, // right
    { x: x - 1, y, z }, // left
    { x, y: y + 1, z }, // bottom
    { x, y: y - 1, z }  // top
  ];

  if (includeCorners) {
    adjacent.push(
      { x: x + 1, y: y + 1, z }, // bottom-right
      { x: x + 1, y: y - 1, z }, // top-right
      { x: x - 1, y: y + 1, z }, // bottom-left
      { x: x - 1, y: y - 1, z }  // top-left
    );
  }

  return adjacent.filter(tile => isValidTile(tile.x, tile.y, tile.z));
}

// Enhanced tile size cache with TTL
interface CacheEntry {
  size: number;
  timestamp: number;
  etag?: string;
}

const tileSizeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Calculate tile size in bytes with enhanced caching
export async function getTileSize(url: string) {
  // Only allow internal URLs (air-gapped — no external requests)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.warn('getTileSize: external URLs blocked in air-gapped mode');
    return 0;
  }

  const now = Date.now();
  const cached = tileSizeCache.get(url);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.size;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'Accept': 'image/png,image/jpeg',
        'Cache-Control': 'max-age=2592000', // 30 days cache
      },
      signal: controller.signal,
      credentials: 'same-origin'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const size = response.headers.get('content-length');
    const etag = response.headers.get('etag');
    
    if (!size) {
      return 0;
    }
    
    const sizeNum = parseInt(size, 10);
    
    // Cache the result with timestamp and ETag
    tileSizeCache.set(url, {
      size: sizeNum,
      timestamp: now,
      etag: etag || undefined
    });
    
    return sizeNum;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('Tile size request timed out:', url);
      } else {
        console.error('Error getting tile size:', error);
      }
    }
    return 0;
  }
}

// Clear expired entries from tile size cache
export function cleanTileSizeCache() {
  const now = Date.now();
  for (const [url, entry] of tileSizeCache.entries()) {
    if ((now - entry.timestamp) >= CACHE_TTL) {
      tileSizeCache.delete(url);
    }
  }
}

// Clear all entries from tile size cache
export function clearTileSizeCache() {
  tileSizeCache.clear();
}
