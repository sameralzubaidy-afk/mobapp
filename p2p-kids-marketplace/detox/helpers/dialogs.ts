/// <reference types="detox" />

/**
 * Dismisses known iOS system dialogs that interrupt test flows.
 * Equivalent to the Maestro tfv2-dismiss-system-dialogs.yaml helper.
 *
 * Safe to call even when no dialogs are visible — every dismiss is
 * wrapped in try/catch so a missing dialog never throws.
 *
 * Call this in beforeAll(), right after device.launchApp().
 */
/**
 * Dismisses the in-app Badge Celebration modal ("🎉 New Badge Earned! 🎉").
 * This modal auto-appears on the Profile screen when a new badge is awarded
 * via real-time Supabase subscription (e.g., after trade completion or seed).
 *
 * Safe to call even if no badge modal is visible — wrapped in try/catch.
 */
export async function dismissBadgeCelebration(): Promise<void> {
  try {
    // Tap the "Awesome!" button by its testID
    await element(by.id('celebration-close-button')).tap();
    await new Promise(r => setTimeout(r, 500));
  } catch {}
}

/**
 * Dismisses known iOS system dialogs that interrupt test flows.
 * Equivalent to the Maestro tfv2-dismiss-system-dialogs.yaml helper.
 *
 * Safe to call even when no dialogs are visible — every dismiss is
 * wrapped in try/catch so a missing dialog never throws.
 *
 * Call this in beforeAll(), right after device.launchApp().
 */
export async function dismissSystemDialogs(): Promise<void> {
  const tryDismissLabel = async (label: string) => {
    try {
      await element(by.label(label)).tap();
      await new Promise(r => setTimeout(r, 300));
    } catch {}
  };

  const tryDismissText = async (text: string) => {
    try {
      await element(by.text(text)).tap();
      await new Promise(r => setTimeout(r, 300));
    } catch {}
  };

  // iOS "Save Password?" sheet
  await tryDismissLabel('Not Now');
  await tryDismissText('Not Now');

  // iOS "Use Existing?" (password replacement sheet)
  await tryDismissLabel('Use Existing?');

  // iOS "Sign in with Apple" prompt
  await tryDismissLabel('Cancel');

  // iOS Push Notification permission
  await tryDismissLabel("Don't Allow");

  // iOS Location permission
  await tryDismissLabel("Don't Allow");

  // App-level update prompt (if any)
  await tryDismissText('Later');
}

/**
 * Dismisses an element by testID if it is visible within a given timeout.
 * If the element is not visible, it silently continues.
 *
 * Use this for any optional UI that sometimes appears and can block test
 * assertions: celebration modals, tooltip overlays, recent searches panels,
 * system dialogs that may or may not show, etc.
 *
 * @param elementId - The testID of the element to dismiss
 * @param timeout  - How long to wait for it to appear (default 2000ms)
 */
export async function dismissIfVisible(elementId: string, timeout = 2000): Promise<void> {
  try {
    await waitFor(element(by.id(elementId)))
      .toBeVisible()
      .withTimeout(timeout);
    await element(by.id(elementId)).tap();
    await new Promise(r => setTimeout(r, 300));
  } catch {
    // Not visible — no action needed
  }
}
