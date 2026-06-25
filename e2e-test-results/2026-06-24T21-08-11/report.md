# TradeFlowV2 Automated Run — 2026-06-25T02:31:20.046Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 119 |
| ✅ Passed | 0 |
| ❌ Failed | 119 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 26 |

## ❌ Failures (investigate before manual QA)

### REG-R01, REG-R03, REG-R04, TC-J01, TC-J02, TC-J03, TC-J04, TC-J05, TC-K01, TC-K02, TC-K03, TC-L01, TC-L02, TC-L03, TC-L04, TC-L05, TC-L06, TC-L07, TC-L08, TC-R05, TC-R06 — maestro (ios)
- Asset: `trade-tfv2-023-addenda.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml`
- Duration: 76.8s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-tfv2-023-addenda (1m 3s) (Assertion is false: id: tab-me is visible)

1/1 Flow Failed


```

### REG-R02, TC-A04, TC-B01, TC-B03, TC-B04, TC-B05, TC-R01, TC-R02, TC-R13 — maestro (ios)
- Asset: `trade-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`
- Duration: 1107.5s · Attempts: 2 · ⏱️ TIMED OUT
```

Waiting for flows to complete...
[Failed] trade-flow (18m 18s)

1/1 Flow Failed


```

### REG-R05, TC-D01, TC-D02, TC-D03, TC-D04, TC-D05 — maestro (ios)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 35.9s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-flow-08-trade-v2-components (12s) (Unable to set permissions for app com.sameralzubaidi.p2pmarketplace: Failed to connect to /127.0.0.1:49376)

1/1 Flow Failed


```

### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — maestro (ios)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 846.2s · Attempts: 2 · ⏱️ TIMED OUT
```


```

### REG-R08, TC-C07, TC-C08 — maestro (ios)
- Asset: `checkout-sp-cap.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`
- Duration: 980.8s · Attempts: 2 · ⏱️ TIMED OUT
```
	at xcuitest.XCTestDriverClient.restartXCTestRunner(XCTestDriverClient.kt:59)
	at ios.xctest.XCTestIOSDevice.open(XCTestIOSDevice.kt:26)
	at ios.LocalIOSDevice.open(LocalIOSDevice.kt:27)
	at maestro.drivers.IOSDriver.open$lambda$3(IOSDriver.kt:79)
	at maestro.utils.Metrics.measured(Metrics.kt:48)
	at maestro.utils.Metrics.measured$default(Metrics.kt:42)
	at maestro.drivers.IOSDriver.open(IOSDriver.kt:78)
	at maestro.Maestro$Companion.ios(Maestro.kt:683)
	at maestro.cli.session.MaestroSessionManager.createIOS(MaestroSessionManager.kt:447)
	at maestro.cli.session.MaestroSessionManager.createMaestro(MaestroSessionManager.kt:218)
	at maestro.cli.session.MaestroSessionManager.newSession(MaestroSessionManager.kt:109)
	at maestro.cli.session.MaestroSessionManager.newSession$default(MaestroSessionManager.kt:67)
	at maestro.cli.command.TestCommand.runShardSuite(TestCommand.kt:479)
	at maestro.cli.command.TestCommand.access$runShardSuite(TestCommand.kt:81)
	at maestro.cli.command.TestCommand$handleSessions$1$results$1$1.invokeSuspend(TestCommand.kt:438)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100)
	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124)
	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89)
	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:820)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:704)


```

### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 101.0s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (27s)

1/1 Flow Failed


