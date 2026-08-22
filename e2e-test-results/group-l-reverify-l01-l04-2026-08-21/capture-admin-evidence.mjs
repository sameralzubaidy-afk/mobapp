/**
 * Admin evidence capture for Group L re-verify (2026-08-21).
 * Playwright script that reproduces the L02 admin-approve flow against the
 * staging portal (:3001) and screenshots each key step, because the Group L
 * spec itself does not call page.screenshot() and a passing run saves no
 * failure screenshots (playbook §5.20 multi-surface evidence gap).
 *
 * Reads admin credentials from p2p-kids-admin/.env.local itself (never echoes).
 * Saves screenshots into the run's screenshots/ folder with an ADMIN- prefix.
 *
 * State impact: re-approves the anchor item 83c8823b (pending -> available),
 * mirroring the documented L02 flow. Run: node capture-admin-evidence.mjs
 */
import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', 'p2p-kids-admin', '.env.local') });

const BASE = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const ITEM_ID = '83c8823b-0089-4602-afe6-183997f1aa1d';
const SELLER_EMAIL = 'test-seller@kidsmarketplace.test';
const OUT = path.resolve(__dirname, 'screenshots');

if (!EMAIL || !PASSWORD) {
  console.error('Missing ADMIN_E2E_* / PLAYWRIGHT_ADMIN_* creds');
  process.exit(2);
}

const shot = async (page, name) => {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log('saved', name);
};

const browser = await chromium.launch();
const page = await browser.newPage();

// client-side auth guard: wait for the redirect decision
await page.goto(`${BASE}/listings`, { waitUntil: 'domcontentloaded' });
let onLogin = true;
try {
  await page.waitForURL('**/auth/login**', { timeout: 10000 });
} catch {
  onLogin = false;
}

if (onLogin) {
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 20000 });
  await page.goto(`${BASE}/listings`, { waitUntil: 'domcontentloaded' });
}
await page.waitForSelector('[data-testid="listings-status-select"]', { timeout: 20000 });
console.log('authenticated admin session OK');

// 1) pending queue filtered to seller
await page.selectOption('[data-testid="listings-status-select"]', 'pending');
await page.fill('[data-testid="listings-seller-email-input"]', SELLER_EMAIL);
await page.click('[data-testid="btn-listings-search"]');
const row = page.locator(`[data-testid="listings-row-${ITEM_ID}"]`);
await row.waitFor({ state: 'visible', timeout: 20000 });
await page.waitForTimeout(800);
await shot(page, 'ADMIN-L02-01-pending-queue.png');

// 2) details modal
await row.click();
await page.getByTestId('listings-details-modal').waitFor({ state: 'visible' });
await page.getByTestId(`btn-approve-${ITEM_ID}`).waitFor({ state: 'visible' });
await shot(page, 'ADMIN-L02-02-details-modal.png');

// 3) approve + confirm + alert
await page.getByTestId(`btn-approve-${ITEM_ID}`).click();
const confirmBtn = page.getByTestId('btn-confirm-action');
await confirmBtn.waitFor({ state: 'visible' });
await shot(page, 'ADMIN-L02-03-confirm-dialog.png');

let dialogMessage = '';
page.on('dialog', async (d) => { dialogMessage = d.message(); await d.accept(); });
await confirmBtn.click();
await page.waitForFunction(() => document.querySelector('body'), { timeout: 500 });
// wait for the alert to fire
await page.waitForTimeout(1500);
await shot(page, 'ADMIN-L02-04-approval-alert.png');
console.log('approval alert:', dialogMessage);

// 4) switch filter to active + re-search (Fix 4 poll pattern) -> available state
await page.selectOption('[data-testid="listings-status-select"]', 'active');
let ok = false;
for (let i = 0; i < 12 && !ok; i++) {
  await page.click('[data-testid="btn-listings-search"]');
  await page.waitForTimeout(700);
  ok = await row.getByText(/available/i).isVisible().catch(() => false);
}
await page.waitForTimeout(600);
await shot(page, 'ADMIN-L02-05-available-after-approve.png');
console.log('available badge visible:', ok);

await browser.close();
console.log('done');
