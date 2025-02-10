import { useState } from 'react';
import Image from 'next/image';
import { tileProviders } from '@/utils/tile-utils';

interface TileComparisonProps {
  z: number;
  x: number;
  y: number;
}

export default function TileComparison({ z, x, y }: TileComparisonProps) {
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});
  const handleImageError = (key: string) => {
    setLoadErrors(prev => ({ ...prev, [key]: true }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Tile Comparison</h2>
        <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">Hide Comparison</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(tileProviders).map(([key, provider]) => {
          const url = provider.url
            .replace('{z}', z.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString());

          return (
            <div key={key} className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
              </div>
              <div className="relative aspect-square">
                {loadErrors[key] ? (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-gray-50">
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-red-600">Unable to load tile</p>
                      <p className="text-sm text-gray-600">This style may not support zoom level {z}</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={url}
                      alt={`${provider.name} tile ${z}/${x}/${y}`}
                      fill
                      className="object-cover"
                      onError={() => handleImageError(key)}
                      unoptimized // Since these are map tiles, we want to skip Next.js optimization
                    />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
                  {z}/{x}/{y}
                </div>
              </div>
              <div className="p-3 text-xs text-gray-500 bg-white border-t border-gray-200">
                {provider.attribution}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
