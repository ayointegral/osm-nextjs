import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Verify the app is running
    await page.goto(baseURL!);
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });
  } catch (error) {
    console.error('Failed to verify app is running:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
