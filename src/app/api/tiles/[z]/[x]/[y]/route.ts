import { NextResponse } from 'next/server';
import { isValidTile } from '@/utils/tile-utils';

export const dynamic = 'force-dynamic'; // Ensure dynamic route handling
export const revalidate = 86400; // Cache tiles for 24 hours

export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const params = await context.params;
  const { z, x, y } = params;
  
  // Validate tile coordinates
  if (!isValidTile(Number(x), Number(y), Number(z))) {
    return NextResponse.json(
      { error: 'Invalid tile coordinates' },
      { status: 400 }
    );
  }

  try {
    // Fetch tile from OSM with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'OSM Tile Viewer/1.0'
        }
      }
    );
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Tile fetch failed: ${response.statusText}`);
    }

    // Return the tile image
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600'
      }
    });
  } catch (error) {
    console.error('Tile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tile' },
      { status: 500 }
    );
  }
}
