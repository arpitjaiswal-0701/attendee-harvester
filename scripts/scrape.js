// Step 2: Scrape attendees via API interception. Auto-detects when done.
// Usage: node scripts/scrape.js [path/to/swapcard.config.json]
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const { loadConfig, waitForEnter, launchBrowser, extractPeople, isSwapcard } = require('../lib/common');

const IDLE_SECONDS = 20;

(async () => {
  const config = loadConfig(process.argv[2]);
  console.log(`\n🌐 Event: ${config.eventName}`);
  console.log(`   Output: ${config.outputPath}\n`);

  const { context, page } = await launchBrowser(config, chromium);

  const people = new Map();
  let lastNewAt = Date.now();
  let doneDetected = false;

  page.on('response', async (response) => {
    if (!isSwapcard(response.url(), response.headers()['content-type'] || '')) return;
    try {
      const before = people.size;
      extractPeople(await response.json(), people);
      if (people.size > before) lastNewAt = Date.now();
    } catch (_) {}
  });

  await page.goto(config.eventUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('============================================================');
  console.log('  Navigate to the People / Attendees page.');
  console.log('  Script auto-scrolls and listens for API data.');
  console.log('  It will announce when it detects the end of the list.');
  console.log('============================================================\n');

  let autoScrolling = true;
  let lastScrollY = -1;
  let scrollStuckCount = 0;

  const autoScroll = async () => {
    while (autoScrolling) {
      const scrollY = await page.evaluate(() => { window.scrollBy(0, 800); return window.scrollY; });
      scrollStuckCount = scrollY === lastScrollY ? scrollStuckCount + 1 : 0;
      lastScrollY = scrollY;

      const idleSec = Math.round((Date.now() - lastNewAt) / 1000);
      process.stdout.write(`\r  📥 ${people.size} attendees captured | ⏱  no new data for: ${idleSec}s   `);

      if (scrollStuckCount >= 5 && idleSec >= IDLE_SECONDS && !doneDetected) {
        doneDetected = true;
        autoScrolling = false;
        console.log('\n\n🏁 ============================================================');
        console.log(`   Reached the bottom — no new data for ${idleSec}s.`);
        console.log(`   ${people.size} attendees captured.`);
        console.log('   Press ENTER to save.');
        console.log('   ============================================================\n');
      }
      await page.waitForTimeout(800);
    }
  };

  autoScroll();
  await waitForEnter();
  autoScrolling = false;
  await page.waitForTimeout(500);

  console.log(`\n\n✅ Total captured: ${people.size}`);
  if (people.size === 0) { console.log('⚠️  Nothing captured.'); await context.close(); return; }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Title / Role', 'Company / Organization'],
    ...Array.from(people.values()).map(p => [p.name, p.title, p.company]),
  ]);
  ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
  XLSX.writeFile(wb, config.outputPath);

  console.log(`💾 Saved to: ${config.outputPath}`);
  await context.close();
})().catch(err => { console.error('❌', err.message); process.exit(1); });
