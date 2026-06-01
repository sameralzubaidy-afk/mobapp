# TradeFlowV2 Automated Run — 2026-06-01T00:45:25.087Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 119 |
| ✅ Passed | 0 |
| ❌ Failed | 119 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 37 |

## ❌ Failures (investigate before manual QA)

### REG-R01, REG-R03, REG-R04, TC-J01, TC-J02, TC-J03, TC-J04, TC-J05, TC-K01, TC-K02, TC-K03, TC-L01, TC-L02, TC-L03, TC-L04, TC-L05, TC-L06, TC-L07, TC-L08, TC-R05, TC-R06 — maestro (ios)
- Asset: `trade-tfv2-023-addenda.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml`
- Duration: 2.2s · Attempts: 2
```
> Invalid Command: clearText

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml:35
╭───────────────────────────────────────────────────────╮
│ 33 | - tapOn:                                         │
│ 34 |     id: "login-email-input"                      │
│ 35 | - clearText                                      │
│                ^                                      │
│ ╭───────────────────────────────────────────────────╮ │
│ │ `clearText` is not a valid command.               │ │
│ │                                                   │ │
│ │ > https://docs.maestro.dev/api-reference/commands │ │
│ ╰───────────────────────────────────────────────────╯ │
│ 36 | - inputText: "test-seller@kidsmarketplace.test"  │
│ 37 | - tapOn:                                         │
╰───────────────────────────────────────────────────────╯

```

### REG-R01, REG-R03, REG-R04, TC-J01, TC-J02, TC-J03, TC-J04, TC-J05, TC-K01, TC-K02, TC-K03, TC-L01, TC-L02, TC-L03, TC-L04, TC-L05, TC-L06, TC-L07, TC-L08, TC-R05, TC-R06 — maestro (android)
- Asset: `trade-tfv2-023-addenda.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml`
- Duration: 2.1s · Attempts: 2
```
> Invalid Command: clearText

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml:35
╭───────────────────────────────────────────────────────╮
│ 33 | - tapOn:                                         │
│ 34 |     id: "login-email-input"                      │
│ 35 | - clearText                                      │
│                ^                                      │
│ ╭───────────────────────────────────────────────────╮ │
│ │ `clearText` is not a valid command.               │ │
│ │                                                   │ │
│ │ > https://docs.maestro.dev/api-reference/commands │ │
│ ╰───────────────────────────────────────────────────╯ │
│ 36 | - inputText: "test-seller@kidsmarketplace.test"  │
│ 37 | - tapOn:                                         │
╰───────────────────────────────────────────────────────╯

```

### REG-R02, TC-A04, TC-B01, TC-B03, TC-B04, TC-B05, TC-R01, TC-R02, TC-R13 — maestro (ios)
- Asset: `trade-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`
- Duration: 16.0s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-flow (1s) (Unable to launch app com.p2pkidsmarketplace)

1/1 Flow Failed


```

### REG-R02, TC-A04, TC-B01, TC-B03, TC-B04, TC-B05, TC-R01, TC-R02, TC-R13 — maestro (android)
- Asset: `trade-flow.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`
- Duration: 37.8s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-flow (11s) (Unable to launch app com.p2pkidsmarketplace)

1/1 Flow Failed


```

### REG-R05, TC-D01, TC-D02, TC-D03, TC-D04, TC-D05 — maestro (ios)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 15.1s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-flow-08-trade-v2-components (2s) (Unable to launch app host.exp.exponent)

1/1 Flow Failed


```

### REG-R05, TC-D01, TC-D02, TC-D03, TC-D04, TC-D05 — maestro (android)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 62.1s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-flow-08-trade-v2-components (50s) (Assertion is false: id: preview-offer-countdown-critical is visible)

1/1 Flow Failed


```

### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — maestro (ios)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 10.2s · Attempts: 2
```

Waiting for flows to complete...
[Failed] swap-points-wallet (1s) (Unable to launch app com.anonymous.p2p-kids-marketplace)

1/1 Flow Failed


```

### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — maestro (android)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 12.2s · Attempts: 2
```

Waiting for flows to complete...
[Failed] swap-points-wallet (1s) (Unable to launch app com.anonymous.p2p-kids-marketplace)

1/1 Flow Failed


```

