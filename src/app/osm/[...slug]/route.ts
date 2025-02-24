import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the URL parameters
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const [, ...slugParts] = pathParts; // Remove 'osm' from the path
  const [z, x, yWithExt] = slugParts;
  const y = yWithExt?.replace('.png', '');
  
  if (!z || !x || !y) {
    console.error('Missing parameters:', { z, x, y });
    return new NextResponse('Missing parameters', { status: 400 });
  }

  console.log('Fetching tile:', { z, x, y });
  
  // OSM tile server URL
  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const response = await fetch(tileUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch tile');
    }

    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error fetching tile:', error);
    return new NextResponse('Error fetching tile', { status: 500 });
  }
}
