// Recon: verify live routes + selectors + geometry before recording.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://regshift.vercel.app';
const OUT = new URL('./recon/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

async function go(hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}
const box = async (sel) => {
  const loc = page.locator(sel).first();
  if ((await loc.count()) === 0) return null;
  return await loc.boundingBox();
};

// 1) overview
await go('#/');
await page.screenshot({ path: `${OUT}overview.png` });
console.log('overview h1:', await page.locator('h1').first().textContent());

// 2) obligations
await go('#/obligations');
console.log('OB-050-1 card box:', JSON.stringify(await box('#OB-050-1')));
console.log('OB-050-1 summary:', JSON.stringify(await box('#OB-050-1 .obligation-summary')));
await page.screenshot({ path: `${OUT}obligations.png` });
// expand it
const card = page.locator('#OB-050-1 .obligation-summary');
if ((await card.count()) > 0) {
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}obligations-open.png` });
  console.log('open card box:', JSON.stringify(await box('#OB-050-1')));
  const quote = await box('#OB-050-1 blockquote');
  console.log('blockquote box:', JSON.stringify(quote));
  console.log('body classes:', await page.locator('#OB-050-1 .obligation-body').first().innerHTML().then(h => h.slice(0, 600)));
}

// 3) impact
await go('#/impact?ob=OB-050-1');
await page.screenshot({ path: `${OUT}impact.png` });
console.log('impact h1:', await page.locator('h1').first().textContent().catch(() => 'n/a'));
for (const sel of ['.impact-files', '.file-pane', '.impact-evidence', '.evidence', 'aside', 'main section']) {
  console.log(`impact sel ${sel}:`, JSON.stringify(await box(sel)));
}

// 4) proposal P-019
await go('#/proposals/P-019');
await page.screenshot({ path: `${OUT}proposal.png` });
console.log('proposal h1:', await page.locator('h1').first().textContent().catch(() => 'n/a'));
for (const sel of ['.diff', 'pre', '.decision-panel', '.decision-opt.opt-approved', '#decision-comment', '.decision-actions .btn-primary']) {
  console.log(`proposal sel ${sel}:`, JSON.stringify(await box(sel)));
}
console.log('page height:', await page.evaluate(() => document.body.scrollHeight));

// 5) review
await go('#/review');
await page.screenshot({ path: `${OUT}review.png` });
console.log('review rows:', await page.locator('table tr, .review-row, li').count());

// 6) audit
await go('#/audit');
await page.screenshot({ path: `${OUT}audit.png` });
console.log('export btn:', JSON.stringify(await box('button:has-text("Export audit report")')));
console.log('audit page height:', await page.evaluate(() => document.body.scrollHeight));

await browser.close();
console.log('RECON OK');
