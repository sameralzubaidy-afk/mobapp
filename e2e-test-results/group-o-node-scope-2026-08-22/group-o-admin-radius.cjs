/**
 * Group O — O05 admin-leg evidence + radius-config change (Playwright)
 *
 * Chain: admin /settings/nodes → save default_radius=15, min_user_radius=10,
 * max_user_radius=25 → screenshot before/after. A `--restore` mode reverts to
 * the values captured before the change (written to admin-radius-before.json)
 * so the shared admin_config is left as found.
 *
 * Run (from p2p-kids-admin/):
 *   NODE_PATH=$PWD/node_modules node ../../e2e-test-results/group-o-node-scope-2026-08-22/group-o-admin-radius.cjs
 *   ... --restore
 *
 * Credentials are read from p2p-kids-admin/.env.local via dotenv — never
 * routed through the model. Evidence screenshots land in the run's screenshots/.
 */
const path = require('node:path');
const fs = require('node:fs');

// The script lives in this run's evidence folder.
const RUN_DIR = __dirname;

// Credentials come from the admin app's .env.local — resolved absolutely from
// the run dir (../.. = workspace root) so the script is cwd-independent.
const ADMIN_APP_DIR = path.join(__dirname, '..', '..', 'p2p-kids-admin');
require('dotenv').config({ path: path.join(ADMIN_APP_DIR, '.env.local') });

const { chromium } = require('@playwright/test');

const BASE_URL = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_E2E_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_E2E_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD;

const SHOTS = path.join(RUN_DIR, 'screenshots');
const BEFORE_FILE = path.join(RUN_DIR, 'admin-radius-before.json');

if (!EMAIL || !PASSWORD) {
  console.error('Missing admin creds in .env.local (ADMIN_E2E_EMAIL/PASSWORD or PLAYWRIGHT_ADMIN_*).');
  process.exit(2);
}

const TARGET = { default_radius_miles: 15, min_user_radius_miles: 10, max_user_radius_miles: 25 };

async function login(page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForURL('**/auth/login**', { timeout: 15000 });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  const submitButton = page
    .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
    .first();
  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await submitButton.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 20000 });
}

async function readSettings(page) {
  const input = (labelText) =>
    page.locator(`label:has-text("${labelText}")`).locator('xpath=following-sibling::input[1]');
  const val = async (labelText) => {
    const el = input(labelText);
    if ((await el.count()) === 0) return null;
    return (await el.inputValue()) || null;
  };
  return {
    default_radius_miles: await val('Default Search Radius'),
    max_assignment_distance_miles: await val('Max Assignment Distance'),
    distance_warning_threshold_miles: await val('Distance Warning Threshold'),
    min_user_radius_miles: await val('Min User Radius'),
    max_user_radius_miles: await val('Max User Radius'),
  };
}

async function fillInput(page, labelText, value) {
  const el = page.locator(`label:has-text("${labelText}")`).locator('xpath=following-sibling::input[1]');
  await el.waitFor({ state: 'visible', timeout: 10000 });
  await el.fill(String(value));
}

async function main() {
  const restoreMode = process.argv.includes('--restore');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await login(page);
    await page.goto(`${BASE_URL}/settings/nodes`);
    await page.waitForSelector('label:has-text("Default Search Radius")', { timeout: 20000 });

    const before = await readSettings(page);
    console.log('ADMIN-O05 before:', JSON.stringify(before));
    await page.screenshot({ path: path.join(SHOTS, 'ADMIN-O05-nodes-before.png'), fullPage: true });

    if (restoreMode) {
      if (!fs.existsSync(BEFORE_FILE)) {
        console.error('No before.json to restore from.');
        process.exit(3);
      }
      const saved = JSON.parse(fs.readFileSync(BEFORE_FILE, 'utf8'));
      // Ensure the radius-adjustment section is visible to restore min/max.
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (saved.min_user_radius_miles != null || saved.max_user_radius_miles != null) {
        if (!(await checkbox.isChecked())) await checkbox.check();
      }
      if (saved.default_radius_miles != null)
        await fillInput(page, 'Default Search Radius', saved.default_radius_miles);
      if (saved.max_assignment_distance_miles != null)
        await fillInput(page, 'Max Assignment Distance', saved.max_assignment_distance_miles);
      if (saved.distance_warning_threshold_miles != null)
        await fillInput(page, 'Distance Warning Threshold', saved.distance_warning_threshold_miles);
      if (saved.min_user_radius_miles != null)
        await fillInput(page, 'Min User Radius', saved.min_user_radius_miles);
      if (saved.max_user_radius_miles != null)
        await fillInput(page, 'Max User Radius', saved.max_user_radius_miles);
      await page.screenshot({ path: path.join(SHOTS, 'ADMIN-O05-nodes-restore-filled.png'), fullPage: true });
      await page.locator('button:has-text("Save Settings")').click();
      await page.waitForSelector('text=Node settings saved successfully!', { timeout: 15000 });
      await page.screenshot({ path: path.join(SHOTS, 'ADMIN-O05-nodes-restored.png'), fullPage: true });
      console.log('ADMIN-O05 restored to:', JSON.stringify(saved));
    } else {
      fs.writeFileSync(BEFORE_FILE, JSON.stringify(before, null, 2));
      console.log('Saved before-state to', BEFORE_FILE);

      // Ensure the radius-adjustment section is open so min/max can be set.
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
        await page.waitForSelector('label:has-text("Min User Radius")', { timeout: 10000 });
      }

      await fillInput(page, 'Default Search Radius', TARGET.default_radius_miles);
      await fillInput(page, 'Min User Radius', TARGET.min_user_radius_miles);
      await fillInput(page, 'Max User Radius', TARGET.max_user_radius_miles);
      await page.screenshot({ path: path.join(SHOTS, 'ADMIN-O05-nodes-filled.png'), fullPage: true });

      await page.locator('button:has-text("Save Settings")').click();
      await page.waitForSelector('text=Node settings saved successfully!', { timeout: 15000 });
      await page.screenshot({ path: path.join(SHOTS, 'ADMIN-O05-nodes-saved-confirmation.png'), fullPage: true });

      const after = await readSettings(page);
      console.log('ADMIN-O05 after:', JSON.stringify(after));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('ADMIN-O05 script error:', err);
  process.exit(1);
});
