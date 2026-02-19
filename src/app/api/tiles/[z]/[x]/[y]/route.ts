import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Dynamic route — must check filesystem on each request
export const dynamic = 'force-dynamic';

const TILES_DIR = path.join(process.cwd(), 'tiles');

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const params = await context.params;
  const z = parseInt(params.z);
  const x = parseInt(params.x);
  const y = parseInt(params.y);

  // Basic validation
  if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 19) {
    return new NextResponse(null, { status: 400 });
  }

  const tilePath = path.join(TILES_DIR, `${z}`, `${x}`, `${y}.png`);

  // Tier 1: Try local filesystem
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
    // File not found, fall through to CDN
  }

  // Tier 2: Fetch from OSM CDN
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'OSM-NextJS-Viewer/1.0' },
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const tileBuffer = Buffer.from(await response.arrayBuffer());

    // Cache to disk (fire and forget, don't block response)
    const dir = path.dirname(tilePath);
    fs.mkdir(dir, { recursive: true })
      .then(() => fs.writeFile(tilePath, tileBuffer))
      .catch(() => {}); // Silently fail if read-only mount

    return new NextResponse(tileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=7776000',
        'X-Tile-Source': 'osm-cdn',
      },
    });
  } catch {
    // CDN failed — return transparent 1x1 PNG
    const EMPTY_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    return new NextResponse(EMPTY_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'X-Tile-Source': 'fallback-empty',
      },
    });
  }
}