### REG-R08, TC-C07, TC-C08 — maestro (ios)
- Asset: `checkout-sp-cap.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`
- Duration: 2.0s · Attempts: 2
```
Failed to parse file: /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml
List is empty.

```

### REG-R08, TC-C07, TC-C08 — maestro (android)
- Asset: `checkout-sp-cap.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`
- Duration: 2.7s · Attempts: 2
```
Failed to parse file: /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml
List is empty.

```

### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 9.0s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (1s)

1/1 Flow Failed


```

### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — maestro (android)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 9.1s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (1s) (Unable to launch app com.p2pkidsmarketplace)

1/1 Flow Failed


```

### TC-E05, TC-R10 — playwright
- Asset: `__tests__/e2e/trade-disputes.e2e.test.ts` (grep: `resolve.*complete`)
- Command: `npx playwright test __tests__/e2e/trade-disputes.e2e.test.ts -g resolve.*complete`
- Duration: 12.5s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 8000ms[22m
    [2m  - waiting for locator('table tbody tr, [data-testid*="dispute-row"]').first()[22m


      62 |     // TC-E05 Expected: The dispute queue renders with at least one row.
      63 |     const firstDisputeRow = page.locator('table tbody tr, [data-testid*="dispute-row"]').first();
    > 64 |     await expect(firstDisputeRow).toBeVisible({ timeout: 8_000 });
         |                                   ^
      65 |
      66 |     // Navigate to the first dispute's detail page, or use inline action buttons.
      67 |     const resolveCompleteBtn = firstDisputeRow
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/trade-disputes.e2e.test.ts:64:35

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
- Duration: 12.5s · Attempts: 2
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
- Duration: 2.0s · Attempts: 2
```
> Unknown Property: testID

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml:-1
╭───────────────────────────────────────────────────────╮
│ 1 | # FLOW-22: Payout Settings Redesign | MODULE-15.1 │
╰───────────────────────────────────────────────────────╯

```

### TC-F01, TC-F02, TC-F03, TC-R08 — maestro (android)
- Asset: `module-15.1-flow-22-payouts.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`
- Duration: 2.0s · Attempts: 2
```
> Unknown Property: testID

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml:-1
╭───────────────────────────────────────────────────────╮
│ 1 | # FLOW-22: Payout Settings Redesign | MODULE-15.1 │
╰───────────────────────────────────────────────────────╯

```

### TC-G04 — maestro (ios)
- Asset: `trade-notifications.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml`
- Duration: 2.1s · Attempts: 2
```
> Invalid Command: scrollTo

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml:107
╭────────────────────────────────────────────────────────────────────────────────────────╮
│ 105 | # ────────────────────────────────────────────────────────────────────────────── │
│ 106 |                                                                                  │
│ 107 | - scrollTo:                                                                      │
│               ^                                                                        │
│ ╭────────────────────────────────────╮                                                 │
│ │ `scrollTo` is not a valid command. │                                                 │
│ │                                    │                                                 │
│ │ Did you mean `scroll`?             │                                                 │
│ ╰────────────────────────────────────╯                                                 │
│ 108 |     id: "notification-item-trade_rejected"                                       │
│ 109 | - assertVisible:                                                                 │
╰────────────────────────────────────────────────────────────────────────────────────────╯

```

### TC-G04 — maestro (android)
- Asset: `trade-notifications.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml`
- Duration: 2.0s · Attempts: 2
```
> Invalid Command: scrollTo

/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml:107
╭────────────────────────────────────────────────────────────────────────────────────────╮
│ 105 | # ────────────────────────────────────────────────────────────────────────────── │
│ 106 |                                                                                  │
│ 107 | - scrollTo:                                                                      │
│               ^                                                                        │
│ ╭────────────────────────────────────╮                                                 │
│ │ `scrollTo` is not a valid command. │                                                 │
│ │                                    │                                                 │
│ │ Did you mean `scroll`?             │                                                 │
│ ╰────────────────────────────────────╯                                                 │
│ 108 |     id: "notification-item-trade_rejected"                                       │
│ 109 | - assertVisible:                                                                 │
╰────────────────────────────────────────────────────────────────────────────────────────╯

```

### TC-I01, TC-I02, TC-I03, TC-I04, TC-I05 — maestro (ios)
- Asset: `liability-disclaimer-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml`
- Duration: 9.9s · Attempts: 2
```

Waiting for flows to complete...
[Failed] liability-disclaimer-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-I01, TC-I02, TC-I03, TC-I04, TC-I05 — maestro (android)
- Asset: `liability-disclaimer-flow.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml`
- Duration: 10.5s · Attempts: 2
```

Waiting for flows to complete...
[Failed] liability-disclaimer-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — maestro (ios)
- Asset: `cart-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`
- Duration: 9.8s · Attempts: 2
```

Waiting for flows to complete...
[Failed] cart-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — maestro (android)
- Asset: `cart-flow.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`
- Duration: 10.4s · Attempts: 2
```

Waiting for flows to complete...
[Failed] cart-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-N01 — playwright
- Asset: `__tests__/e2e/cart-admin-config.e2e.test.ts` (grep: `minimum cart value`)
- Command: `npx playwright test __tests__/e2e/cart-admin-config.e2e.test.ts -g minimum cart value`
- Duration: 28.4s · Attempts: 2
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
- Duration: 14.5s · Attempts: 2
```

    Call log:
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


[1A[2K  1 failed
    [chromium] › __tests__/e2e/cart-admin-config.e2e.test.ts:106:7 › Cart Admin Config (TC-N01 / TC-N02) › TC-N02 (extra) — max saved carts below 1 shows validation error 

```

### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — maestro (ios)
- Asset: `tax-checkout.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`
- Duration: 0.0s · Attempts: 0
```
Missing flow asset: /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml
```

### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — maestro (android)
- Asset: `tax-checkout.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`
- Duration: 0.0s · Attempts: 0
```
Missing flow asset: /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml
```

### TC-P01 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `node tax rate`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g node tax rate`
- Duration: 16.5s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


      50 |     await ensureAdminSession(page, '/tax/nodes');
      51 |
    > 52 |     await expect(page.getByTestId('tax-nodes-page')).toBeVisible({ timeout: 10_000 });
         |                                                      ^
      53 |     await expect(page.getByTestId('tax-nodes-table')).toBeVisible();
      54 |
      55 |     // At least one node row should exist.
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:52:54

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-56c3c-ig-view-edit-and-validation-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-56c3c-ig-view-edit-and-validation-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:49:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P01 — node tax rate config: view, edit, and validation 

```

### TC-P02 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `bulk`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g bulk`
- Duration: 14.6s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


      89 |     await ensureAdminSession(page, '/tax/nodes');
      90 |
    > 91 |     await expect(page.getByTestId('tax-nodes-page')).toBeVisible({ timeout: 10_000 });
         |                                                      ^
      92 |
      93 |     // Filter to a known node name substring (or leave empty for all).
      94 |     const filterInput = page.getByTestId('tax-nodes-filter');
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:91:54

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-7be32-pply-a-rate-to-visible-rows-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-7be32-pply-a-rate-to-visible-rows-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:88:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P02 — bulk tax update: filter nodes then apply a rate to visible rows 

```

### TC-P03 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `history|audit`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g history|audit`
- Duration: 14.5s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-nodes-page')[22m


      110 |   test('TC-P03 — tax rate change is recorded in the audit trail', async ({ page }) => {
      111 |     await ensureAdminSession(page, '/tax/nodes');
    > 112 |     await expect(page.getByTestId('tax-nodes-page')).toBeVisible({ timeout: 10_000 });
          |                                                      ^
      113 |
      114 |     const firstRow = page.locator('[data-testid^="tax-node-row-"]').first();
      115 |     const rateInput = firstRow.locator('input[type="number"]').first();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:112:54

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-4b815-recorded-in-the-audit-trail-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-4b815-recorded-in-the-audit-trail-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:110:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P03 — tax rate change is recorded in the audit trail 

```

### TC-P04 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `global`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g global`
- Duration: 14.8s · Attempts: 2
```

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for getByTestId('tax-settings-page')[22m


      137 |   test('TC-P04 — global tax toggle off shows warning banner', async ({ page }) => {
      138 |     await ensureAdminSession(page, '/tax/settings');
    > 139 |     await expect(page.getByTestId('tax-settings-page')).toBeVisible({ timeout: 10_000 });
          |                                                         ^
      140 |
      141 |     const toggle = page.locator('input[type="checkbox"][name*="enabled"], [data-testid*="tax-enabled"]').first();
      142 |     const isChecked = await toggle.isChecked().catch(() => null);
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:139:57

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-da330-le-off-shows-warning-banner-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-da330-le-off-shows-warning-banner-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:137:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P04 — global tax toggle off shows warning banner 

```

### TC-P05 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `dashboard|summary`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g dashboard|summary`
- Duration: 14.5s · Attempts: 2
```

    Call log:
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    14 × unexpected value "http://localhost:3001/auth/login"[22m


      176 |   test('TC-P05 — tax reporting dashboard loads summary cards and date presets', async ({ page }) => {
      177 |     await ensureAdminSession(page, '/tax/reports');
    > 178 |     await expect(page).toHaveURL(/\/tax\/reports/, { timeout: 10_000 });
          |                        ^
      179 |
      180 |     // Date inputs must be present.
      181 |     const startInput = page.locator('input[type="date"]').nth(0);
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:178:24

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-8be4e-mary-cards-and-date-presets-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-8be4e-mary-cards-and-date-presets-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:176:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P05 — tax reporting dashboard loads summary cards and date presets 

```

### TC-P06 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `jurisdiction`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g jurisdiction`
- Duration: 14.6s · Attempts: 2
```

    Call log:
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    14 × unexpected value "http://localhost:3001/auth/login"[22m


      201 |   test('TC-P06 — jurisdiction breakdown table appears; all report types selectable', async ({ page }) => {
      202 |     await ensureAdminSession(page, '/tax/reports');
    > 203 |     await expect(page).toHaveURL(/\/tax\/reports/, { timeout: 10_000 });
          |                        ^
      204 |
      205 |     const reportTypeSelect = page.locator('select').first();
      206 |     await expect(reportTypeSelect).toBeVisible({ timeout: 5_000 });
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:203:24

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-bab5b-all-report-types-selectable-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-bab5b-all-report-types-selectable-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:201:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P06 — jurisdiction breakdown table appears; all report types selectable 

```

### TC-P07 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `csv|export`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g csv|export`
- Duration: 14.6s · Attempts: 2
```

    Call log:
    [2m  - Expect "toHaveURL" with timeout 10000ms[22m
    [2m    14 × unexpected value "http://localhost:3001/auth/login"[22m


      223 |   test('TC-P07 — CSV export button triggers a file download', async ({ page }) => {
      224 |     await ensureAdminSession(page, '/tax/reports');
    > 225 |     await expect(page).toHaveURL(/\/tax\/reports/, { timeout: 10_000 });
          |                        ^
      226 |
      227 |     // Run a report first so there is data to export.
      228 |     const runBtn = page.locator('button:has-text("Run"), button:has-text("Generate"), button:has-text("Apply")').first();
        at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/__tests__/e2e/tax-admin-config.e2e.test.ts:225:24

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/e2e-tax-admin-config.e2e-T-749ac-on-triggers-a-file-download-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/e2e-tax-admin-config.e2e-T-749ac-on-triggers-a-file-download-chromium/error-context.md


[1A[2K  1 failed
    [chromium] › __tests__/e2e/tax-admin-config.e2e.test.ts:223:7 › Tax Admin Config — Group P (TC-P01 to TC-P08) › TC-P07 — CSV export button triggers a file download 

```

### TC-P08 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `new transactions`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g new transactions`
- Duration: 1.1s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q18 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts`
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts`
- Duration: 0.9s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q19 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts` (grep: `approve|unhide`)
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts -g approve|unhide`
- Duration: 0.9s · Attempts: 2
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.

[1A[2K
```

### TC-Q20 — playwright
- Asset: `__tests__/review-moderation.e2e.test.ts` (grep: `delete`)
- Command: `npx playwright test __tests__/review-moderation.e2e.test.ts -g delete`
- Duration: 0.9s · Attempts: 2
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
