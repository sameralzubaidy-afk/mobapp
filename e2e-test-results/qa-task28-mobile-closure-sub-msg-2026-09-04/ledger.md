# QA Task 28 — Ledger (2026-09-04)

Per-case verdicts for tracker/regeneration consistency (R52 item 5). Run folder: `qa-task28-mobile-closure-sub-msg-2026-09-04`.

| TC-ID | Guide | Verdict | Latest | Key note |
|---|---|---|---|---|
| SUB-TC-D01 | SUB | ✅ PASS | PASS | test-grace Manage Kids Club+ grace banner: "Grace Period Active / Your Swap Points are frozen. Re-subscribe before November 2, 2026..." + Re-subscribe CTA. Copy diff: deadline not day-count |
| MSG-TC-D02 | MSG | 🟡 PARTIAL | PARTIAL | Use Camera on sim → graceful inline "Failed to take photo", no crash; capture + permission-denied legs device-gated |
| MSG-TC-D04 | MSG | ✅ PASS | PASS | Created pending (28846a18) → re-entry shows Pending state, no submit affordance, DB 1 pending row. Doc-drift: guide "Pending Request" alert = dead code (pending screen is the guard) |
| MSG-TC-D05 | MSG | ✅ PASS | PASS | Submit disabled until image; no-image tap = no-op, no error |
| MSG-TC-D10 | MSG | 📄 DOC-DRIFT | NOT SUPPORTED | Confirmed: enum = subscription/sp_events/badges/trades/system; no id_verification; ID-verif routes via badges (mirrors J05) |
| MSG-TC-I01 | MSG | 🟡 PARTIAL | PARTIAL | Prompt renders; Enable Notifications CTA occluded by floating tab bar; success leg device-gated |
| MSG-TC-I02 | MSG | 🔴 STILL OPEN | BLOCKED | Error-state leg not on-device drivable: CTA occluded (NotificationSetup not in TAB_BAR_HIDDEN_ROUTES); behavior source-confirmed |

Confirm-quickly (DT104): D06/D07 notif rows ✅ (DB: buyer 5 + grace 3, qa_r41); I08 toggle ✅ on-device (armed → Wallet Not Found → disarmed); MSG flagged items ✅ (2 on test-seller).

Fixture changes: test-seller → ID-pending (28846a18). No config writes, no admin changes.
