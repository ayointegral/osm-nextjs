import { useState } from 'react';
import Link from 'next/link';
import { tile2latLon } from '@/utils/tile-utils';

interface TilePyramidProps {
  z: number;
  x: number;
  y: number;
}

/* eslint-disable react-hooks/rules-of-hooks */
export default function TilePyramid({ z, x, y }: TilePyramidProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate parent tiles up to zoom level 0
  const parentTiles = [];
  let currentX = x;
  let currentY = y;
  for (let currentZ = z; currentZ >= 0; currentZ--) {
    const center = tile2latLon(currentX + 0.5, currentY + 0.5, currentZ);
    parentTiles.unshift({
      z: currentZ,
      x: currentX,
      y: currentY,
      center
    });
    currentX = Math.floor(currentX / 2);
    currentY = Math.floor(currentY / 2);
  }

  // Calculate child tiles (next zoom level)
  const childTiles = [
    { x: x * 2, y: y * 2 },
    { x: x * 2 + 1, y: y * 2 },
    { x: x * 2, y: y * 2 + 1 },
    { x: x * 2 + 1, y: y * 2 + 1 }
  ].map(tile => ({
    z: z + 1,
    x: tile.x,
    y: tile.y,
    center: tile2latLon(tile.x + 0.5, tile.y + 0.5, z + 1)
  }));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Tile Hierarchy</h2>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {showDetails ? (
        <div className="space-y-6">
          {/* Parent tiles */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Parent Tiles</h3>
            <div className="space-y-2">
              {parentTiles.map((tile) => (
                <Link
                  key={tile.z}
                  href={`/osm/${tile.z}/${tile.x}/${tile.y}`}
                  className={`block p-2 rounded hover:bg-blue-50 ${tile.z === z ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">{tile.z}/{tile.x}/{tile.y}</span>
                    <span className="text-sm text-gray-900">
                      ({tile.center.lat.toFixed(2)}°, {tile.center.lon.toFixed(2)}°)
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Child tiles */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Child Tiles (Next Zoom)</h3>
            <div className="grid grid-cols-2 gap-2">
              {childTiles.map((tile) => (
                <Link
                  key={`${tile.x}-${tile.y}`}
                  href={`/osm/${tile.z}/${tile.x}/${tile.y}`}
                  className="p-2 rounded hover:bg-blue-50"
                >
                  <div className="text-sm">
                    <div className="text-blue-700">{tile.z}/{tile.x}/{tile.y}</div>
                    <div className="text-gray-900">
                      ({tile.center.lat.toFixed(2)}°, {tile.center.lon.toFixed(2)}°)
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm text-gray-900 mb-2">How Tile Coordinates Work:</div>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-900">
            <li>Each zoom level (z) doubles the number of tiles in both directions</li>
            <li>Current zoom level {z} has 2^{z} × 2^{z} = {Math.pow(2, z)} × {Math.pow(2, z)} tiles</li>
            <li>X coordinates go from west to east (0 to 1)</li>
            <li>Y coordinates go from north to south (0 to 1)</li>
            <li>Each parent tile splits into 4 child tiles at the next zoom level</li>
          </ul>
        </div>
      )}
    </div>
  );
}
