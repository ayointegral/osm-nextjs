import { render, act, waitFor } from '@testing-library/react';
import { Map } from '../Map';
import { useMap } from 'react-leaflet';

jest.mock('react-leaflet', () => ({
  ...jest.requireActual('react-leaflet'),
  useMap: jest.fn(),
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  ZoomControl: () => null,
  LayersControl: {
    BaseLayer: () => null,
  },
  ScaleControl: () => null,
}));

describe('Map Integration Tests', () => {
  const mockMap = {
    on: jest.fn(),
    off: jest.fn(),
    getZoom: jest.fn(() => 13),
    getCenter: jest.fn(() => ({ lat: 51.505, lng: -0.09 })),
    setView: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useMap as jest.Mock).mockReturnValue(mockMap);
    global.fetch = jest.fn();
  });

  describe('API Integration', () => {
    it('should handle successful settings load', async () => {
      const mockSettings = {
        defaultProvider: 'osm',
        defaultZoom: 15,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSettings),
      });

      render(<Map />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/settings');
      });
    });

    it('should handle failed settings load', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to load settings' }),
      });

      render(<Map />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<Map />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Map Events', () => {
    it('should handle zoom events', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      render(<Map />);

      await act(async () => {
        const zoomHandler = mockMap.on.mock.calls.find(call => call[0] === 'zoomend')[1];
        zoomHandler();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle move events', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      render(<Map />);

      await act(async () => {
        const moveHandler = mockMap.on.mock.calls.find(call => call[0] === 'moveend')[1];
        moveHandler();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      render(<Map />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle API errors with error messages', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Custom error message' }),
      });

      render(<Map />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
