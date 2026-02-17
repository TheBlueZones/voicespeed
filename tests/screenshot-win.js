const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const screenshotDir = '\\\\wsl.localhost\\Ubuntu-24.04\\home\\happy\\projects\\voicespeed\\screenshots';

  // 1. Desktop - 1440x900
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3099', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({ path: `${screenshotDir}\\desktop-1440.png`, fullPage: true });
  console.log('Desktop 1440x900 done');
  await desktopCtx.close();

  // 2. iPad Pro
  const ipadCtx = await browser.newContext({
    ...devices['iPad Pro 11'],
  });
  const ipadPage = await ipadCtx.newPage();
  await ipadPage.goto('http://localhost:3099', { waitUntil: 'networkidle', timeout: 30000 });
  await ipadPage.waitForTimeout(1500);
  await ipadPage.screenshot({ path: `${screenshotDir}\\ipad-pro.png`, fullPage: true });
  console.log('iPad Pro done');
  await ipadCtx.close();

  // 3. iPhone 14
  const iphoneCtx = await browser.newContext({
    ...devices['iPhone 14'],
  });
  const iphonePage = await iphoneCtx.newPage();
  await iphonePage.goto('http://localhost:3099', { waitUntil: 'networkidle', timeout: 30000 });
  await iphonePage.waitForTimeout(1500);
  await iphonePage.screenshot({ path: `${screenshotDir}\\iphone-14.png`, fullPage: true });
  console.log('iPhone 14 done');
  await iphoneCtx.close();

  // 4. iPhone SE
  const seCtx = await browser.newContext({
    ...devices['iPhone SE'],
  });
  const sePage = await seCtx.newPage();
  await sePage.goto('http://localhost:3099', { waitUntil: 'networkidle', timeout: 30000 });
  await sePage.waitForTimeout(1500);
  await sePage.screenshot({ path: `${screenshotDir}\\iphone-se.png`, fullPage: true });
  console.log('iPhone SE done');
  await seCtx.close();

  // 5. Pixel 7
  const pixelCtx = await browser.newContext({
    ...devices['Pixel 7'],
  });
  const pixelPage = await pixelCtx.newPage();
  await pixelPage.goto('http://localhost:3099', { waitUntil: 'networkidle', timeout: 30000 });
  await pixelPage.waitForTimeout(1500);
  await pixelPage.screenshot({ path: `${screenshotDir}\\pixel-7.png`, fullPage: true });
  console.log('Pixel 7 done');
  await pixelCtx.close();

  await browser.close();
  console.log('\nAll screenshots saved!');
})();
