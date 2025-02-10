import { useEffect, useState } from 'react';
import { getTileBounds, getApproximateScale, formatCoordinate } from '@/utils/tile-utils';

interface TileInfoProps {
  z: number;
  x: number;
  y: number;
  url: string;
}

export default function TileInfo({ z, x, y, url }: TileInfoProps) {
  const [error, setError] = useState<string>('');

  const bounds = getTileBounds(x, y, z);
  const scale = getApproximateScale(z);

  useEffect(() => {
    setError('');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    fetch(url, { signal: controller.signal })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load tile: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        if (blob.size === 0) {
          throw new Error('Empty tile response');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          setError('Tile request timed out');
        } else {
          console.error('Error loading tile:', err);
          setError('Failed to load tile information');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [url]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div role="complementary" aria-label="Tile Information" className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Tile Information</h2>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Geographic Bounds</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-gray-600">North:</span>{' '}
            <span className="font-medium text-gray-900">{formatCoordinate(bounds.north)}°</span>
          </div>
          <div>
            <span className="text-gray-600">East:</span>{' '}
            <span className="font-medium text-gray-900">{formatCoordinate(bounds.east)}°</span>
          </div>
          <div>
            <span className="text-gray-600">South:</span>{' '}
            <span className="font-medium text-gray-900">{formatCoordinate(bounds.south)}°</span>
          </div>
          <div>
            <span className="text-gray-600">West:</span>{' '}
            <span className="font-medium text-gray-900">{formatCoordinate(bounds.west)}°</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-2">Scale</h3>
        <div className="text-gray-900 font-medium mb-6">
          ~{scale.toFixed(2)} meters/pixel
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-2">How Tile Coordinates Work</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-center space-x-2">Each zoom level (z) doubles the number of tiles in both directions</li>
          <li className="flex items-center space-x-2">Current zoom level {z} has 2^{z} × 2^{z} = {Math.pow(2, z)} × {Math.pow(2, z)} tiles</li>
          <li className="flex items-center space-x-2">X coordinates go from west to east (0 to {Math.pow(2, z) - 1})</li>
          <li className="flex items-center space-x-2">Y coordinates go from north to south (0 to {Math.pow(2, z) - 1})</li>
          <li className="flex items-center space-x-2">Each parent tile splits into 4 child tiles at the next zoom level</li>
        </ul>
      </div>
    </div>
  );
}
