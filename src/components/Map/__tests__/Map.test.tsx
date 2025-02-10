import React from 'react';
import { render, waitFor, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MatcherFunction } from '@testing-library/react';
import { Map } from '../Map';
import { useMap } from 'react-leaflet';
import { tileProviders } from '@/utils/tile-utils';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock react-leaflet components
// Mock react-leaflet components
jest.mock('react-leaflet', () => {
  const LayersControl = Object.assign(
    function({ children, position }: { children: React.ReactNode, position: string }): React.ReactElement {
      return <div data-testid="layers-control" data-position={position}>{children}</div>;
    },
    {
      displayName: 'LayersControl',
      BaseLayer: Object.assign(
        function({ children }: { children: React.ReactNode }): React.ReactElement {
          return <div data-testid="base-layer">{children}</div>;
        },
        { displayName: 'LayersControl.BaseLayer' }
      )
    }
  );

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
    LayersControl,
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
    (useMap as jest.Mock).mockReturnValue(mockMap);
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 }
      }),
    });
  });

  it('should render map container with default settings', async () => {
    await act(async () => {
      render(<Map />);
    });
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should load and apply initial settings', async () => {
    const mockSettings = {
      defaultProvider: 'osm',
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
      expect(screen.getByText(`Zoom: ${mockSettings.defaultZoom}`)).toBeInTheDocument();
    });
  });

  it('should handle failed settings load', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to load settings'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(<Map />);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading settings:', expect.any(Error));
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

    // Simulate zoom event
    await act(async () => {
      const zoomHandler = mockMap.on.mock.calls.find(call => call[0] === 'zoomend')[1];
      zoomHandler();
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

    await waitFor(() => {
      // Find the zoom text that might be split across elements
      const zoomText = screen.getByText(((content, element) => {
        return element?.tagName.toLowerCase() === 'span' && content.includes('Zoom:');
      }) as MatcherFunction);
      expect(zoomText.nextSibling?.textContent?.trim()).toBe('20');
    });
    
    // Verify tile pane styles
    const tilePane = mockMap.getPanes().tilePane;
    expect(tilePane.style.imageRendering).toBe('pixelated');
    expect(tilePane.style.transform).toMatch(/scale\(/);
  });

  it('should handle tile loading states', async () => {
    render(<Map />);

    await act(async () => {
      // Simulate tile loading
      const loadingHandler = mockMap.on.mock.calls.find(call => call[0] === 'tileloadstart')[1];
      loadingHandler();
    });

    expect(screen.getByText(/Loading tiles/i)).toBeInTheDocument();

    await act(async () => {
      // Simulate tile load complete
      const loadHandler = mockMap.on.mock.calls.find(call => call[0] === 'tileload')[1];
      loadHandler();
    });

    expect(screen.queryByText(/Loading tiles/i)).not.toBeInTheDocument();
  });

  it('should handle layer changes', async () => {
    await act(async () => {
      render(<Map />);
    });

    // Wait for initial settings
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    mockFetch.mockClear();

    // Simulate layer change
    await act(async () => {
      const layerChangeHandler = mockMap.on.mock.calls.find(call => call[0] === 'baselayerchange')[1];
      layerChangeHandler({ name: tileProviders.terrain.name });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"defaultProvider":"terrain"'),
      }));
    });
  });

  it('should handle errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    await act(async () => {
      render(<Map />);
    });

    // Simulate zoom to trigger error
    await act(async () => {
      const zoomHandler = mockMap.on.mock.calls.find(call => call[0] === 'zoomend')[1];
      zoomHandler();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
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

    // Mock initial settings load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 }
      })
    });

    await act(async () => {
      render(<Map />);
    });

    // Mock settings save to fail with invalid content type
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('Invalid response'),
      json: () => Promise.reject(new Error('Not JSON'))
    });

    // Trigger a save operation
    await act(async () => {
      const zoomHandler = mockMap.on.mock.calls.find(call => call[0] === 'zoomend')[1];
      zoomHandler();
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
