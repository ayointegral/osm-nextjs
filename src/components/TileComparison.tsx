import { useState } from 'react';

interface TileComparisonProps {
  z: number;
  x: number;
  y: number;
}

export default function TileComparison({ z, x, y }: TileComparisonProps) {
  const [hasError, setHasError] = useState(false);

  const tileUrl = `/osm/${z}/${x}/${y}.png`;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Tile Preview</h2>
      </div>

      <div className="bg-gray-50 rounded-lg overflow-hidden max-w-md">
        <div className="p-4 bg-white border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Local OpenStreetMap</h3>
        </div>
        <div className="relative aspect-square">
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-gray-50">
              <div className="space-y-2">
                <p className="text-lg font-semibold text-red-600">Unable to load tile</p>
                <p className="text-sm text-gray-600">This tile may not be available at zoom level {z}</p>
              </div>
            </div>
          ) : (
            <img
              src={tileUrl}
              alt={`OpenStreetMap tile ${z}/${x}/${y}`}
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
            />
          )}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
            {z}/{x}/{y}
          </div>
        </div>
        <div className="p-3 text-xs text-gray-500 bg-white border-t border-gray-200">
          &copy; OpenStreetMap contributors
        </div>
      </div>
    </div>
  );
}
