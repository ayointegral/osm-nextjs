import { test, expect } from '@playwright/test';

test.describe('Tile Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tile-viewer');
    // Wait for the map to be initialized
    await page.waitForSelector('#map');
    // Wait for initial tiles to load
    await page.waitForTimeout(2000);
  });

  test('should load the tile viewer page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'OSM Tile Viewer' })).toBeVisible();
  });

  test('should display the map container', async ({ page }) => {
    await expect(page.locator('#map')).toBeVisible();
    // Verify Leaflet is initialized
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('should show tile provider options', async ({ page }) => {
    // Get all provider buttons
    const providerButtons = await page.locator('button').all();
    const buttonTexts = await Promise.all(
      providerButtons.map(button => button.textContent())
    );

    // Verify each provider is present exactly once
    const expectedProviders = ['Local OpenStreetMap', 'OpenStreetMap', 'CyclOSM', 'Humanitarian', 'Terrain'];
    for (const provider of expectedProviders) {
      const matches = buttonTexts.filter(text => text === provider);
      expect(matches.length, `Provider ${provider} should appear exactly once`).toBe(1);
    }
  });

  test('should switch between tile providers', async ({ page }) => {
    const providers = ['Local OpenStreetMap', 'OpenStreetMap', 'CyclOSM'];
    
    for (const provider of providers) {
      // Set up request interception before clicking
      let tileRequestCount = 0;
      
      // Handle both local and external tile requests
      const patterns = provider === 'Local OpenStreetMap' 
        ? ['**/api/osm/**']
        : ['**/*.png'];
      
      for (const pattern of patterns) {
        await page.route(pattern, async (route) => {
          const url = route.request().url();
          if (url.includes('/tile.') || url.includes('/api/osm/')) {
            tileRequestCount++;
          }
          await route.continue();
        });
      }

      // Use exact text matching to avoid ambiguity
      const button = await page.locator('button', { hasText: provider, exact: true }).first();
      await button.click();

      // Wait for tile requests
      await page.waitForTimeout(2000);
      
      // Verify that tile requests were made
      expect(tileRequestCount, `No tile requests made after switching to ${provider}`).toBeGreaterThan(0);
      
      // Verify the button is now selected (has the correct class)
      const buttonClasses = await button.getAttribute('class');
      expect(buttonClasses).toContain('bg-blue-500');
      
      // Clear route handlers before next iteration
      await page.unroute('**');
    }
  });

  test('should make tile requests when zooming', async ({ page }) => {
    // Set up request interception
    let tileRequestCount = 0;
    await page.route('**/api/osm/**', async (route) => {
      tileRequestCount++;
      await route.continue();
    });

    // Click the zoom in button
    await page.locator('.leaflet-control-zoom-in').click();
    
    // Wait for tile requests
    await page.waitForTimeout(2000);
    
    // Verify that tile requests were made
    expect(tileRequestCount).toBeGreaterThan(0);
  });

  test('should handle tile loading errors gracefully', async ({ page }) => {
    // Test both 400 and 500 status codes
    const response = await page.request.get('/api/osm/invalid/x/y.png');
    expect([400, 500]).toContain(response.status());
  });

  test('should maintain map state when switching providers', async ({ page }) => {
    // Store initial viewport state
    const getViewport = async () => {
      return page.evaluate(() => {
        const container = document.querySelector('.leaflet-container') as HTMLElement;
        if (!container) return null;
        const style = window.getComputedStyle(container);
        return {
          width: style.width,
          height: style.height,
          visibility: style.visibility
        };
      });
    };

    const initialViewport = await getViewport();
    
    // Click the OpenStreetMap button (using exact match)
    const osmButton = await page.locator('button', { hasText: 'OpenStreetMap', exact: true }).first();
    await osmButton.click();
    await page.waitForTimeout(1000);

    const newViewport = await getViewport();
    
    // Compare viewport states
    expect(newViewport).toEqual(initialViewport);
  });
});

