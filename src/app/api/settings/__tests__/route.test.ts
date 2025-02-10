import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  },
}));

describe('Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return existing settings', async () => {
      const mockSettings = {
        id: '1',
        userId: 'default-user',
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      };

      (prisma.settings.findUnique as jest.Mock).mockResolvedValueOnce(mockSettings);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSettings);
    });

    it('should create default settings if none exist', async () => {
      const mockDefaultSettings = {
        settings: {
          id: '1',
          userId: 'default-user',
          defaultProvider: 'osm',
          defaultZoom: 13,
          defaultCenter: { lat: 51.505, lng: -0.09 },
        },
      };

      (prisma.settings.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.user.create as jest.Mock).mockResolvedValueOnce(mockDefaultSettings);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockDefaultSettings.settings);
    });
  });

  describe('POST', () => {
    it('should update settings successfully', async () => {
      const mockSettings = {
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      };

      const mockResponse = {
        id: '1',
        userId: 'default-user',
        ...mockSettings,
      };

      (prisma.settings.upsert as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockSettings),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: { userId: 'default-user' },
        update: mockSettings,
        create: expect.objectContaining({
          userId: 'default-user',
          ...mockSettings,
        }),
      });
    });

    it('should handle errors gracefully', async () => {
      const mockSettings = {
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      };

      (prisma.settings.upsert as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockSettings),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to update settings' });
    });
  });
});
