'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import TileInfo from '@/components/TileInfo';
import TileComparison from '@/components/TileComparison';
import TilePyramid from '@/components/TilePyramid';
import Navigation from '@/components/Navigation';
import { isValidTile } from '@/utils/tile-utils';

export default function TileViewer() {
  const params = useParams();
  const { z, x, y } = params;
  const [showComparison, setShowComparison] = useState(false);
  
  // Remove .png from y if present
  const cleanY = y?.toString().replace('.png', '');
  
  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${cleanY}.png`;

  // Validate tile coordinates
  if (!isValidTile(Number(x), Number(cleanY), Number(z))) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Invalid Tile Coordinates</h1>
          <p className="mb-4 text-gray-700">The requested tile coordinates are invalid for this zoom level.</p>
          <Link href="/osm/0/0/0" className="text-blue-500 hover:underline">
            Return to world view
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">OSM Tile Viewer</h1>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Main tile view */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="relative aspect-square w-full">
                <Image
                  src={tileUrl}
                  alt={`Tile ${z}/${x}/${cleanY}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="mt-4 flex justify-between items-center">
                <Navigation
                  onZoomIn={() => {
                    if (Number(z) < 22) {
                      window.location.href = `/osm/${Number(z) + 1}/${Number(x) * 2}/${Number(cleanY) * 2}`;
                    }
                  }}
                  onZoomOut={() => {
                    if (Number(z) > 0) {
                      window.location.href = `/osm/${Number(z) - 1}/${Math.floor(Number(x) / 2)}/${Math.floor(Number(cleanY) / 2)}`;
                    }
                  }}
                  currentZoom={Number(z)}
                  maxZoom={22}
                  minZoom={0}
                />

              </div>
            </div>
          </div>

          {/* Right column - Info and controls */}
          <div className="space-y-6">
            <TileInfo z={Number(z)} x={Number(x)} y={Number(cleanY)} url={tileUrl} />
            <TilePyramid z={Number(z)} x={Number(x)} y={Number(cleanY)} />
            <div className="flex justify-end">
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600"
              >
                Show Comparison
              </button>
            </div>
          </div>
        </div>

        {/* Comparison section */}
        {showComparison && (
          <TileComparison z={Number(z)} x={Number(x)} y={Number(cleanY)} />
        )}
      </div>
    </div>
  );
}
