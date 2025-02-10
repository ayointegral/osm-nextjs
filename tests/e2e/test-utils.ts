import { Page } from '@playwright/test';

export async function waitForMapReady(page: Page) {
  await page.waitForSelector('.leaflet-container');
  await page.waitForSelector('.leaflet-control-zoom');
  await page.waitForSelector('.leaflet-control-layers');
}

export async function mockApiResponses(page: Page) {
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
}

export async function trackApiCalls(page: Page) {
  const apiCalls: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/settings') && request.method() === 'POST') {
      apiCalls.push(request);
    }
  });
  return apiCalls;
}

export async function changeMapLayer(page: Page, layerName: string) {
  await page.locator('.leaflet-control-layers-toggle').click();
  await page.getByText(layerName).click();
}

export async function getMapState(page: Page) {
  const zoomText = await page.locator('text=Zoom Level:').textContent();
  const zoom = parseInt(zoomText?.match(/\d+/)?.[0] || '0');
  
  await page.locator('.leaflet-control-layers-toggle').click();
  const selectedLayer = await page.locator('.leaflet-control-layers input[checked]').getAttribute('name');
  
  return { zoom, selectedLayer };
}
