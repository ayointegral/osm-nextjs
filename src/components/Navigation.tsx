import React from 'react';

interface NavigationProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  currentZoom: number;
  maxZoom: number;
  minZoom: number;
}

export default function Navigation({ onZoomIn, onZoomOut, currentZoom, maxZoom, minZoom }: NavigationProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Zoom</h2>
      <div className="flex gap-2">
        <button
          onClick={onZoomOut}
          disabled={currentZoom <= minZoom}
          className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Zoom Out
        </button>
        <button
          onClick={onZoomIn}
          disabled={currentZoom >= maxZoom}
          className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Zoom In
        </button>
      </div>
    </div>
  );
}
