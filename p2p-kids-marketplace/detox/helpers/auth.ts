/// <reference types="detox" />

import { dismissSystemDialogs, dismissBadgeCelebration } from './dialogs';

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

const FREE = {
  email: process.env.DETOX_FREE_EMAIL ?? 'test-free@kidsmarketplace.test',
  password: process.env.DETOX_FREE_PASSWORD ?? 'TestFree123!',
};

const SELLER_2 = {
  email: process.env.DETOX_SELLER2_EMAIL ?? 'test-seller-2@kidsmarketplace.test',
  password: process.env.DETOX_SELLER2_PASSWORD ?? 'TestSeller2123!',
};

// ─── Private helpers ───────────────────────────────────────────────────────

/**
 * Navigates past Welcome and Landing screens to reach the Login screen.
 * Safe to call even if already on the Login screen.
 */
async function navigateToLoginScreen(): Promise<void> {
  // Try the Welcome → Landing → Login path with proper waits
  try {
    await waitFor(element(by.id('welcome-get-started-button')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('welcome-get-started-button')).tap();
    // Wait for Landing screen to appear before tapping login
    await waitFor(element(by.id('landing-login-button')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('landing-login-button')).tap();
  } catch {
    // Already past Welcome — try Landing button directly
    try {
      await waitFor(element(by.id('landing-login-button')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('landing-login-button')).tap();
    } catch {
      // Already on Login screen — proceed
    }
  }
  // Wait for the login form to be ready
  await new Promise(r => setTimeout(r, 500));
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
 * Waits for the Discover tab to confirm successful login,
 * then dismisses any post-auth system dialogs (notifications, Face ID, etc.).
 * Skips login if already authenticated (tab-discover visible).
 */
export async function loginAsBuyer(): Promise<void> {
  // If already authenticated, skip login entirely
  try {
    await expect(element(by.id('tab-discover'))).toBeVisible();
    return;
  } catch {}
  await navigateToLoginScreen();
  await submitLoginForm(BUYER.email, BUYER.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
  // Dismiss system dialogs that appear AFTER authentication
  await dismissSystemDialogs();
  // Dismiss any badge celebration modal that may have auto-triggered
  await dismissBadgeCelebration();
}

/**
 * Completes the full login flow as the test seller.
 * Waits for the Discover tab to confirm successful login,
 * then dismisses any post-auth system dialogs.
 * Skips login if already authenticated (tab-discover visible).
 */
export async function loginAsSeller(): Promise<void> {
  // If already authenticated, skip login entirely
  try {
    await expect(element(by.id('tab-discover'))).toBeVisible();
    return;
  } catch {}
  await navigateToLoginScreen();
  await submitLoginForm(SELLER.email, SELLER.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
  // Dismiss system dialogs that appear AFTER authentication
  await dismissSystemDialogs();
  // Dismiss any badge celebration modal that may have auto-triggered
  await dismissBadgeCelebration();
}

/**
 * Completes the full login flow as the free (non-subscriber) test user.
 * Waits for the Discover tab to confirm successful login,
 * then dismisses any post-auth system dialogs.
 * Skips login if already authenticated (tab-discover visible).
 */
export async function loginAsFree(): Promise<void> {
  // If already authenticated, skip login entirely
  try {
    await expect(element(by.id('tab-discover'))).toBeVisible();
    return;
  } catch {}
  await navigateToLoginScreen();
  await submitLoginForm(FREE.email, FREE.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
  // Dismiss system dialogs that appear AFTER authentication
  await dismissSystemDialogs();
  // Dismiss any badge celebration modal that may have auto-triggered
  await dismissBadgeCelebration();
}

/**
 * Completes the full login flow as test seller #2 (second seller).
 * Waits for the Discover tab to confirm successful login,
 * then dismisses any post-auth system dialogs.
 * Skips login if already authenticated (tab-discover visible).
 */
export async function loginAsSeller2(): Promise<void> {
  // If already authenticated, skip login entirely
  try {
    await expect(element(by.id('tab-discover'))).toBeVisible();
    return;
  } catch {}
  await navigateToLoginScreen();
  await submitLoginForm(SELLER_2.email, SELLER_2.password);
  await waitFor(element(by.id('tab-discover')))
    .toBeVisible()
    .withTimeout(15000);
  // Dismiss system dialogs that appear AFTER authentication
  await dismissSystemDialogs();
  // Dismiss any badge celebration modal that may have auto-triggered
  await dismissBadgeCelebration();
}
