# QA Task TRD-Expanded — Ledger (2026-09-09)

**Run:** `qa-task-trd-expanded-2026-09-09` · HEAD `808da895` (FIX-Task-9, clean) · execution-only
**Platforms:** iOS iPhone 17 Pro Max + Android Medium_Phone_API_36.1 (both FIX-Task-9 bundle via Metro 8081)
**Manual call tally ≈ 300–330** (R71 — transcript pointer-only; no mineable ledger)

## Verdicts

| Item | Verdict | Platform(s) | Evidence |
|---|---|---|---|
| P0 item 1 — stale-pm no-relaunch swap | ✅ PASS (user-visible) | iOS | baseline `64dee053` + post-swap `7d52afad` both mastercard 4444; no-relaunch success; A1 reject-branch not on-device-reproducible (EF self-heals drift) — unit-tested |
| P0 item 2 — A4 toggle read-back | ✅ PASS | iOS (shared JS) | arm→"verified read-back: hold_decline"; disarm→"none". Android am-start delivery didn't surface alert (quirk) |
| P0 item 3 — B06 copy | ✅ PASS | iOS | "Payment method declined. Please update your card." (screenshot) |
| P0 item 4 — iOS LogBox fix | ✅ PASS | iOS | cap modal NO full-screen LogBox; Cancel Oldest→`64dee053` cancelled→auto-resubmit `ed92e484` (screenshot) |
| P0 item 5 — payout-hold info | ✅ PASS | Android | payout-hold card→"When does my payout release?" (screenshot) |
| P0 item 6 — guard-modal 3rd option | ✅ PASS | iOS | 3rd option cancels exact `e79f0e6b`→TradeInitiation; Dismiss + Go-to-Trade-History work (screenshots). in_progress-hidden leg source-corroborated, not on-device (no buyer-in_progress remained) |
| Part 1 C06 — SP restore on seller cancel | ✅ PASS | Android | `cb92ca6c` 6-SP offer→accept (in_progress, 468/6)→seller cancel→**474/0 restored**, item relisted; test-seller-2 count 0→1→**0** |
| Part 2 D03 — full color range | ✅ PASS (PARTIAL→PASS) | iOS | normal blue / warning amber (35.8%) / critical red (44.3%) / expired gray — 4 screenshots + 3 badge-scans |
| Part 3 I03 (sample) | Observed (terminal-trade chat) | iOS | cancelled-trade chat correct; active-chat leg not reached |
| Part 3 I11 (sample) | ✅ PASS (incidental) | iOS | disclaimer appeared ONLY on Send Offer ×4 all session; never on non-trade nav |

## State left behind
- test-buyer: 0 pending/in_progress; wallet 474/0; logged OUT. test-seller-2: count 0, flag NULL. test-seller untouched.
- Cancelled-trade residue: `cb92ca6c`, `e79f0e6b`, `64dee053`, `7d52afad`, `ed92e484` (terminal; no money moved).
- test-buyer stored card = valid MASTERCARD `pm_1UDkZt4`. Metro 8081 running; Metro 8082 killed (host RAM). No config writes.

## Screenshots (9)
ios-P0-item3-B06-decline-new-copy · ios-P0-item4-cap-modal-no-logbox · ios-P0-item6-guard-modal-3rd-option · ios-P0-item6-goto-trade-history · android-P0-item5-payout-hold-info · ios-D03-normal-47h-pills · ios-D03-warning-5h-pill · ios-D03-critical-1h30m-pill · ios-D03-expired-gray-pill
