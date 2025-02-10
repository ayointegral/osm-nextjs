import { test, expect } from '@playwright/test';

interface MapCenter {
  lat: number;
  lng: number;
}

interface PanOffset {
  lat: number;
  lng: number;
}

test.describe('Map Navigation Tests', () => {
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

  test('should handle map panning in all directions', async ({ page }) => {
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

      // Get initial center
      const initialCenter: MapCenter = await page.evaluate(() => {
        const map = window.map;
        const center = map.getCenter();
        return { lat: center.lat, lng: center.lng };
      });
      console.log('Initial center:', initialCenter);

      // Pan the map in different directions
      const panDirections: PanOffset[] = [
        { lat: 0.1, lng: 0.1 },   // Northeast
        { lat: -0.1, lng: 0.1 },  // Southeast
        { lat: -0.1, lng: -0.1 }, // Southwest
        { lat: 0.1, lng: -0.1 },  // Northwest
      ];

      for (const offset of panDirections) {
        console.log(`Panning map by offset:`, offset);
        
        await page.evaluate((off: PanOffset) => {
          const map = window.map;
          const center = map.getCenter();
          map.panTo([center.lat + off.lat, center.lng + off.lng]);
        }, offset);
        
        await page.waitForTimeout(1000); // Wait for pan animation

        // Verify map responded to pan
        const newCenter: MapCenter = await page.evaluate(() => {
          const map = window.map;
          const center = map.getCenter();
          return { lat: center.lat, lng: center.lng };
        });
        console.log('New center:', newCenter);

        // Verify the map moved in the correct direction
        if (offset.lat > 0) {
          expect(newCenter.lat).toBeGreaterThan(initialCenter.lat);
        } else if (offset.lat < 0) {
          expect(newCenter.lat).toBeLessThan(initialCenter.lat);
        }

        if (offset.lng > 0) {
          expect(newCenter.lng).toBeGreaterThan(initialCenter.lng);
        } else if (offset.lng < 0) {
          expect(newCenter.lng).toBeLessThan(initialCenter.lng);
        }
      }

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: `navigation-test-failure-${Date.now()}.png`, fullPage: true });
      throw error;
    }
  });
});
