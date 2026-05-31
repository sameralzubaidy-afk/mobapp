# TradeFlowV2 Automated Run — 2026-05-31T15:31:07.428Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 119 |
| ✅ Passed | 112 |
| ❌ Failed | 7 |
| ⏭️ Skipped (pending/manual) | 15 |
| Execution units run | 37 |

## ❌ Failures (investigate before manual QA)

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
