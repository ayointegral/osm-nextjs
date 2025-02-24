'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { tileProviders } from '@/utils/tile-utils';

// Dynamically import the Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function TileViewer() {
  const [selectedProvider, setSelectedProvider] = useState('osm_local');

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">OSM Tile Viewer</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[600px] relative">
          <Map provider={selectedProvider} />
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Tile Providers</h2>
          <div className="space-y-2">
            {Object.entries(tileProviders).map(([key, provider]) => (
              <button
                key={key}
                onClick={() => setSelectedProvider(key)}
                className={`w-full p-2 text-left rounded ${
                  selectedProvider === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {provider.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
