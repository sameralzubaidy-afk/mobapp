# TradeFlowV2 Automated Run — 2026-06-01T00:14:08.609Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 119 |
| ✅ Passed | 13 |
| ❌ Failed | 106 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 26 |

## ❌ Failures (investigate before manual QA)

### REG-R01, REG-R03, REG-R04, TC-J01, TC-J02, TC-J03, TC-J04, TC-J05, TC-K01, TC-K02, TC-K03, TC-L01, TC-L02, TC-L03, TC-L04, TC-L05, TC-L06, TC-L07, TC-L08, TC-R05, TC-R06 — maestro (ios)
- Asset: `trade-tfv2-023-addenda.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-tfv2-023-addenda.yaml`
- Duration: 1.9s · Attempts: 2
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
- Duration: 12.2s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-flow (1s) (Unable to launch app com.p2pkidsmarketplace)

1/1 Flow Failed


```

### REG-R05, TC-D01, TC-D02, TC-D03, TC-D04, TC-D05 — maestro (ios)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 10.0s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-flow-08-trade-v2-components (2s) (Unable to launch app host.exp.exponent)

1/1 Flow Failed


```

### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — maestro (ios)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 9.2s · Attempts: 2
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

### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 8.7s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (1s)

1/1 Flow Failed


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

### TC-G04 — maestro (ios)
- Asset: `trade-notifications.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-notifications.yaml`
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
- Duration: 9.1s · Attempts: 2
```

Waiting for flows to complete...
[Failed] liability-disclaimer-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — maestro (ios)
- Asset: `cart-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`
- Duration: 10.3s · Attempts: 2
```

Waiting for flows to complete...
[Failed] cart-flow (1s) (Unable to launch app com.kidsp2p.marketplace)

1/1 Flow Failed


```

### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — maestro (ios)
- Asset: `tax-checkout.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`
- Duration: 0.0s · Attempts: 0
```
Missing flow asset: /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml
```

### TC-P08 — playwright
- Asset: `__tests__/e2e/tax-admin-config.e2e.test.ts` (grep: `new transactions`)
- Command: `npx playwright test __tests__/e2e/tax-admin-config.e2e.test.ts -g new transactions`
- Duration: 1.0s · Attempts: 2
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
