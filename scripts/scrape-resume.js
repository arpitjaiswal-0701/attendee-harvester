// Resume a scrape — merges new attendees into existing Excel, skips duplicates.
// Usage: node scripts/scrape-resume.js [path/to/swapcard.config.json]
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const { loadConfig, waitForEnter, launchBrowser, extractPeople, isSwapcard } = require('../lib/common');

const IDLE_SECONDS = 20;

(async () => {
  const config = loadConfig(process.argv[2]);

  // Load existing file
  let existingRows = [], seenNames = new Set();
  if (fs.existsSync(config.outputPath)) {
    const wb = XLSX.readFile(config.outputPath);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    existingRows = data.slice(1);
    seenNames = new Set(existingRows.map(r => (r[0] || '').trim().toLowerCase()));
    console.log(`📂 Loaded ${existingRows.length} existing attendees.`);
    console.log(`   Last entry: "${existingRows[existingRows.length - 1]?.[0]}"`);
  }

  const { context, page } = await launchBrowser(config, chromium);
  const people = new Map();
  let lastNewAt = Date.now();
  let doneDetected = false;

  page.on('response', async (response) => {
    if (!isSwapcard(response.url(), response.headers()['content-type'] || '')) return;
    try {
      const before = people.size;
      extractPeople(await response.json(), people);
      if (people.size > before) {
        lastNewAt = Date.now();
        const newCount = Array.from(people.values()).filter(p => !seenNames.has(p.name.toLowerCase())).length;
        process.stdout.write(`\r  📥 ${people.size} seen | ✨ ${newCount} NEW   `);
      }
    } catch (_) {}
  });

  await page.goto(config.eventUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('\n  Scroll past where you left off and continue to the end.');
  console.log('  Script will announce when it detects the bottom.\n');

  let autoScrolling = true;
  let lastScrollY = -1;
  let scrollStuckCount = 0;

  const autoScroll = async () => {
    while (autoScrolling) {
      const scrollY = await page.evaluate(() => { window.scrollBy(0, 800); return window.scrollY; });
      scrollStuckCount = scrollY === lastScrollY ? scrollStuckCount + 1 : 0;
      lastScrollY = scrollY;

      const idleSec = Math.round((Date.now() - lastNewAt) / 1000);
      const newCount = Array.from(people.values()).filter(p => !seenNames.has(p.name.toLowerCase())).length;
      process.stdout.write(`\r  📥 ${people.size} seen | ✨ ${newCount} NEW | ⏱  ${idleSec}s idle   `);

      if (scrollStuckCount >= 5 && idleSec >= IDLE_SECONDS && !doneDetected) {
        doneDetected = true;
        autoScrolling = false;
        console.log(`\n\n🏁 Done — ${newCount} new attendees found. Press ENTER to save.\n`);
      }
      await page.waitForTimeout(800);
    }
  };

  autoScroll();
  await waitForEnter();
  autoScrolling = false;

  const newOnly = Array.from(people.values()).filter(p => !seenNames.has(p.name.toLowerCase()));
  console.log(`\n📊 ${newOnly.length} new | ${existingRows.length} existing | ${existingRows.length + newOnly.length} total`);

  if (newOnly.length === 0) { console.log('ℹ️  No new attendees.'); await context.close(); return; }

  const merged = [...existingRows, ...newOnly.map(p => [p.name, p.title, p.company])];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Name', 'Title / Role', 'Company / Organization'], ...merged]);
  ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
  XLSX.writeFile(wb, config.outputPath);

  console.log(`✅ Saved ${merged.length} total to: ${config.outputPath}`);
  await context.close();
})().catch(err => { console.error('❌', err.message); process.exit(1); });
