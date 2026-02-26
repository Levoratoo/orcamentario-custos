const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = process.env.APP_URL || 'http://localhost:3004';
  const outDir = path.resolve('reports', 'presentation-shots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();

  const screens = [];

  const shot = async (name, fullPage = false) => {
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage });
    screens.push(file);
    console.log('saved:', file);
  };

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 180000 });
  await shot('01-login.png');

  await page.fill('input[name="identifier"]', 'admin');
  await page.fill('input[name="password"]', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 180000 });
  } catch {
    // Give one more chance in case compilation/auth is still in-flight.
    await page.waitForTimeout(15000);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120000 });
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);

  const routes = [
    { url: '/dashboard', file: '02-dashboard.png' },
    { url: '/planejamento', file: '03-planejamento.png' },
    { url: '/bsc/map', file: '04-bsc-mapa.png' },
    { url: '/bsc/management', file: '05-bsc-mensal.png' },
    { url: '/dre/analises', file: '06-dre-analises.png' },
    { url: '/accounts', file: '07-contas.png' },
    { url: '/orcamentos', file: '08-orcamentos.png' },
  ];

  for (const route of routes) {
    try {
      await page.goto(`${baseUrl}${route.url}`, { waitUntil: 'networkidle', timeout: 180000 });
      await page.waitForTimeout(1800);
      await shot(route.file);
    } catch (error) {
      console.log('skip:', route.url, String(error.message || error));
    }
  }

  await browser.close();

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), files: screens }, null, 2));
  console.log('manifest:', manifestPath);
})();
