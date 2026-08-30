# QA Task 7 — Decision & Outcome Log (2026-08-30)

Run: `qa-task7-expanded-lmn-retest-2026-08-30`

## Toolkit-efficiency measurement

**Baseline (QA Task 5):** $2.48 / 39 cases — pre-toolkit, 8–10 mobile-mcp calls per persona switch (email/password login, walkthrough onboarding, etc.).

**This run (QA Task 7):** Dev Task 51 toolkit (`qa-login-as?persona=<name>` deep link) = **1 call** per persona switch. Also used `qa:reset-offer-fixtures`, `qa:ef-repro` (K10), `qa-logout`.

| Persona switch | Method | Calls | Baseline equivalent |
|---|---|---|---|
| → test-buyer | `qa-login-as?persona=test-buyer` | 1 | 8–10 |
| → test-seller | `qa-login-as?persona=test-seller` | 1 | 8–10 |
| → test-seller-2 | `qa-login-as?persona=test-seller-2` | 1 | 8–10 |
| → test-seller-3 | `qa-login-as?persona=test-seller-3` | 1 | 8–10 |
| logout | `qa-logout` | 1 | 2–3 |

**Observation:** the toolkit removed ~8–9 calls per switch with **zero auth regressions** observed across 40 cases + DT-62 bonus (no onboarding-blockers, no failed logins). The 40-case run completed comfortably under the per-case call budget implied by the Task 5 baseline.

## Decision log

| # | Decision | Rationale | Outcome |
|---|---|---|---|
| D1 | Use `qa-login-as` deep links for all persona switches | Toolkit (DT-51) is the standing rule; one call vs 8–10 | All logins clean; no regressions |
| D2 | Execute N01 min-cart-value via admin **portal UI**, not RPC write | `upsert_admin_config_setting` → `P0001 UNAUTHORIZED` via MCP SQL (needs admin context) | Admin UI path works; DB verified (R28) |
| D3 | Verify N02's negative-value validation by attempting −5 and reading DB | Confirms the write is actually blocked, not just a message | DB stayed 0 → validation enforces (PASS) |
| D4 | Mark M16/M18 PARTIAL, not PASS | Toast auto-dismisses in 2.5s — not directly capturable; behavior + copy source-verified | Honest verdict; flagged instrumentation gap |
| D5 | Mark M05 SKIPPED | Own-item add-to-cart needs a dedicated own-listing state; low value, deferred | Zero residue; re-runnable |
| D6 | Cleanup seeded fixture rows via SQL, leaving completed/cancelled trade rows historical | Deleting trades would orphan ledger/payout/refund rows; restoring listings + deleting only the seeded notifications/messages is the safe zero-residue path | Verified 0 residue (notifications, messages, cart_items, pending offers, config=0) |
| D7 | Cancel seeded G04 trade a4444444 via SQL | Pending cash offer, no SP/Stripe moved — safe; no in-app actor required for a disposable fixture | Cancelled 16:53:45; listing restored |

## Outcome summary
- 40 cases: **37 PASS / 2 PARTIAL (M16, M18) / 1 SKIPPED (M05)** — 0 FAIL.
- DT-62 bonus: item 2 (net payout, single + bundle) **2/2 PASS**; item 5 (AX modals) **PARTIAL** (tooling-limited VoiceOver swipe).
- Toolkit efficiency: confirmed win vs QA Task 5 baseline.
