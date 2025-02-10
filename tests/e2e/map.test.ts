import { test, expect } from '@playwright/test';
import type { Request } from '@playwright/test';

interface MapLayerOptions extends L.LayerOptions {
  name?: string;
}

interface MapLayer extends L.Layer {
  options: MapLayerOptions;
}

test.describe('Map Component', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('/api/settings', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            defaultProvider: 'osm',
            defaultZoom: 13,
            defaultCenter: { lat: 51.505, lng: -0.09 },
          }),
        });
      } else if (method === 'POST') {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/');
    // Wait for map to be visible
    await page.waitForSelector('.leaflet-container');
  });

  test('should load map with correct initial state', async ({ page }) => {
    // Check if map container is visible
    await expect(page.locator('.leaflet-container')).toBeVisible();
    
    // Check if zoom controls are visible
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
    
    // Check if layer control is visible
    await expect(page.locator('.leaflet-control-layers')).toBeVisible();
  });

  test('should handle basic zoom levels', async ({ page }) => {
    // Enable request/response logging
    page.on('request', request => {
      console.log(`>> ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('Request data:', request.postData());
      }
    });
    page.on('response', response => {
      console.log(`<< ${response.status()} ${response.url()}`);
      response.text().then(text => {
        if (text) console.log('Response:', text);
      }).catch(error => console.error('Error processing response:', error));
    });

    try {
      // Wait for map to be fully loaded and interactive
      await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 30000 });
      await page.waitForSelector('.leaflet-control-zoom', { state: 'visible', timeout: 30000 });
      
      // Wait for map to be initialized
      // Wait for map initialization
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (window.map && typeof window.map.getZoom === 'function') {
            resolve();
          } else {
            window.addEventListener('map-initialized', () => resolve(), { once: true });
          }
        });
      });

      // Get initial state
      const initialState = await page.evaluate(() => {
        const map = window.map;
        return {
          zoom: map.getZoom(),
          center: map.getCenter(),
          bounds: map.getBounds(),
        };
      });
      console.log('Initial state:', initialState);

      // Test zoom levels
      console.log('Testing zoom levels...');
      const zoomLevels = [15, 12, 8];
      
      for (const zoom of zoomLevels) {
        console.log(`Setting zoom to ${zoom}...`);
        
        // Use zoom controls instead of direct API call
        const zoomInButton = page.locator('.leaflet-control-zoom-in');
        const currentZoom = await page.evaluate(() => {
          return window.map.getZoom();
        });
        
        const clicksNeeded = Math.abs(zoom - currentZoom);
        const button = zoom > currentZoom ? zoomInButton : page.locator('.leaflet-control-zoom-out');
        
        for (let i = 0; i < clicksNeeded; i++) {
          await button.click();
          // Wait for zoom animation and tile loading
          await page.waitForFunction(
            (expectedZoom) => {
              const map = window.map;
              return map.getZoom() === expectedZoom;
            },
            zoom,
            { timeout: 10000 }
          );
          await page.waitForLoadState('networkidle');
        }

        // Add tile loading verification
        await page.waitForFunction(
          () => {
            const tiles = document.querySelectorAll('.leaflet-tile-loaded');
            return tiles.length > 5; // Ensure minimum tiles loaded
          },
          { timeout: 15000 }
        );

        // Add visual validation
        await expect(page.locator('.leaflet-container')).toHaveScreenshot(`zoom-${zoom}.png`, {
          threshold: 0.1,
          maxDiffPixels: 100
        });

        // Final verification
        const actualZoom = await page.evaluate(() => {
          return window.map.getZoom();
        });
        console.log('Verified zoom:', actualZoom);
        expect(actualZoom).toBe(zoom);
      }

      // Return to initial state
      console.log('Returning to initial state...');
      await page.evaluate((state) => {
        const map = window.map;
        map.setView([state.center.lat, state.center.lng], state.zoom);
      }, initialState);

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: 'map-interaction-failure.png', fullPage: true });
      throw error;
    }
  });

  test('should handle layer changes', async ({ page }) => {
    // Enable request/response logging
    page.on('request', request => {
      console.log(`>> ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('Request data:', request.postData());
      }
    });
    page.on('response', response => {
      console.log(`<< ${response.status()} ${response.url()}`);
      response.text().then(text => {
        if (text) console.log('Response:', text);
      }).catch(() => {});
    });

    try {
      // Wait for map to be fully loaded and interactive
      await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 30000 });
      await page.waitForSelector('.leaflet-control-layers', { state: 'visible', timeout: 30000 });
      
      // Wait for map to be fully initialized
      // Wait for map initialization
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (window.map && typeof window.map.getZoom === 'function') {
            resolve();
          } else {
            window.addEventListener('map-initialized', () => resolve(), { once: true });
          }
        });
      });

      // Track API calls
      const apiCalls: Request[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/settings') && request.method() === 'POST') {
          apiCalls.push(request);
        }
      });

      // Ensure layer control is in initial state
      const isExpanded = await page.evaluate(() => {
        const control = document.querySelector('.leaflet-control-layers');
        return control?.classList.contains('leaflet-control-layers-expanded');
      });

      if (isExpanded) {
        console.log('Layer control is expanded, clicking to collapse...');
        await page.evaluate(() => {
          const toggle = document.querySelector('.leaflet-control-layers-toggle');
          (toggle as HTMLElement)?.click();
        });
        await page.waitForTimeout(1000);
      }

      console.log('Clicking layer control toggle...');
      await page.evaluate(() => {
        const toggle = document.querySelector('.leaflet-control-layers-toggle');
        (toggle as HTMLElement)?.click();
      });

      // Wait for the layer list to be visible
      await page.waitForSelector('.leaflet-control-layers-list', {
        state: 'visible',
        timeout: 30000
      });

      console.log('Clicking satellite layer...');
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.leaflet-control-layers-base label'));
        const satelliteLabel = labels.find(label => label.textContent?.includes('Satellite'));
        const input = satelliteLabel?.querySelector('input');
        (input as HTMLElement)?.click();
      });

      // Wait for API call
      await expect.poll(
        () => apiCalls.length,
        {
          message: 'Waiting for settings API call',
          timeout: 10000
        }
      ).toBeGreaterThan(0);

      // Verify provider was updated
      const postData = apiCalls[0].postData();
      if (postData) {
        const requestBody = JSON.parse(postData);
        expect(requestBody.defaultProvider).toBe('satellite');
      }

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: 'test-failure.png', fullPage: true });
      throw error;
    }
  });

  test('should persist settings across page reloads', async ({ page }) => {
    // Enable request/response logging
    page.on('request', request => {
      console.log(`>> ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('Request data:', request.postData());
      }
    });
    page.on('response', response => {
      console.log(`<< ${response.status()} ${response.url()}`);
      response.text().then(text => {
        if (text) console.log('Response:', text);
      }).catch(() => {});
    });

    try {
      // Wait for map to be fully loaded and interactive
      await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 30000 });
      await page.waitForSelector('.leaflet-control-layers', { state: 'visible', timeout: 30000 });
      
      // Wait for map to be fully initialized
      // Wait for map initialization
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (window.map && typeof window.map.getZoom === 'function') {
            resolve();
          } else {
            window.addEventListener('map-initialized', () => resolve(), { once: true });
          }
        });
      });

      // Get initial zoom level
      const initialZoom = await page.evaluate(() => window.map.getZoom());
      console.log('Initial zoom level:', initialZoom);

      // Change zoom level using evaluate to ensure direct map interaction
      console.log('Changing zoom level...');
      await page.evaluate(() => {
        const map = window.map;
        map.setZoom(map.getZoom() + 1);
      });
      await page.waitForTimeout(1000);

      // Ensure layer control is in initial state
      const isExpanded = await page.evaluate(() => {
        const control = document.querySelector('.leaflet-control-layers');
        return control?.classList.contains('leaflet-control-layers-expanded');
      });

      if (isExpanded) {
        console.log('Layer control is expanded, clicking to collapse...');
        await page.evaluate(() => {
          const toggle = document.querySelector('.leaflet-control-layers-toggle');
          (toggle as HTMLElement)?.click();
        });
        await page.waitForTimeout(1000);
      }

      // Change layer using evaluate
      console.log('Changing layer to satellite...');
      await page.evaluate(() => {
        const toggle = document.querySelector('.leaflet-control-layers-toggle');
        (toggle as HTMLElement)?.click();
      });

      await page.waitForSelector('.leaflet-control-layers-list', {
        state: 'visible',
        timeout: 30000
      });

      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.leaflet-control-layers-base label'));
        const satelliteLabel = labels.find(label => label.textContent?.includes('Satellite'));
        const input = satelliteLabel?.querySelector('input');
        (input as HTMLElement)?.click();
      });

      // Wait for settings to be saved
      await page.waitForTimeout(2000);

      console.log('Reloading page...');
      await page.reload();

      // Wait for map to be fully loaded and interactive again
      await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 30000 });
      // Wait for map initialization
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if (window.map && typeof window.map.getZoom === 'function') {
            resolve();
          } else {
            window.addEventListener('map-initialized', () => resolve(), { once: true });
          }
        });
      });

      // Verify zoom level
      const finalZoom = await page.evaluate(() => window.map.getZoom());
      console.log('Final zoom level:', finalZoom);
      expect(finalZoom).toBe(initialZoom + 1);

      // Verify layer selection
      const finalLayer = await page.evaluate(() => {
        const map = window.map;
        const activeLayers: string[] = [];
        map.eachLayer((layer: MapLayer) => {
          if (layer.options?.name) {
            activeLayers.push(layer.options.name.toLowerCase());
          }
        });
        return activeLayers;
      });
      console.log('Active layers:', finalLayer);
      expect(finalLayer).toContain('satellite');

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: 'persistence-test-failure.png', fullPage: true });
      throw error;
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Enable request/response logging
    page.on('request', request => {
      console.log(`>> ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('Request data:', request.postData());
      }
    });
    page.on('response', response => {
      console.log(`<< ${response.status()} ${response.url()}`);
      response.text().then(text => {
        if (text) console.log('Response:', text);
      }).catch(() => {});
    });

    try {
      // Wait for map to be fully loaded
      await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 30000 });
      await page.waitForSelector('.leaflet-control-zoom', { state: 'visible', timeout: 30000 });
      
      // Wait for map to be initialized
      await page.waitForFunction(() => {
        const map = window.map;
        return typeof map?.getZoom === 'function';
      }, { timeout: 45000 });

      // Mock API error for settings updates
      await page.route('/api/settings', async route => {
        const method = route.request().method();
        if (method === 'POST') {
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        }
      });

      // Try to zoom in using evaluate
      console.log('Attempting to zoom in...');
      await page.evaluate(() => {
        const map = window.map;
        map.setZoom(map.getZoom() + 1);
      });

      // Wait a bit to ensure error is handled
      await page.waitForTimeout(1000);

      // Verify map is still usable
      const isMapUsable = await page.evaluate(() => {
        const map = window.map;
        return map && map.getZoom() !== undefined && map.getCenter() !== undefined;
      });
      expect(isMapUsable).toBe(true);

      // Verify controls are still visible and interactive
      await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
      await expect(page.locator('.leaflet-control-layers')).toBeVisible();

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: 'error-handling-test-failure.png', fullPage: true });
      throw error;
    }
  });
});
