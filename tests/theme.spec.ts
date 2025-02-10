import { test, expect } from '@playwright/test';

test.describe('UI functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/osm/1/0/0');
    // Wait for tile info to appear
    await page.waitForSelector('[role="complementary"][aria-label="Tile Information"]', { timeout: 10000 });
  });

  test('should have correct default styles', async ({ page }) => {
    // Check if the body has light theme colors
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Test contrast
    const title = page.getByRole('heading', { name: 'Tile Information' });
    await expect(title).toBeVisible({ timeout: 10000 });
    await expect(title).toHaveCSS('color', 'rgb(17, 24, 39)');
  });

  test('should maintain consistent UI styling', async ({ page }) => {
    // Check UI component styles
    const infoCard = page.getByRole('complementary', { name: 'Tile Information' });
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(infoCard).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    
    const searchInput = page.getByPlaceholder('Search location...');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    
    const button = page.getByRole('button', { name: 'Show Details' });
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS('background-color', 'rgb(219, 234, 254)');
  });
});
