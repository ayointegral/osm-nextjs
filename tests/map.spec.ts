import { test, expect } from '@playwright/test';

test.describe('OpenStreetMap Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage and wait for network idle
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('should load the map correctly', async ({ page }) => {
    // Wait for the map container to be present and visible
    const map = page.locator('#map');
    await expect(map).toBeVisible({ timeout: 30000 });

    // Wait for Leaflet container to be ready
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible({ timeout: 30000 });

    // Wait for at least one tile to be loaded
    const mapTile = page.locator('.leaflet-tile-loaded').first();
    await expect(mapTile).toBeVisible({ timeout: 30000 });

    // Take a screenshot
    await page.screenshot({
      path: 'test-results/map-loaded.png',
      fullPage: true
    });
  });

  test('should be interactive', async ({ page }) => {
    // Wait for map controls to be visible
    const zoomControl = page.locator('.leaflet-control-zoom');
    await expect(zoomControl).toBeVisible({ timeout: 30000 });

    // Get zoom controls
    const zoomInButton = page.locator('.leaflet-control-zoom-in');
    const zoomOutButton = page.locator('.leaflet-control-zoom-out');

    // Test zoom in
    await zoomInButton.click();
    await page.waitForTimeout(1500); // Wait for zoom animation

    // Test zoom out
    await zoomOutButton.click();
    await page.waitForTimeout(1500); // Wait for zoom animation

    // Take a screenshot
    await page.screenshot({
      path: 'test-results/map-interaction.png',
      fullPage: true
    });
  });
});
