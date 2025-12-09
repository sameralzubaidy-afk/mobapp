/**
 * Simple Detox E2E - smoke test
 */
describe('App E2E', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('shows Home Feed', async () => {
    await expect(element(by.text('Home Feed'))).toBeVisible();
  });
});
