import { getSubtiles } from '@/utils/tile-utils';

interface TileOverlayProps {
  z: number;
  x: number;
  y: number;
}

export default function TileOverlay({ z, x, y }: TileOverlayProps) {
  const subtiles = getSubtiles(x, y, z);

  return (
    <div className="relative w-full aspect-square overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-blue-500/30 relative"
            style={{
              gridColumn: (i % 2) + 1,
              gridRow: Math.floor(i / 2) + 1,
            }}
          >
            <div className="
              absolute inset-0 flex items-center justify-center
              text-sm font-medium
              text-blue-700
            ">
              <span className="px-2 py-1 rounded bg-white/80">
                {subtiles[i].z}/{subtiles[i].x}/{subtiles[i].y}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
