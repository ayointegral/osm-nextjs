import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // For now, we'll use a default user ID since we haven't implemented auth yet
    const defaultUserId = 'default-user';
    
    const settings = await prisma.settings.findUnique({
      where: { userId: defaultUserId },
    });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = await prisma.user.create({
        data: {
          id: defaultUserId,
          email: 'default@example.com',
          settings: {
            create: {
              defaultProvider: 'osm',
              defaultZoom: 13,
              defaultCenter: { lat: 51.505, lng: -0.09 }, // London
            },
          },
        },
        include: {
          settings: true,
        },
      });

      return NextResponse.json(defaultSettings.settings);
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Ensure request has content
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 });
    }

    // Clone the request before reading the body
    const clonedRequest = request.clone();
    let body;
    try {
      body = await clonedRequest.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Validate required fields
    const { defaultProvider, defaultZoom, defaultCenter } = body;
    if (!defaultProvider || typeof defaultZoom !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate defaultCenter structure
    if (!defaultCenter || 
        typeof defaultCenter !== 'object' || 
        typeof defaultCenter.lat !== 'number' || 
        typeof defaultCenter.lng !== 'number') {
      return NextResponse.json({ error: 'Invalid defaultCenter format' }, { status: 400 });
    }

    const defaultUserId = 'default-user';

    // First ensure user exists
    await prisma.user.upsert({
      where: { id: defaultUserId },
      update: {},
      create: {
        id: defaultUserId,
        email: 'default@example.com',
      },
    });

    // Then update or create settings
    const settings = await prisma.settings.upsert({
      where: { userId: defaultUserId },
      update: {
        defaultProvider,
        defaultZoom,
        defaultCenter,
      },
      create: {
        userId: defaultUserId,
        defaultProvider,
        defaultZoom,
        defaultCenter,
      },
    });

    return new Response(JSON.stringify(settings), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
