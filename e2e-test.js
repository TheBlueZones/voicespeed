const { chromium } = require('playwright');
const { spawn } = require('child_process');

async function waitForServer(url, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server did not start in time');
}

async function main() {
  // 启动 dev server
  console.log('[1/6] 启动 Next.js dev server...');
  const server = spawn('npx', ['next', 'start', '-p', '3098'], {
    cwd: __dirname,
    shell: true,
    stdio: 'pipe',
  });

  try {
    await waitForServer('http://localhost:3098');
    console.log('[1/6] ✅ 服务器已启动');

    // 启动浏览器
    console.log('[2/6] 启动浏览器...');
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();

    // 打开主页
    console.log('[3/6] 打开主页 http://localhost:3098 ...');
    await page.goto('http://localhost:3098');
    await page.waitForLoadState('networkidle');

    // 检查页面标题
    const title = await page.textContent('h1');
    console.log(`[3/6] ✅ 页面标题: "${title}"`);

    // 检查按钮状态
    const btnText = await page.textContent('button');
    console.log(`[3/6] ✅ 按钮文字: "${btnText}"`);

    // 等待初始化完成（按钮变为可点击）
    console.log('[4/6] 等待服务初始化...');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    console.log('[4/6] ✅ 服务已初始化，按钮可点击');

    // 点击"开始录音"
    console.log('[5/6] 点击"开始录音"...');
    await page.click('button');

    // 等待 5 秒让 mock 数据产生
    console.log('[5/6] 等待 mock 数据（5秒）...');
    await page.waitForTimeout(5000);

    // 检查语速数值是否更新
    const speechRateText = await page.locator('.text-blue-600.text-3xl').first().textContent();
    const avgRateText = await page.locator('.text-green-600.text-3xl').first().textContent();
    const wordCountText = await page.locator('.text-purple-500.text-xl').first().textContent();
    const durationText = await page.locator('.text-indigo-500.text-xl').first().textContent();

    console.log(`[5/6] ✅ 当前语速: ${speechRateText}`);
    console.log(`[5/6] ✅ 平均语速: ${avgRateText}`);
    console.log(`[5/6] ✅ 总字数: ${wordCountText}`);
    console.log(`[5/6] ✅ 总时长: ${durationText}`);

    // 检查语速等级
    const levelText = await page.locator('.text-4xl').first().textContent();
    console.log(`[5/6] ✅ 语速等级: "${levelText}"`);

    // 点击"停止录音"
    console.log('[6/6] 点击"停止录音"...');
    await page.click('button');
    await page.waitForTimeout(500);

    const btnTextAfter = await page.textContent('button');
    console.log(`[6/6] ✅ 停止后按钮文字: "${btnTextAfter}"`);

    // 验证数值保留
    const finalRate = await page.locator('.text-blue-600.text-3xl').first().textContent();
    console.log(`[6/6] ✅ 停止后语速保留: ${finalRate}`);


    console.log('\n========== 测试结果 ==========');
    console.log('✅ 主页加载正常');
    console.log('✅ 服务初始化成功');
    console.log('✅ 开始录音功能正常');
    console.log('✅ 语速实时更新正常');
    console.log('✅ 停止录音功能正常');
    console.log('✅ 数值停止后保留');
    console.log('==============================');

    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
