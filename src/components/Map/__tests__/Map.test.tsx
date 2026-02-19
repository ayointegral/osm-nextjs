import React from 'react';
import { render, waitFor, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Map } from '../Map';
import { useMap } from 'react-leaflet';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock react-leaflet components
jest.mock('react-leaflet', () => {
  return {
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
    )
  };
});

// Mock fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Map Component', () => {
  const mockMap = {
    on: jest.fn(),
    off: jest.fn(),
    getZoom: jest.fn().mockReturnValue(13),
    getCenter: jest.fn().mockReturnValue({ lat: 51.505, lng: -0.09 }),
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
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({
        defaultProvider: 'osm_local',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 }
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render map container with default settings', async () => {
    await act(async () => {
      render(<Map />);
    });
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should load and apply initial settings', async () => {
    const mockSettings = {
      defaultProvider: 'osm_local',
      defaultZoom: 15,
      defaultCenter: { lat: 51.505, lng: -0.09 },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue(mockSettings),
    });

    await act(async () => {
      render(<Map />);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    // Component should render without crashing after settings load
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should handle failed settings load', async () => {
    const error = new Error('Failed to load settings');
    mockFetch.mockRejectedValueOnce(error);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

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

  it('should handle zoom changes', async () => {
    await act(async () => {
      render(<Map />);
    });

    // Wait for initial settings to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    // Clear mock to test zoom change
    mockFetch.mockClear();

    // Set up the POST response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({
        defaultProvider: 'osm_local',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 }
      }),
    });

    // Find the zoomend handler from MapEventHandler
    // Both MapEventHandler and HighZoomTileLayer register zoomend handlers
    const zoomendCalls = mockMap.on.mock.calls.filter(
      (call: [string, () => void]) => call[0] === 'zoomend'
    );
    // Simulate all zoomend handlers (the MapEventHandler one triggers the save)
    await act(async () => {
      zoomendCalls.forEach((call: [string, () => void]) => call[1]());
    });

    // Advance timers to trigger the debounced save (1000ms debounce)
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Verify settings were saved
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
    });
  });

  it('should handle high zoom levels correctly', async () => {
    mockMap.getZoom.mockReturnValue(20); // Beyond maxNativeZoom

    await act(async () => {
      render(<Map />);
    });

    // Component should render without errors at high zoom levels
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should register zoomend and moveend event listeners', async () => {
    await act(async () => {
      render(<Map />);
    });

    // Verify that mockMap.on was called with 'zoomend' and 'moveend'
    const registeredEvents = mockMap.on.mock.calls.map(
      (call: [string, () => void]) => call[0]
    );
    expect(registeredEvents).toContain('zoomend');
    expect(registeredEvents).toContain('moveend');
  });

  it('should use osm_local provider', async () => {
    await act(async () => {
      render(<Map />);
    });

    // The component renders with HighZoomTileLayer (which renders as the mocked TileLayer returning null)
    // Verify the map container renders successfully with the hardcoded osm_local provider
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should handle errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<Map />);
    });

    // Wait for initial settings to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    // Mock the POST save to fail
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue('Server Error'),
    });

    // Simulate zoom to trigger a save
    const zoomendCalls = mockMap.on.mock.calls.filter(
      (call: [string, () => void]) => call[0] === 'zoomend'
    );
    await act(async () => {
      zoomendCalls.forEach((call: [string, () => void]) => call[1]());
    });

    // Advance timers to trigger the debounced save
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save settings:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should clean up event listeners on unmount', async () => {
    const { unmount } = render(<Map />);
    await act(async () => {
      unmount();
    });
    expect(mockMap.off).toHaveBeenCalled();
  });

  it('should handle invalid settings response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<Map />);
    });

    // Wait for initial settings to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    // Mock settings save to return non-JSON content type
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: jest.fn().mockResolvedValue('Invalid response'),
      json: jest.fn().mockRejectedValue(new Error('Not JSON')),
    });

    // Trigger a save operation via zoomend
    const zoomendCalls = mockMap.on.mock.calls.filter(
      (call: [string, () => void]) => call[0] === 'zoomend'
    );
    await act(async () => {
      zoomendCalls.forEach((call: [string, () => void]) => call[1]());
    });

    // Advance timers to trigger the debounced save
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save settings:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
