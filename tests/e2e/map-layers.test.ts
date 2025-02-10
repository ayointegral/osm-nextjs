import { test, expect } from '@playwright/test';

interface TileElement extends HTMLElement {
  classList: DOMTokenList;
}

interface TileInfo {
  el: TileElement;
}

interface TileLayer extends L.Layer {
  _tiles?: Record<string, TileInfo>;
}

test.describe('Map Layer Tests', () => {
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

  test('should test each layer at different zoom levels', async ({ page }) => {
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

      // Test a range of zoom levels including high zooms
      const zoomLevels = [8, 12, 15, 18, 19, 20];
      const layers = ['OpenStreetMap', 'CyclOSM', 'Humanitarian', 'Terrain'];
      const results: Record<string, Record<number, { visibleTiles: number; hasErrors: boolean }>> = {};

      for (const layer of layers) {
        console.log(`Testing ${layer} layer...`);
        
        // Switch to layer
        await page.evaluate(() => {
          const toggle = document.querySelector('.leaflet-control-layers-toggle');
          if (toggle instanceof HTMLElement) {
            toggle.click();
          }
        });
        await page.waitForSelector('.leaflet-control-layers-list', {
          state: 'visible',
          timeout: 30000
        });

        await page.evaluate((layerName) => {
          const labels = Array.from(document.querySelectorAll('.leaflet-control-layers-base label'));
          const layerLabel = labels.find(label => label.textContent?.includes(layerName));
          const input = layerLabel?.querySelector('input');
          if (input instanceof HTMLElement) {
            input.click();
          }
        }, layer);

        await page.waitForTimeout(2000); // Wait for layer to load

        for (const zoom of zoomLevels) {
          console.log(`Testing ${layer} at zoom ${zoom}...`);
          
          // Clear existing tiles
          await page.evaluate(() => {
            const map = window.map;
            map.eachLayer((layer: TileLayer) => {
              if (layer._tiles) {
                for (const key in layer._tiles) {
                  delete layer._tiles[key];
                }
              }
            });
          });
          
          await page.evaluate((z) => {
            const map = window.map;
            map.setZoom(z);
          }, zoom);
          await page.waitForTimeout(1000);

          // Check if layer loaded successfully
          const layerStatus = await page.evaluate((layerName) => {
            const map = window.map;
            let hasErrors = false;
            let visibleTiles = 0;

            map.eachLayer((layer: TileLayer) => {
              if (layer._tiles) {
                for (const tile of Object.values(layer._tiles)) {
                  if (tile.el.classList.contains('leaflet-tile-loaded')) {
                    visibleTiles++;
                  }
                  if (tile.el.classList.contains('leaflet-tile-error')) {
                    hasErrors = true;
                  }
                }
              }
            });

            return { layerName, hasErrors, visibleTiles };
          }, layer);

          // Store results
          if (!results[layer]) {
            results[layer] = {};
          }
          results[layer][zoom] = {
            visibleTiles: layerStatus.visibleTiles,
            hasErrors: layerStatus.hasErrors
          };

          // For native zoom levels (≤19), expect no errors and good tile coverage
          if (zoom <= 19) {
            expect(layerStatus.hasErrors, `${layer} has errors at native zoom ${zoom}`).toBe(false);
            expect(layerStatus.visibleTiles, `${layer} has insufficient tiles at zoom ${zoom}`).toBeGreaterThan(4);
          }
          
          // For high zoom (20), expect scaled tiles to be present
          if (zoom === 20) {
            expect(layerStatus.visibleTiles, `${layer} failed to scale tiles at zoom ${zoom}`).toBeGreaterThan(0);
          }
        }
      }

      // Log analysis of each layer's performance
      console.log('\nLayer Performance Analysis:');
      for (const layer in results) {
        console.log(`\n${layer}:`);
        const layerResults = results[layer];
        console.log('Native zoom levels (≤19):');
        Object.entries(layerResults)
          .filter(([zoom]) => parseInt(zoom) <= 19)
          .forEach(([zoom, status]) => {
            console.log(`  Zoom ${zoom}: ${status.visibleTiles} tiles, ${status.hasErrors ? 'has errors' : 'no errors'}`);
          });
        
        console.log('High zoom levels (20):');
        const highZoom = layerResults[20];
        if (highZoom) {
          console.log(`  Zoom 20: ${highZoom.visibleTiles} tiles, ${highZoom.hasErrors ? 'has errors' : 'no errors'}`);
          console.log(`  Quality: ${highZoom.visibleTiles > 4 ? 'Good' : 'Poor'} scaling`);
        }
      }

    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ path: `layer-test-failure-${Date.now()}.png`, fullPage: true });
      throw error;
    }
  });
});
