/// <reference types="detox" />

// ─── Staging test credentials ──────────────────────────────────────────────
// These accounts are created once by: npm run seed:staging
// In CI, override via DETOX_BUYER_EMAIL / DETOX_SELLER_EMAIL GitHub Secrets.
const BUYER = {
  email: process.env.DETOX_BUYER_EMAIL ?? 'test-buyer@kidsmarketplace.test',
  password: process.env.DETOX_BUYER_PASSWORD ?? 'TestBuyer123!',
};

const SELLER = {
  email: process.env.DETOX_SELLER_EMAIL ?? 'test-seller@kidsmarketplace.test',
  password: process.env.DETOX_SELLER_PASSWORD ?? 'TestSeller123!',
};

// ─── Private helpers ───────────────────────────────────────────────────────

/**
 * Navigates past Welcome and Landing screens to reach the Login screen.
 * Safe to call even if already on the Login screen.
 */
async function navigateToLoginScreen(): Promise<void> {
  try {
    await element(by.id('welcome-get-started-button')).tap();
    await new Promise(r => setTimeout(r, 600));
  } catch {}
  try {
    await element(by.id('landing-login-button')).tap();
    await new Promise(r => setTimeout(r, 600));
  } catch {}
}

/**
 * Fills the login form and submits.
 * Double-taps the password field to dismiss iOS autofill before typing.
 */
async function submitLoginForm(email: string, password: string): Promise<void> {
  await waitFor(element(by.id('login-email-input')))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id('login-email-input')).clearText();
  await element(by.id('login-email-input')).typeText(email);

  // Double-tap dismisses iOS autofill suggestion before typing password
  await element(by.id('login-password-input')).tap();
  await element(by.id('login-password-input')).tap();
  await element(by.id('login-password-input')).clearText();
  await element(by.id('login-password-input')).typeText(password);

  // Dismiss keyboard (Class 1 defense — keyboard can block the submit button)
  await element(by.id('login-password-input')).tapReturnKey();

  await waitFor(element(by.id('login-submit-button')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('login-submit-button')).tap();
}

// ─── Exported helpers ──────────────────────────────────────────────────────

/**
 * Completes the full login flow as the test buyer.
 * Waits for the Discover tab to confirm successful login.
 */
export async function loginAsBuyer(): Promise<void> {
  await navigateToLoginScreen();
  await submitLoginForm(BUYER.email, BUYER.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
}

/**
 * Completes the full login flow as the test seller.
 * Waits for the Discover tab to confirm successful login.
 */
export async function loginAsSeller(): Promise<void> {
  await navigateToLoginScreen();
  await submitLoginForm(SELLER.email, SELLER.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
}
