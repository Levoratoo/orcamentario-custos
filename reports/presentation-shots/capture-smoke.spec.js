const { test } = require('@playwright/test');

test('smoke', async ({ page }) => {
  await page.goto('http://localhost:3004/login');
  await page.screenshot({ path: 'reports/presentation-shots/test-smoke.png' });
});
