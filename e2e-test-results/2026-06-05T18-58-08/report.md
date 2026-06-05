# TradeFlowV2 Automated Run — 2026-06-05T19:02:50.327Z

**Module:** MODULE-15.1.2 TradeFlowV2
**Source:** misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md

## Summary

| Metric | Count |
|---|---|
| Cases selected | 1 |
| ✅ Passed | 0 |
| ❌ Failed | 1 |
| ⏭️ Skipped (pending/manual) | 0 |
| Execution units run | 2 |

## ❌ Failures (investigate before manual QA)

### TC-A01 — maestro (ios)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform ios --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 122.2s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (1m 44s) (Assertion is false: id: login-email-input is not visible)

1/1 Flow Failed


```

### TC-A01 — maestro (android)
- Asset: `module-15.1.2-full-trade-flow-v2.yaml`
- Command: `maestro test --platform android --format junit /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/module-15.1.2-full-trade-flow-v2.yaml`
- Duration: 10.8s · Attempts: 2
```

Waiting for flows to complete...
[Failed] module-15.1.2-full-trade-flow-v2 (1s) (Unable to launch app com.sameralzubaidi.p2pmarketplace)

1/1 Flow Failed


```
