const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const screenshotDir = '/home/happy/projects/voicespeed/screenshots';

  // 1. Desktop - 1440x900
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3099', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000); // wait for animations
  await desktopPage.screenshot({ path: `${screenshotDir}/desktop-1440.png`, fullPage: true });
  console.log('✅ Desktop 1440x900 screenshot saved');
  await desktopCtx.close();

  // 2. Tablet - iPad
  const ipadCtx = await browser.newContext({
    ...devices['iPad Pro 11'],
  });
  const ipadPage = await ipadCtx.newPage();
  await ipadPage.goto('http://localhost:3099', { waitUntil: 'networkidle' });
  await ipadPage.waitForTimeout(1000);
  await ipadPage.screenshot({ path: `${screenshotDir}/ipad-pro.png`, fullPage: true });
  console.log('✅ iPad Pro screenshot saved');
  await ipadCtx.close();

  // 3. Mobile - iPhone 14
  const iphoneCtx = await browser.newContext({
    ...devices['iPhone 14'],
  });
  const iphonePage = await iphoneCtx.newPage();
  await iphonePage.goto('http://localhost:3099', { waitUntil: 'networkidle' });
  await iphonePage.waitForTimeout(1000);
  await iphonePage.screenshot({ path: `${screenshotDir}/iphone-14.png`, fullPage: true });
  console.log('✅ iPhone 14 screenshot saved');
  await iphoneCtx.close();

  // 4. Small mobile - iPhone SE
  const seCtx = await browser.newContext({
    ...devices['iPhone SE'],
  });
  const sePage = await seCtx.newPage();
  await sePage.goto('http://localhost:3099', { waitUntil: 'networkidle' });
  await sePage.waitForTimeout(1000);
  await sePage.screenshot({ path: `${screenshotDir}/iphone-se.png`, fullPage: true });
  console.log('✅ iPhone SE screenshot saved');
  await seCtx.close();

  // 5. Android - Pixel 7
  const pixelCtx = await browser.newContext({
    ...devices['Pixel 7'],
  });
  const pixelPage = await pixelCtx.newPage();
  await pixelPage.goto('http://localhost:3099', { waitUntil: 'networkidle' });
  await pixelPage.waitForTimeout(1000);
  await pixelPage.screenshot({ path: `${screenshotDir}/pixel-7.png`, fullPage: true });
  console.log('✅ Pixel 7 screenshot saved');
  await pixelCtx.close();

  await browser.close();
  console.log('\n🎉 All screenshots saved to:', screenshotDir);
})();
