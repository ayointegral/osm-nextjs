import React from 'react';
import { getTileBounds, formatCoordinate } from '@/utils/tile-utils';

interface TileHierarchyProps {
  z: number;
  x: number;
  y: number;
}

export default function TileHierarchy({ z, x, y }: TileHierarchyProps) {
  const parentTiles = [];
  let currentZ = z;
  let currentX = x;
  let currentY = y;

  // Calculate parent tiles
  while (currentZ > 0) {
    currentZ--;
    currentX = Math.floor(currentX / 2);
    currentY = Math.floor(currentY / 2);
    parentTiles.unshift({ z: currentZ, x: currentX, y: currentY });
  }

  // Calculate child tiles
  const childTiles = [];
  if (z < 20) { // Prevent excessive zoom levels
    const childZ = z + 1;
    const baseX = x * 2;
    const baseY = y * 2;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        childTiles.push({
          z: childZ,
          x: baseX + dx,
          y: baseY + dy
        });
      }
    }
  }

  const formatTileCoords = (tile: { z: number, x: number, y: number }) => {
    const bounds = getTileBounds(tile.x, tile.y, tile.z);
    const coordStr = `(${formatCoordinate(bounds.north)}°, ${formatCoordinate(bounds.east)}°)`;
    return coordStr;
  };

  return (
    <div className="tile-hierarchy-section">
      <div className="flex justify-between items-center mb-4">
        <h2 className="section-title mb-0">Tile Hierarchy</h2>
        <button className="button-secondary">Hide Details</button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="subsection-title">Parent Tiles</h3>
          <div className="tile-hierarchy-list">
            {parentTiles.map((tile) => (
              <div key={`${tile.z}/${tile.x}/${tile.y}`} className="tile-hierarchy-item">
                <span className="tile-coordinates">{tile.z}/{tile.x}/{tile.y}</span>
                <span className="tile-hierarchy-bounds">{formatTileCoords(tile)}</span>
              </div>
            ))}
            <div className="tile-hierarchy-item bg-blue-50">
              <span className="tile-coordinates">{z}/{x}/{y}</span>
              <span className="tile-hierarchy-bounds">{formatTileCoords({ z, x, y })}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="subsection-title">Child Tiles (Next Zoom)</h3>
          <div className="tile-hierarchy-list">
            {childTiles.map((tile) => (
              <div key={`${tile.z}/${tile.x}/${tile.y}`} className="tile-hierarchy-item">
                <span className="tile-coordinates">{tile.z}/{tile.x}/{tile.y}</span>
                <span className="tile-hierarchy-bounds">{formatTileCoords(tile)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="subsection-title">How Tile Coordinates Work:</h3>
          <ul className="text-content space-y-2 list-disc pl-4">
            <li>Each zoom level (z) doubles the number of tiles in both directions</li>
            <li>Current zoom level {z} has {Math.pow(2, z)} × {Math.pow(2, z)} tiles</li>
            <li>X coordinates go from west to east (0 to {Math.pow(2, z) - 1})</li>
            <li>Y coordinates go from north to south (0 to {Math.pow(2, z) - 1})</li>
            <li>Each parent tile splits into 4 child tiles at the next zoom level</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
