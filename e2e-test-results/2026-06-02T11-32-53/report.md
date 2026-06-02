# TradeFlowV2 Automated Run — 2026-06-02T11:42:38.988Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 102 |
| ✅ Passed | 28 |
| ❌ Failed | 74 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 11 |

## ❌ Failures (investigate before manual QA)

### REG-R02, TC-A04, TC-B01, TC-B03, TC-B04, TC-B05, TC-R01, TC-R02, TC-R13 — maestro (ios)
- Asset: `trade-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`
- Duration: 29.7s · Attempts: 2
```

Waiting for flows to complete...
[Failed] trade-flow (21s) (Assertion is false: id: tab-discover is visible)

1/1 Flow Failed


```

### REG-R06, REG-R07, TC-C01, TC-C02, TC-C04, TC-C05, TC-C06, TC-R07 — maestro (ios)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 33.7s · Attempts: 2
```

Waiting for flows to complete...
[Failed] swap-points-wallet (24s) (Assertion is false: id: tab-me is visible)

1/1 Flow Failed


```

### REG-R08, TC-C07, TC-C08 — maestro (ios)
- Asset: `checkout-sp-cap.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`
- Duration: 32.2s · Attempts: 2
```

Waiting for flows to complete...
[Failed] checkout-sp-cap (23s) (Assertion is false: "Discover" is visible)

1/1 Flow Failed


```

### TC-A01, TC-A02, TC-A03, TC-E01, TC-E02, TC-E03, TC-E04, TC-H01, TC-H02, TC-H03, TC-H04, TC-Q01, TC-Q02, TC-Q03, TC-Q04, TC-Q05, TC-Q06, TC-Q07, TC-Q08, TC-Q09, TC-Q10, TC-Q12, TC-Q15, TC-Q17 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 33.6s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (24s) (Assertion is false: "Discover" is visible)

1/1 Flow Failed


```

### TC-F01, TC-F02, TC-F03, TC-R08 — maestro (ios)
- Asset: `module-15.1-flow-22-payouts.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`
- Duration: 31.1s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1-flow-22-payouts (22s) (Assertion is false: "Me" is visible)

1/1 Flow Failed


```

### TC-I01, TC-I02, TC-I03, TC-I04, TC-I05 — maestro (ios)
- Asset: `liability-disclaimer-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/liability-disclaimer-flow.yaml`
- Duration: 30.4s · Attempts: 2
```

Waiting for flows to complete...
[Failed] liability-disclaimer-flow (22s) (Assertion is false: id: tab-me is visible)

1/1 Flow Failed


```

### TC-M01, TC-M02, TC-M03, TC-M04, TC-M05, TC-M06, TC-M07, TC-M08, TC-M09, TC-M10, TC-M11, TC-M12, TC-M14, TC-M15 — maestro (ios)
- Asset: `cart-flow.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/cart-flow.yaml`
- Duration: 32.5s · Attempts: 2
```

Waiting for flows to complete...
[Failed] cart-flow (22s) (Assertion is false: id: tab-discover is visible)

1/1 Flow Failed


```

### TC-O01, TC-O02, TC-O03, TC-O04, TC-O05, TC-O06, TC-O07 — maestro (ios)
- Asset: `tax-checkout.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/tax-checkout.yaml`
- Duration: 30.8s · Attempts: 2
```

Waiting for flows to complete...
[Failed] tax-checkout (22s) (Assertion is false: id: tab-discover is visible)

1/1 Flow Failed


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
