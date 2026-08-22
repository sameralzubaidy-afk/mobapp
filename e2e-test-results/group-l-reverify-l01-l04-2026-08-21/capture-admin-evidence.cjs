/**
 * Admin evidence capture for Group L re-verify (2026-08-21) — CommonJS build.
 * Run with NODE_PATH pointing at p2p-kids-admin/node_modules:
 *   cd p2p-kids-admin && NODE_PATH=$PWD/node_modules node ../e2e-test-results/.../capture-admin-evidence.cjs
 * Reproduces the L02 admin-approve flow against :3001 and screenshots each step
 * (the Group L spec does not page.screenshot(), and a passing run saves no
 * failure screenshots — playbook §5.20 evidence gap).
 * Reads admin creds from p2p-kids-admin/.env.local itself (never echoes).
 * State impact: re-approves anchor 83c8823b (pending -> available).
 */
const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');

const RUN_DIR = path.resolve(__dirname);
// run dir = <workspace>/e2e-test-results/group-l-reverify-l01-l04-2026-08-21 → up 2 = <workspace>
dotenv.config({ path: path.join(RUN_DIR, '..', '..', 'p2p-kids-admin', '.env.local') });

const BASE = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const ITEM_ID = '83c8823b-0089-4602-afe6-183997f1aa1d';
const SELLER_EMAIL = 'test-seller@kidsmarketplace.test';
const OUT = path.join(RUN_DIR, 'screenshots');

if (!EMAIL || !PASSWORD) {
  console.error('Missing ADMIN_E2E_* / PLAYWRIGHT_ADMIN_* creds');
  process.exit(2);
}

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('saved', name);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

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
    await page
      .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
      .first()
      .click();
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

  // 3) approve + confirm
  await page.getByTestId(`btn-approve-${ITEM_ID}`).click();
  const confirmBtn = page.getByTestId('btn-confirm-action');
  await confirmBtn.waitFor({ state: 'visible' });
  await shot(page, 'ADMIN-L02-03-confirm-dialog.png');

  let dialogMessage = '';
  page.on('dialog', async (d) => { dialogMessage = d.message(); await d.accept(); });
  await confirmBtn.click();
  await page.waitForTimeout(1500);
  await shot(page, 'ADMIN-L02-04-approval-alert.png');
  console.log('approval alert:', dialogMessage);

  // 4) switch filter to active + re-search (Fix 4 poll pattern) -> available
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
})().catch((e) => {
  console.error('capture failed:', e.message);
  process.exit(1);
});
