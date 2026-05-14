// Step 1: Open browser and log in manually. Session is saved to disk.
// Usage: node scripts/login.js [path/to/swapcard.config.json]
const { chromium } = require('playwright');
const { loadConfig, waitForEnter, launchBrowser } = require('../lib/common');

(async () => {
  const config = loadConfig(process.argv[2]);
  console.log(`\n🌐 Event: ${config.eventName}`);
  console.log(`   Profile will be saved to: ${config.profileDir}\n`);

  const { context, page } = await launchBrowser(config, chromium);

  await page.goto(config.eventUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('============================================================');
  console.log('  Browser is open. Please:');
  console.log('  1. Accept any cookie consent banner');
  console.log('  2. Sign in with your email');
  console.log('  3. Complete OTP / magic link from your email');
  console.log('  4. Wait until you see the main event page');
  console.log('============================================================');

  await waitForEnter('\n  >> Press ENTER once you are fully logged in...\n');

  console.log(`✅ Session saved to: ${config.profileDir}`);
  console.log('   Now run: node scripts/scrape.js');
  await context.close();
})().catch(err => { console.error('❌', err.message); process.exit(1); });
