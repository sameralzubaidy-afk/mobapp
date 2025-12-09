/**
 * Detox E2E: detent / sanitizer smoke test
 */
describe('Detent Sanitizer E2E', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('navigates to DetentTest and asserts sanitizer output', async () => {
    await expect(element(by.text('Home Feed'))).toBeVisible();

    // Tap the button to open the detent test screen
    await element(by.id('open-detent-test')).tap();

    await expect(element(by.id('detent-test-screen'))).toBeVisible();

    // Sanitizer currently maps 'lg' -> 24
    await expect(element(by.id('sanitized-width'))).toHaveText('24');

    // Detent values should be preserved as strings
    await expect(element(by.id('sanitized-sheetAllowedDetents'))).toHaveText('large');
  });
});
