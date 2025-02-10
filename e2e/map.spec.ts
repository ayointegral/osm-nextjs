import { test, expect } from '@playwright/test'

test('map loads correctly', async ({ page }) => {
  await page.goto('/')
  
  // Wait for the map container to be visible
  await expect(page.locator('#map')).toBeVisible()
  
  // Check if Leaflet is loaded
  await expect(page.locator('.leaflet-container')).toBeVisible()
  
  // Check if tiles are loaded
  await expect(page.locator('.leaflet-tile-loaded')).toBeVisible()
})
