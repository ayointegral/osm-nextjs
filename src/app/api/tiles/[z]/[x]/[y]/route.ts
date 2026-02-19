import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const TILES_DIR = path.join(process.cwd(), 'tiles');
const PLACEHOLDER_PATH = path.join(process.cwd(), 'public', 'tiles', 'placeholder.png');

// Transparent 1x1 PNG fallback (if placeholder file doesn't exist)
const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const params = await context.params;
  const z = parseInt(params.z);
  const x = parseInt(params.x);
  const y = parseInt(params.y);

  if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 19) {
    return new NextResponse(null, { status: 400 });
  }

  const tilePath = path.join(TILES_DIR, `${z}`, `${x}`, `${y}.png`);

  // Try local filesystem
  try {
    const tileData = await fs.readFile(tilePath);
    return new NextResponse(tileData, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Tile-Source': 'local-disk',
      },
    });
  } catch {
    // Tile not on disk — return placeholder (NO internet fallback)
  }

  // Return placeholder tile
  try {
    const placeholder = await fs.readFile(PLACEHOLDER_PATH);
    return new NextResponse(placeholder, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'X-Tile-Source': 'no-data',
      },
    });
  } catch {
    // Placeholder file doesn't exist, return empty PNG
    return new NextResponse(EMPTY_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'X-Tile-Source': 'no-data',
      },
    });
  }
}
