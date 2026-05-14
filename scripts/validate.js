// Validates scrape completeness against Swapcard's own API totalCount.
// Usage: node scripts/validate.js [path/to/swapcard.config.json]
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const { loadConfig, launchBrowser, isSwapcard } = require('../lib/common');

(async () => {
  const config = loadConfig(process.argv[2]);

  let excelCount = 0;
  if (fs.existsSync(config.outputPath)) {
    const wb = XLSX.readFile(config.outputPath);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    excelCount = data.length - 1;
    console.log(`📊 Your Excel: ${excelCount.toLocaleString()} attendees`);
  } else {
    console.log('⚠️  No Excel file found at:', config.outputPath);
  }

  console.log('\nOpening browser to check official total...');
  const { context, page } = await launchBrowser(config, chromium);

  let officialTotal = null;

  page.on('response', async (response) => {
    if (officialTotal) return;
    if (!isSwapcard(response.url(), response.headers()['content-type'] || '')) return;
    try {
      const body = await response.json();
      const find = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(find); return; }
        for (const key of ['totalCount', 'total', 'count', 'totalResults', 'nbHits']) {
          if (typeof obj[key] === 'number' && obj[key] > 100 && (!officialTotal || obj[key] > officialTotal)) {
            officialTotal = obj[key];
          }
        }
        Object.values(obj).forEach(v => { if (v && typeof v === 'object') find(v); });
      };
      find(body);
      if (officialTotal) printSummary(excelCount, officialTotal);
    } catch (_) {}
  });

  await page.goto(config.eventUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  if (!officialTotal) console.log('⚠️  Could not detect total from API — check the browser for a displayed count.');

  await context.close();

  function printSummary(excel, official) {
    const pct = ((excel / official) * 100).toFixed(1);
    const gap = official - excel;
    console.log('\n─────────────────────────────────────');
    console.log(`  Your file:      ${excel.toLocaleString()}`);
    console.log(`  Swapcard total: ${official.toLocaleString()}`);
    console.log(`  Coverage:       ${pct}%`);
    console.log(`  Gap:            ${gap.toLocaleString()}`);
    console.log('─────────────────────────────────────');
    if (gap <= 50) console.log('  ✅ Complete');
    else if (gap <= 500) console.log('  ⚠️  Small gap — likely privacy opt-outs');
    else console.log('  ❌ Significant gap — more scrolling needed');
  }
})().catch(err => { console.error('❌', err.message); process.exit(1); });
