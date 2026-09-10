# Ledger — qa-task-android-ghi-d03-2026-09-10

Execution-only QA run. **No repo/code/config changes.** Writes were limited to: `e2e-test-results/qa-task-android-ghi-d03-2026-09-10/` (evidence + report + tracker edit), Android emulator device state, QA fixture rows explicitly authorized by the brief (fast-clock UPDATE on disposable fixture trades, `trade_push_log` seed → deleted), and sanctioned QA fixture scripts (`qa:reset-offer-fixtures`, `qa:r41-in-progress-trade`, `qa:ef-repro`).

## Call-count ledger

`npm run qa:mine-call-ledger --dir <session-debug-log>` → **`0 calls / 0 msgs main.jsonl`** → the transcript is **pointer-only**, so the mined figure is unavailable and the **R71-fallback** applies.

**Manual tally (labelled, not mined):** ~150 tool executions ≈ **26 desk-work** (recon + source reads + DB fixture queries + tracker/report write-up) + **~124 device/EF execution**. 13 verdict rows → **isolated device per-verdict ≈ 9.5** (43c baseline 9.6 · TRD-R1b ~23).

## Phase trace

### P0 — Recon & preconditions (~14 calls)
- Host memory: `vm_stat` (2 passes — first pass mis-assumed 4 KB pages, corrected to the reported **16 KB** page size) → **~3.1–3.4 GB** free+inactive+speculative+purgeable.
- Read playbook §1–§9; grepped for R79 (found only a cross-ref in `mobile-client.instructions.md`; interpreted R79-1 as the cold-reload discipline per its usage in the 2026-09-09 report).
- Read guide sections: Group G (L1512–1610), Group H + I (L1638–1930), D03 (L1200–1240).
- Read `/memories/repo/qa-test-accounts.md`, `schema-cheat-sheet.md`, prior run `qa-task-trd-expanded-2026-09-09/report.md`, tracker rows.
- **Source reads (R78-3):** `AutoCompleteBanner.tsx`, `countdown.ts`, `TradeTimelineScreen.tsx` (L1455–1490, L1975–2075), `SafeMeetupCard.tsx`, `NotificationCenterScreen.tsx`, `send-auto-complete-reminders` EF + `rpc_send_auto_complete_reminders`, `rpc_send_offer_reminders`, `send-push-notification` `shouldThrottlePush`, `user_notifications` schema, `trade_push_log` schema.
- **Cron recon (decisive):** listed `cron.job` → `process-auto-complete` `*/15`, `send-auto-complete-reminders`/`send-offer-reminders` `*/5`, `process-expired-offers` `*/2` (all active).

### P1 — Android bring-up (~10 calls)
`adb devices` → `settings put secure stylus_handwriting_enabled 0` (R77 #2) → Metro :8081 confirm → `mobile_list_available_devices` → terminate + **cold relaunch (R79-1)** → Dev Launcher → tap Metro row → dismiss dev-menu → DB fixture-feasibility gate (test-buyer wallet 474/0; no open trades).

### P2 — Group G (~46 calls)
- Created disposable `in_progress` fixture via `qa:r41-in-progress-trade` (R90).
- **G02:** 3 combined fast-clock+RPC statements (24h / 2h / dedup re-run), 4 DB read-backs, login as test-buyer, bell → Notification Center ×3, tap-through ×2, 5 screenshots. **1 root-cause detour** (~4 calls) when `ac_reminded_2h: 0` → traced to the fixture being auto-completed by the real cron; fresh fixture + re-run.
- **G01:** `qa:reset-offer-fixtures`, EF `create-trade-offer`, 2 fast-clock writes, 3 EF `send-offer-reminders` invocations, 1 DB row read-back, login as test-seller, Notification Center, tap-through → Review Offer, 3 screenshots.
- **G03:** `information_schema` on `trade_push_log`, baseline EF call, 3-row seed, throttled EF call, payout EF call, DELETE cleanup.
- **G04:** folded into the G01/G02 tap-throughs (no separate case) + 2 screenshots.

### P3 — D03 AutoCompleteBanner staged drive (~22 calls)
5 stages × (fast-clock UPDATE + back/remount + tree read + screenshot); 4 `qa:badge-scan` passes (icon region ×3, container region ×1); 1 `qa:ocr` pass. Screenshots: `android-D03-banner-5h-normal-discriminator.png`, `-3h-urgent.png`, `-2h-scrolled-full-visible.png`, `-expired.png`.

### P4 — Group H (~10 calls)
3 `qa-trade-success` deep-link fires (1 lost to `&`-param lossiness → re-fired with device-side quoting) + 1 persona switch + 3 tree/screenshot verifications + 3 screenshots.

### P5 — Group I (~14 calls)
Login back as test-buyer, trade deep link, **I02 investigation** (3 tree reads + 1 screenshot + 1 OCR + 2 source reads ≈ 7 calls) → FAIL finding. Chat header tap → Messages list → conversation tap → **I04 modal** (1 tree + 1 screenshot + 1 tap) → **I05 negative leg** (1 tree + 1 screenshot). I05 positive leg: blocked by the I02 occlusion (confirmed no in_progress conversation exists via 1 DB query).

### P6 — Cleanup (~6 calls)
`qa:reset-offer-fixtures`, `qa:r41-in-progress-trade -- reset` (3/3 trades deleted), `trade_push_log` DELETE (3 rows), final state verification query (0 open trades, 0 leftover items, wallet 474/0, 0 push-log residue), `qa-logout`.

### P7 — Deliverables (~8 calls)
Tracker row edits (12 rows) + §1 roll-up + section header; `qa:mine-call-ledger` attempt; `report.md`; this `ledger.md`; §8.3 handoff.

## Fixtures created & destroyed

| Fixture | Created | Destroyed |
|---|---|---|
| `in_progress` trade `69c45e40` (+ item `924afae5`) | `qa:r41-in-progress-trade create` | `reset` ✔ (auto-completed by the real cron before deletion) |
| `in_progress` trade `b68e3d11` (+ item `088b94f4`) | same | `reset` ✔ |
| `in_progress` trade `b4a06e4b` (+ item `e0f78c2c`) | same | `reset` ✔ |
| Pending offer trade `68c8d7c7` (item `185546da`) | `qa:ef-repro --ef create-trade-offer` | `qa:reset-offer-fixtures` ✔ (offer cancelled, listing reset) |
| `trade_push_log` ×3 (G03) | SQL seed | DELETE ✔ (0 residue) |

## Persona logins/switches
test-buyer → test-seller (G01) → test-free (H01) → test-buyer (I02/I04/I05) → logged out. 4 session transitions (~2–3 calls each).

## Screenshots (all in `screenshots/`)
1. `android-G02-24h-notification.png`
2. `android-G04-tapthrough-trade-timeline.png`
3. `android-D03-banner-5h-normal-discriminator.png`
4. `android-D03-banner-3h-urgent.png`
5. `android-D03-banner-expired.png`
6. `android-D03-banner-2h-scrolled-full-visible.png`
7. `android-G02-2h-notification-and-trade-completed.png`
8. `android-G01-seller-offer-reminders-6h-1h.png`
9. `android-G04-offer-reminder-to-review-offer.png`
10. `android-H03-seller-accept-sp-completion.png`
11. `android-H04-seller-cash-only-upsell.png`
12. `android-H01-free-buyer-kidsclub-upsell.png`
13. `android-I04-pre-first-message-safety-modal.png`
14. `android-I05-negative-frozen-chat-no-chips.png`
