'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import TileInfo from '@/components/TileInfo';
import TileComparison from '@/components/TileComparison';
import TilePyramid from '@/components/TilePyramid';
import Navigation from '@/components/Navigation';
import LocationSearch from '@/components/LocationSearch';
import { isValidTile } from '@/utils/tile-utils';

export default function TileViewer() {
  const params = useParams();
  const router = useRouter();
  const { z, x, y } = params;
  const [showComparison, setShowComparison] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  
  // Remove .png from y if present
  const cleanY = y?.toString().replace('.png', '');
  
  const tileUrl = `/api/tiles/${z}/${x}/${cleanY}`;

  // Validate tile coordinates
  if (!isValidTile(Number(x), Number(cleanY), Number(z))) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Invalid Tile Coordinates</h1>
          <p className="mb-4 text-gray-700">The requested tile coordinates are invalid for this zoom level.</p>
          <Link href="/tile-viewer/0/0/0" className="text-blue-500 hover:underline">
            Return to world view
          </Link>
        </div>
      </div>
    );
  }

  const handleLocationSelect = (lat: number, lon: number, zoom: number) => {
    const tileX = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    router.push(`/tile-viewer/${zoom}/${tileX}/${tileY}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">OSM Tile Viewer</h1>
            </div>
            <LocationSearch onSelect={handleLocationSelect} />
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Main tile view */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="relative aspect-square w-full">
                {isImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <Image
                  src={tileUrl}
                  alt={`Tile ${z}/${x}/${cleanY}`}
                  fill
                  className={`object-contain transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                  unoptimized
                  onLoad={() => setIsImageLoading(false)}
                  onLoadStart={() => setIsImageLoading(true)}
                />
              </div>
              <div className="mt-4 flex justify-between items-center">
                <Navigation
                  onZoomIn={() => {
                    if (Number(z) < 22) {
                      router.push(`/tile-viewer/${Number(z) + 1}/${Number(x) * 2}/${Number(cleanY) * 2}`);
                    }
                  }}
                  onZoomOut={() => {
                    if (Number(z) > 0) {
                      router.push(`/tile-viewer/${Number(z) - 1}/${Math.floor(Number(x) / 2)}/${Math.floor(Number(cleanY) / 2)}`);
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
