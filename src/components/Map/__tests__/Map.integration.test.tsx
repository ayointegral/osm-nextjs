import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { Map } from '../Map';
import { useMap } from 'react-leaflet';

// Mock react-leaflet with full component mocks (no requireActual)
jest.mock('react-leaflet', () => ({
  useMap: jest.fn(),
  MapContainer: Object.assign(
    function({ children }: { children: React.ReactNode }): React.ReactElement {
      return <div data-testid="map-container">{children}</div>;
    },
    { displayName: 'MapContainer' }
  ),
  TileLayer: Object.assign(
    function() { return null; },
    { displayName: 'TileLayer' }
  ),
  ZoomControl: Object.assign(
    function() { return null; },
    { displayName: 'ZoomControl' }
  ),
  ScaleControl: Object.assign(
    function() { return null; },
    { displayName: 'ScaleControl' }
  ),
}));

describe('Map Integration Tests', () => {
  const mockMap = {
    on: jest.fn(),
    off: jest.fn(),
    getZoom: jest.fn(() => 13),
    getCenter: jest.fn(() => ({ lat: 51.505, lng: -0.09 })),
    setView: jest.fn(),
    getBounds: jest.fn().mockReturnValue({
      getNorthWest: () => ({ lat: 51.6, lng: -0.2 }),
      getSouthEast: () => ({ lat: 51.4, lng: 0.0 }),
    }),
    project: jest.fn().mockReturnValue({ x: 100, y: 100 }),
    getContainer: jest.fn().mockReturnValue({ style: {} }),
    getPanes: jest.fn().mockReturnValue({
      tilePane: { style: {} },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useMap as jest.Mock).mockReturnValue(mockMap);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({
        defaultProvider: 'osm_local',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockSettings),
      });

      await act(async () => {
        render(<Map />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/settings');
      });
    });

    it('should handle failed settings load', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ error: 'Failed to load settings' }),
      });

      await act(async () => {
        render(<Map />);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load settings, using defaults'
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<Map />);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading settings, using defaults:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Map Events', () => {
    it('should handle zoom events', async () => {
      await act(async () => {
        render(<Map />);
      });

      // Wait for initial settings load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/settings');
      });

      // Clear fetch mock to isolate the POST call
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          defaultProvider: 'osm_local',
          defaultZoom: 13,
          defaultCenter: { lat: 51.505, lng: -0.09 },
        }),
      });

      // Invoke all zoomend handlers (MapEventHandler + HighZoomTileLayer both register)
      const zoomendCalls = mockMap.on.mock.calls.filter(
        (call: [string, () => void]) => call[0] === 'zoomend'
      );
      await act(async () => {
        zoomendCalls.forEach((call: [string, () => void]) => call[1]());
      });

      // Advance timers past the 1000ms debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/settings',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should handle move events', async () => {
      await act(async () => {
        render(<Map />);
      });

      // Wait for initial settings load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/settings');
      });

      // Clear fetch mock to isolate the POST call
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          defaultProvider: 'osm_local',
          defaultZoom: 13,
          defaultCenter: { lat: 51.505, lng: -0.09 },
        }),
      });

      // Invoke all moveend handlers (MapEventHandler + HighZoomTileLayer both register)
      const moveendCalls = mockMap.on.mock.calls.filter(
        (call: [string, () => void]) => call[0] === 'moveend'
      );
      await act(async () => {
        moveendCalls.forEach((call: [string, () => void]) => call[1]());
      });

      // Advance timers past the 1000ms debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/settings',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await act(async () => {
        render(<Map />);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading settings, using defaults:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle API errors with error messages', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ error: 'Custom error message' }),
      });

      await act(async () => {
        render(<Map />);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load settings, using defaults'
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