```

### TC-E05, TC-R10 — playwright
- Asset: `__tests__/e2e/trade-disputes.e2e.test.ts` (grep: `resolve.*complete`)
- Command: `npx playwright test __tests__/e2e/trade-disputes.e2e.test.ts -g resolve.*complete`
- Duration: 143.6s · Attempts: 2
```
    Call log:
    [2m  - waiting for locator('input[type="password"], input[name="password"]').first()[22m
    [2m    - locator resolved to <input value="" required="" id="password" type="password" name="password" placeholder="Password" autocomplete="current-password" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"/>[22m


      35 |     }
      36 |     await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
    > 37 |     await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASSWORD);
         |                                                                                  ^
      38 |     await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
      39 |     await page.waitForLoadState('networkidle');
      40 |     await page.goto(route);
        at ensureAdminSession (/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/trade-disputes.e2e.test.ts:37:82)
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/trade-disputes.e2e.test.ts:59:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-trade-disputes.e2e-Adm-4e10d-seller-fulfilled-correctly--chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-trade-disputes.e2e-Adm-4e10d-seller-fulfilled-correctly--chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/trade-disputes.e2e.test.ts:58:7 › Admin Dispute Resolution (TC-E05 / TC-E06 / TC-R09 / TC-R10) › TC-E05 / TC-R10 — Admin resolves dispute → Complete (seller fulfilled correctly) 

```

### TC-E06, TC-R09 — playwright
- Asset: `__tests__/e2e/trade-disputes.e2e.test.ts` (grep: `resolve.*refund`)
- Command: `npx playwright test __tests__/e2e/trade-disputes.e2e.test.ts -g resolve.*refund`
- Duration: 21.3s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 8000ms[22m
    [2m  - waiting for locator('table tbody tr, [data-testid*="dispute-row"]').first()[22m


      106 |
      107 |     const firstDisputeRow = page.locator('table tbody tr, [data-testid*="dispute-row"]').first();
    > 108 |     await expect(firstDisputeRow).toBeVisible({ timeout: 8_000 });
          |                                   ^
      109 |
      110 |     const resolveRefundBtn = firstDisputeRow
      111 |       .locator('button:has-text("Resolve → Refund"), button:has-text("Resolve Refund")')
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/trade-disputes.e2e.test.ts:108:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-trade-disputes.e2e-Adm-feafb-te-→-Refund-buyer-refunded--chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-trade-disputes.e2e-Adm-feafb-te-→-Refund-buyer-refunded--chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/trade-disputes.e2e.test.ts:103:7 › Admin Dispute Resolution (TC-E05 / TC-E06 / TC-R09 / TC-R10) › TC-E06 / TC-R09 — Admin resolves dispute → Refund (buyer refunded) 

```

### TC-F01, TC-F02, TC-F03, TC-R08 — maestro (ios)
- Asset: `module-15.1-flow-22-payouts.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`
- Duration: 1097.5s · Attempts: 2 · ⏱️ TIMED OUT
```

Waiting for flows to complete...

```

### TC-G04 — maestro (ios)
- Asset: `trade-notifications.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml`
- Duration: 63.3s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-notifications (47s)

1/1 Flow Failed


```

### TC-I01, TC-I02, TC-I03, TC-I04, TC-I05 — maestro (ios)
- Asset: `liability-disclaimer-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml`
- Duration: 985.4s · Attempts: 2 · ⏱️ TIMED OUT
```

Waiting for flows to complete...

```

### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — maestro (ios)
- Asset: `cart-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`
- Duration: 443.0s · Attempts: 2
```

Waiting for flows to complete...
[Failed] cart-flow (6m 49s)

1/1 Flow Failed


```

### TC-N01 — playwright
- Asset: `__tests__/e2e/cart-admin-config.e2e.test.ts` (grep: `minimum cart value`)
- Command: `npx playwright test __tests__/e2e/cart-admin-config.e2e.test.ts -g minimum cart value`
- Duration: 33.6s · Attempts: 2
```
    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('cart-min-value-input')[22m


      83 |   test('TC-N02 — rejects a negative minimum cart value', async ({ page }) => {
      84 |     const minValueInput = page.getByTestId('cart-min-value-input');
    > 85 |     await expect(minValueInput).toBeVisible({ timeout: 10_000 });
         |                                 ^
      86 |
      87 |     // Enter negative value.
      88 |     await minValueInput.fill('-1');
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/cart-admin-config.e2e.test.ts:85:33

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-cart-admin-config.e2e--8d1b6-negative-minimum-cart-value-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-cart-admin-config.e2e--8d1b6-negative-minimum-cart-value-chromium/error-context.md


[1A[2K  2 failed
    [chromium] › __tests__/e2e/cart-admin-config.e2e.test.ts:52:7 › Cart Admin Config (TC-N01 / TC-N02) › TC-N01 — saves minimum cart value and displays the new value 
    [chromium] › __tests__/e2e/cart-admin-config.e2e.test.ts:83:7 › Cart Admin Config (TC-N01 / TC-N02) › TC-N02 — rejects a negative minimum cart value 

```

### TC-N02 — playwright
- Asset: `__tests__/e2e/cart-admin-config.e2e.test.ts` (grep: `validation`)
- Command: `npx playwright test __tests__/e2e/cart-admin-config.e2e.test.ts -g validation`
- Duration: 700.1s · Attempts: 2 · ⏱️ TIMED OUT
```
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('cart-max-saved-carts-input')[22m


      106 |   test('TC-N02 (extra) — max saved carts below 1 shows validation error', async ({ page }) => {
      107 |     const input = page.getByTestId('cart-max-saved-carts-input');
    > 108 |     await expect(input).toBeVisible({ timeout: 10_000 });
          |                         ^
      109 |
      110 |     await input.fill('0');
      111 |     await page.locator('button:has-text("Save"), button:has-text("Save Settings")').first().click();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/cart-admin-config.e2e.test.ts:108:25

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-cart-admin-config.e2e--2edc0-ow-1-shows-validation-error-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-cart-admin-config.e2e--2edc0-ow-1-shows-validation-error-chromium/error-context.md


[1A[2K  Slow test file: [chromium] › __tests__/e2e/cart-admin-config.e2e.test.ts (11.6m)
  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel
  1 failed
    [chromium] › __tests__/e2e/cart-admin-config.e2e.test.ts:106:7 › Cart Admin Config (TC-N01 / TC-N02) › TC-N02 (extra) — max saved carts below 1 shows validation error 

```

### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — maestro (ios)
- Asset: `tax-checkout.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`
- Duration: 1110.8s · Attempts: 2 · ⏱️ TIMED OUT
```

Waiting for flows to complete...

```

### TC-P01 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `node tax rate`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g node tax rate`
- Duration: 14.1s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


      51 |
      52 |     await expect(page.getByTestId('tax-nodes-page')).toBeVisible({ timeout: 10_000 });
    > 53 |     await expect(page.getByTestId('tax-nodes-table')).toBeVisible();
         |                                                                 ^
      54 |
      55 |     // At least one node row should exist.
      56 |     const firstRow = page.locator('[data-testid^="tax-node-row-"]').first();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:53:65

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-56c3c-ig-view-edit-and-validation-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-56c3c-ig-view-edit-and-validation-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:49:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P01 — node tax rate config: view, edit, and validation 

```

### TC-P02 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `bulk`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g bulk`
- Duration: 18.9s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


       96 |     await page.waitForTimeout(300);
       97 |
    >  98 |     const rows = page.locator('[data-testid^="tax-node-row-"]');
          |                                                                 ^
       99 |     const rowCount = await rows.count();
      100 |     expect(rowCount).toBeGreaterThan(0);
      101 |
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:98:65

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-7be32-pply-a-rate-to-visible-rows-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-7be32-pply-a-rate-to-visible-rows-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:94:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P02 — bulk tax update: filter nodes then apply a rate to visible rows 

```

### TC-P03 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `history|audit`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g history|audit`
- Duration: 18.5s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


      120 |     await firstRow.locator('button:has-text("Save"), button:has-text("Update")').first().click();
      121 |     await page.waitForTimeout(1_000);
    > 122 |
          | ^
      123 |     // Verify the page reflects the saved rate (reloads after save per the component).
      124 |     const reloaded = firstRow.locator('input[type="number"]').first();
      125 |     const savedRate = await reloaded.inputValue();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:122:65

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-4b815-recorded-in-the-audit-trail-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-4b815-recorded-in-the-audit-trail-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:118:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P03 — tax rate change is recorded in the audit trail 

```

### TC-P04 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `global`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g global`
- Duration: 650.0s · Attempts: 2 · ⏱️ TIMED OUT
```
    [2m  - navigating to "http://localhost:3001/tax/settings", waiting until "load"[22m


      37 |     await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
      38 |     await page.waitForLoadState('networkidle');
    > 39 |     await page.goto(route);
         |                ^
      40 |     await page.waitForLoadState('networkidle');
      41 |   }
      42 | }
        at ensureAdminSession (/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:39:16)
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:150:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-da330-le-off-shows-warning-banner-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-da330-le-off-shows-warning-banner-chromium/error-context.md


[1A[2K  Slow test file: [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts (10.8m)
  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel
  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:147:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P04 — global tax toggle off shows warning banner 

```

### TC-P05 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `dashboard|summary`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g dashboard|summary`
- Duration: 21.9s · Attempts: 2
```

    Call log:
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    14 × unexpected value "http://localhost:3001/auth/login"[22m


      194 |     // TC-P05 Expected: summary figures appear after load.
      195 |     await expect(
    > 196 |       page.locator('text=/Total Tax Collected|tax_collected|\\$/, [data-testid*="summary"]').first()
          |                                   ^
      197 |     ).toBeVisible({ timeout: 12_000 });
      198 |   });
      199 |
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:196:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-8be4e-mary-cards-and-date-presets-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-8be4e-mary-cards-and-date-presets-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:192:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P05 — tax reporting dashboard loads summary cards and date presets 

```

### TC-P06 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `jurisdiction`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g jurisdiction`
- Duration: 15.2s · Attempts: 2
```

    Call log:
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    13 × unexpected value "http://localhost:3001/auth/login"[22m


      225 |     await expect(page).toHaveURL(/\/tax\/reports/, { timeout: 10_000 });
      226 |
    > 227 |     // Run a report first so there is data to export.
          |                                   ^
      228 |     const runBtn = page.locator('button:has-text("Run"), button:has-text("Generate"), button:has-text("Apply")').first();
      229 |     await runBtn.click();
      230 |     await page.waitForTimeout(2_000);
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:227:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-bab5b-all-report-types-selectable-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-bab5b-all-report-types-selectable-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:223:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P06 — jurisdiction breakdown table appears; all report types selectable 

```

### TC-P07 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `csv|export`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g csv|export`
- Duration: 638.6s · Attempts: 2 · ⏱️ TIMED OUT
```
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    12 × unexpected value "http://localhost:3001/auth/login"[22m


      252 |     const origRate = await rateInput.inputValue();
      253 |     const newRate = origRate === '6.35' ? '7.50' : '6.35';
    > 254 |
          | ^
      255 |     await rateInput.fill(newRate);
      256 |     const saveBtn = page.locator('button:has-text("Save")').first();
      257 |     await saveBtn.click();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:254:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-749ac-on-triggers-a-file-download-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-749ac-on-triggers-a-file-download-chromium/error-context.md


[1A[2K  Slow test file: [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts (10.6m)
  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel
  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:250:18 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P07 — CSV export button triggers a file download 

```

### TC-P08 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `new transactions`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g new transactions`
- Duration: 0.9s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q18 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts`
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts`
- Duration: 2.1s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q19 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts` (grep: `approve|unhide`)
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts -g approve|unhide`
- Duration: 1.9s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q20 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts` (grep: `delete`)
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts -g delete`
- Duration: 2.6s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

## ⏭️ Coverage gaps (not executed)

| Case | Status | Reason |
|---|---|---|
| TC-B02 | manual | Requires clock fast-forward to expiry window not controllable from the app UI. |
| TC-B06 | manual | Requires Stripe test decline card path; not deterministic from UI without a seeded decline fixture. |
| TC-C03 | manual | Needs clock fast-forward to expiry. |
| TC-G01 | manual | Scheduled push delivery not observable in simulator; deep-link target verified separately. |
| TC-G02 | manual | Scheduled push delivery not observable in simulator. |
| TC-G03 | manual | Throttle window is server-side; not deterministic from UI. |
| TC-M13 | manual | Requires a second actor to mutate availability while the cart screen is open (realtime). Not deterministic single-device. |
| TC-Q11 | manual | Requires a review aged >24h (clock control). |
| TC-Q13 | manual | Requires a recent review within 30 days across two trades (time + data). |
| TC-Q14 | manual | Requires clock control around completion time. |
| TC-Q16 | manual | Requires 3 distinct reporters; backend threshold effect. |
| TC-R03 | manual | Requires clock fast-forward to expiry. |
| TC-R04 | manual | Requires Stripe decline-card fixture. |
| TC-R11 | manual | Push delivery not observable in simulator. |
| TC-R12 | manual | Idempotency is a backend invariant; verify via integration tests, not UI. |

## ❌ Challenges & Recommendations

### Failure Pattern Analysis

| Pattern | Count | % of Failures |
|---|---|---|
| ⏱️ Timeout | 9 | 35% |
| ❓ Other | 17 | 65% |

### Duration & Performance

- Total execution time: 152.2 min
- Average per unit: 351.2s
- Slowest passing unit: N/A
- Slowest failing unit: 18.5m 31s

### Failure Details

#### REG-R01, REG-R03, REG-R04, TC-J01, TC-J02, TC-J03, TC-J04, TC-J05, TC-K01, TC-K02, TC-K03, TC-L01, TC-L02, TC-L03, TC-L04, TC-L05, TC-L06, TC-L07, TC-L08, TC-R05, TC-R06 — trade-tfv2-023-addenda.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 76.8s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml`

#### REG-R02, TC-A04, TC-B01, TC-B03, TC-B04, TC-B05, TC-R01, TC-R02, TC-R13 — trade-flow.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 1107.5s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`

#### REG-R05, TC-D01, TC-D02, TC-D03, TC-D04, TC-D05 — module-15.1.2-flow-08-trade-v2-components.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 35.9s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`

#### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — swap-points-wallet.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 846.2s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`

#### REG-R08, TC-C07, TC-C08 — checkout-sp-cap.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 980.8s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`

#### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — module-15.1.2-full-trade-flow-v2.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 101.0s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`

#### TC-E05, TC-R10 — __tests__/e2e/trade-disputes.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 143.6s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/trade-disputes.e2e.test.ts -g resolve.*complete`

#### TC-E06, TC-R09 — __tests__/e2e/trade-disputes.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 21.3s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/trade-disputes.e2e.test.ts -g resolve.*refund`

#### TC-F01, TC-F02, TC-F03, TC-R08 — module-15.1-flow-22-payouts.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 1097.5s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`

#### TC-G04 — trade-notifications.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 63.3s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml`

#### TC-I01, TC-I02, TC-I03, TC-I04, TC-I05 — liability-disclaimer-flow.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 985.4s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml`

#### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — cart-flow.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 443.0s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`

#### TC-N01 — __tests__/e2e/cart-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 33.6s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/cart-admin-config.e2e.test.ts -g minimum cart value`

#### TC-N02 — __tests__/e2e/cart-admin-config.e2e.test.ts (web)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 700.1s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `npx playwright test __tests__/e2e/cart-admin-config.e2e.test.ts -g validation`

#### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — tax-checkout.yaml (ios)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 1110.8s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`

#### TC-P01 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 14.1s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g node tax rate`

#### TC-P02 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 18.9s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g bulk`

#### TC-P03 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 18.5s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g history|audit`

#### TC-P04 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 650.0s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g global`

#### TC-P05 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 21.9s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g dashboard|summary`

#### TC-P06 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 15.2s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g jurisdiction`

#### TC-P07 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** ⏱️ Command timed out — likely a missing testID or slow data load
- **Duration:** 638.6s · **Attempts:** 2 · ⏱️ TIMED OUT
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g csv|export`

#### TC-P08 — __tests__/e2e/tax-admin-config.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 0.9s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g new transactions`

#### TC-Q18 — __tests__/review-moderation.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 2.1s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/review-moderation.e2e.test.ts`

#### TC-Q19 — __tests__/review-moderation.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 1.9s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/review-moderation.e2e.test.ts -g approve|unhide`

#### TC-Q20 — __tests__/review-moderation.e2e.test.ts (web)
- **Root cause:** Unknown
- **Duration:** 2.6s · **Attempts:** 2
- **Command:** `npx playwright test __tests__/review-moderation.e2e.test.ts -g delete`

### Recommendations for Future Enhancements

| # | Recommendation | Priority |
|---|---|---|
| 2 | Increase `TFV2_TIMEOUT_MS` or add `extendedWaitUntil` with longer timeouts for slow network responses. | High |
| 4 | 15 cases skipped (manual/pending). Prioritize automation for high-value flows. | Medium |
| 5 | Consider adding a pre-run data integrity check to verify seeded data exists before starting. | Medium |
| 6 | If flakiness persists, implement per-case retry with exponential backoff in the orchestrator. | Low |
| 7 | Review screenshots in `screenshots/` folder to visually confirm UI state at failure point. | Low |

