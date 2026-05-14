const fs = require('fs');
const path = require('path');
const readline = require('readline');

function loadConfig(configPath) {
  const resolved = configPath || path.join(process.cwd(), 'swapcard.config.json');
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Config file not found: ${resolved}`);
    console.error('   Copy config.example.json to swapcard.config.json and fill in your event details.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const required = ['eventUrl', 'eventName', 'outputDir', 'profileDir'];
  for (const key of required) {
    if (!config[key]) { console.error(`❌ Missing required config key: ${key}`); process.exit(1); }
  }
  config.outputPath = path.join(config.outputDir, `${config.eventName.replace(/\s+/g, '_')}_Attendees.xlsx`);
  return config;
}

function waitForEnter(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt || '', () => { rl.close(); resolve(); });
  });
}

async function launchBrowser(config, playwright) {
  const context = await playwright.launchPersistentContext(config.profileDir, {
    headless: false,
    slowMo: 30,
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return { context, page };
}

// Recursively extract person objects from any API response body
function extractPeople(obj, accumulator) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(v => extractPeople(v, accumulator)); return; }
  if ((obj.firstName || obj.lastName) && obj.id) {
    const name = [obj.firstName, obj.lastName].filter(Boolean).join(' ').trim();
    if (name.length > 1 && !accumulator.has(obj.id)) {
      accumulator.set(obj.id, {
        name,
        title: obj.jobTitle || obj.position || '',
        company: obj.companyName || obj.organization || obj.company?.name || '',
      });
    }
  }
  Object.values(obj).forEach(v => { if (v && typeof v === 'object') extractPeople(v, accumulator); });
}

function isSwapcard(url, contentType) {
  return contentType.includes('json') && (url.includes('swapcard') || url.includes('api'));
}

module.exports = { loadConfig, waitForEnter, launchBrowser, extractPeople, isSwapcard };
