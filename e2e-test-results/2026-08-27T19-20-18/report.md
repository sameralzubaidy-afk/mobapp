# TradeFlowV2 Automated Run — 2026-08-27T19:20:48.567Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 23 |
| ✅ Passed | 0 |
| ❌ Failed | 23 |
| ⏭️ Skipped (pending/manual) | 3 |
| Execution units run | 6 |

## ❌ Failures (investigate before manual QA)

### TRD-TC-A01, TRD-TC-A02, TRD-TC-A03 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 2.1s · Attempts: 2
```
Unknown Property: direction at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml:77:1

```

### TRD-TC-A04, TRD-TC-B01, TRD-TC-B03, TRD-TC-B04, TRD-TC-B05 — maestro (ios)
- Asset: `trade-flow.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`
- Duration: 2.5s · Attempts: 2
```
Config Field Required: element at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/helpers/tfv2-login-seller.yaml:60:7

```

### TRD-TC-C01, TRD-TC-C02, TRD-TC-C04, TRD-TC-C05, TRD-TC-C06 — maestro (ios)
- Asset: `swap-points-wallet.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`
- Duration: 2.6s · Attempts: 2
```
Config Field Required: element at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/helpers/tfv2-login-buyer.yaml:60:7

```

### TRD-TC-C07, TRD-TC-C08 — maestro (ios)
- Asset: `checkout-sp-cap.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`
- Duration: 2.2s · Attempts: 2
```
Config Field Required: element at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/helpers/tfv2-login-seller.yaml:60:7

```

### TRD-TC-D01, TRD-TC-D02, TRD-TC-D03, TRD-TC-D04, TRD-TC-D05 — maestro (ios)
- Asset: `module-15.1.2-flow-08-trade-v2-components.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`
- Duration: 2.3s · Attempts: 2
```
Config Field Required: element at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/helpers/tfv2-login-seller.yaml:60:7

```

### TRD-TC-F01, TRD-TC-F02, TRD-TC-F03 — maestro (ios)
- Asset: `module-15.1-flow-22-payouts.yaml`
- Command: `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`
- Duration: 2.2s · Attempts: 2
```
Config Field Required: element at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/helpers/tfv2-login-seller.yaml:60:7

```

## ⏭️ Coverage gaps (not executed)

| Case | Status | Reason |
|---|---|---|
| TRD-TC-B02 | manual | Requires clock fast-forward to expiry window not controllable from the app UI. |
| TRD-TC-B06 | manual | Requires Stripe test decline card path; not deterministic from UI without a seeded decline fixture. |
| TRD-TC-C03 | manual | Needs clock fast-forward to expiry. |

## ❌ Challenges & Recommendations

### Failure Pattern Analysis

| Pattern | Count | % of Failures |
|---|---|---|
| ❓ Other | 6 | 100% |

### Duration & Performance

- Total execution time: 0.2 min
- Average per unit: 2.3s
- Slowest passing unit: N/A
- Slowest failing unit: 2.6s

### Failure Details

#### TRD-TC-A01, TRD-TC-A02, TRD-TC-A03 — module-15.1.2-full-trade-flow-v2.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.1s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`

#### TRD-TC-A04, TRD-TC-B01, TRD-TC-B03, TRD-TC-B04, TRD-TC-B05 — trade-flow.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.5s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/trade-flow.yaml`

#### TRD-TC-C01, TRD-TC-C02, TRD-TC-C04, TRD-TC-C05, TRD-TC-C06 — swap-points-wallet.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.6s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/swap-points-wallet.yaml`

#### TRD-TC-C07, TRD-TC-C08 — checkout-sp-cap.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.2s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/checkout-sp-cap.yaml`

#### TRD-TC-D01, TRD-TC-D02, TRD-TC-D03, TRD-TC-D04, TRD-TC-D05 — module-15.1.2-flow-08-trade-v2-components.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.3s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-flow-08-trade-v2-components.yaml`

#### TRD-TC-F01, TRD-TC-F02, TRD-TC-F03 — module-15.1-flow-22-payouts.yaml (ios)
- **Root cause:** Unknown
- **Duration:** 2.2s · **Attempts:** 2
- **Command:** `maestro test --platform ios --format junit --device 3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1-flow-22-payouts.yaml`

### Recommendations for Future Enhancements

| # | Recommendation | Priority |
|---|---|---|
| 4 | 3 cases skipped (manual/pending). Prioritize automation for high-value flows. | Medium |
| 5 | Consider adding a pre-run data integrity check to verify seeded data exists before starting. | Medium |
| 6 | If flakiness persists, implement per-case retry with exponential backoff in the orchestrator. | Low |
| 7 | Review screenshots in `screenshots/` folder to visually confirm UI state at failure point. | Low |

