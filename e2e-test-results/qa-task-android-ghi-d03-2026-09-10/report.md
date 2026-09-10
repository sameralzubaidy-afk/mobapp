# QA Task — Android Cross-Platform: Groups G/H/I + D03 AutoCompleteBanner — Report

**Run:** 2026-09-10 · `qa-task-android-ghi-d03-2026-09-10`
**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Platform:** Android emulator `Medium_Phone_API_36.1` (Android 16, `sdk_gphone64_arm64`, `emulator-5554`) — primary. iOS sim (iPhone 17 Pro Max) online but **not driven** this round.
**Agent:** QA Test Agent (execution-only; no code/repo changes) · **LLM:** DeepSeek V4 Flash
**Agent-Improvement-1/2 + R79-1 applied** (recon-first R78-1, fixture-feasibility gate R78-2, source-read-before-drive R78-3, cold-reload R79-1).

---

## 0. Environment preconditions

| Check | Value | Verdict |
|---|---|---|
| **Host memory (required ≥1 GB)** | **~3.1–3.4 GB** free+inactive+speculative+purgeable (16 KB pages: free 3,784 + inactive 200,166 + speculative 5,314 + purgeable 2 ≈ 209,266 pages × 16 KB) | ✅ PASS (well clear) |
| Host memory pressure | **Heavy swap observed** — swapins 3,651,201 / swapouts 5,549,603, compressor 398,196 pages (~6.5 GB) | ⚠️ noted; the 2026-09-09 round's Android ANR storm was attributed to ~66–124 MB free host memory — this round had ~3 GB and **experienced NO ANR / emulator instability** |
| Metro (8081) | listening (PID 84076) | ✅ |
| Android app cold-reload (R79-1) | terminated + relaunched → Expo Dev Launcher → Metro row tapped (R77 #6) | ✅ |
| Stylus-handwriting tutorial disabled (R77 #2) | `settings put secure stylus_handwriting_enabled 0` | ✅ (no "Try out your stylus" interstitial all round) |
| Persona/device baseline | test-buyer wallet 474 available / 0 reserved / active | ✅ |

**Note (R29 busy-check):** no competing agent task was driving the Android emulator or the admin portal session this round.

## 1. Verdict table

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| **G01** | TRD | ✅ PASS | Android: both reminders render unread for the seller; dedup 0/0. **DOC-DRIFT** on guide copy |
| **G02** | TRD | ✅ PASS | Android: both reminders render unread for the buyer; dedup 0/0; 2h copy exact |
| **G03** | TRD | ✅ PASS | EF-layer only — **no device surface exists** (server-side throttle) |
| **G04** | TRD | ✅ PASS | Android: both notification types tap-through to the correct screen (incl. offer-reminder → **Review Offer**) |
| **H01** | TRD | ✅ PASS | Android: "$2.00 saved" upsell copy + [Join Kids Club+] exact |
| **H03** | TRD | ✅ PASS | Android: "18 SP releasing in 3 days…" + [View Wallet] exact |
| **H04** | TRD | ✅ PASS | Android: "Sold for cash! Try "Accept SP"…" + [Create New Listing] exact |
| **H05** | TRD | ⏭️ SKIPPED (unchanged PARTIAL) | Not sampled — budget; trial-start leg still product-unreachable (D-001) |
| **I02** | TRD | 🔴 **FAIL (Android)** | **Regression: safe-meetup card AND Message-Seller unreachable on the Android in_progress timeline** |
| **I04** | TRD | ✅ PASS | Android: pre-first-message safety modal on a never-messaged thread. **DOC-DRIFT** copy |
| **I05** | TRD | 🟡 **PARTIAL** | Negative leg PASS; positive leg BLOCKED by the I02 occlusion (no reachable in_progress chat) |
| **I10** | TRD | ⏭️ SKIPPED | Loading state not forceable — same reason as every prior attempt |
| **D03 (banner)** | TRD | ✅ PASS (extension) | AutoCompleteBanner **2-band** drive staged; banner ignores `countdown.ts` urgency |

**Roll-up: 9 PASS · 1 FAIL · 1 PARTIAL · 2 SKIPPED (of 13 executed/touched).**

## 2. Group G — Notifications (in-app / deep-link only; no push delivery — per brief)

### Method
Reminders were produced by the **real producers** (not by inserting rows):
- G01 — `send-offer-reminders` Edge Function (the same code path its `*/5` cron uses), invoked via the sanctioned `qa:ef-repro` harness (R90).
- G02 — `rpc_send_auto_complete_reminders` (inserts `user_notifications` itself), called via read/write SQL.
Fast-clock staging per R14. All reminder payloads/rows were then verified **on the Android device**.

### G01 — ✅ PASS
| Leg | Evidence |
|---|---|
| 6h | `qa:ef-repro --ef send-offer-reminders` after `offer_expires_at = now()+6h` → `reminder_6h_sent: 1`, `in_app.created: 1` |
| 1h | after `offer_expires_at = now()+1h` → `reminder_1h_sent: 1`, `in_app.created: 1` |
| Dedup | immediate re-run → `reminder_6h_sent: 0`, `reminder_1h_sent: 0`, `in_app.created: 0` → **no third reminder** |
| Android render | Both rows present + **unread** in the seller's Notification Center: `notification-item-ec1cd87e…` (`offer_reminder_1h`) + `f675c241…` (`offer_reminder_6h`) — `android-G01-seller-offer-reminders-6h-1h.png` |

**DOC-DRIFT (copy):** guide expects titles — "⏱ Offer expiring in 6h on [Item]" / "Last chance — offer on [Item] expires in 1h". Shipped: title **"Offer Expiring Soon"** (both) + body `You have an offer on "<item>" expiring in N hours.` The thresholds, count and dedup semantics are correct; the guide's copy is stale.

### G02 — ✅ PASS
| Leg | Evidence |
|---|---|
| 24h | `rpc_send_auto_complete_reminders(10)` after `auto_complete_at = now()+24h` → `ac_reminded_24h: 1`, `in_app_created: 1` |
| 2h | after `auto_complete_at = now()+2h` → `ac_reminded_2h: 1`, `in_app_created: 1` |
| Dedup | re-run → `ac_reminded_24h: 0`, `ac_reminded_2h: 0` → **no third reminder** |
| Android render | Both rows **unread** in the buyer's Notification Center — `android-G02-24h-notification.png`, `android-G02-2h-notification-and-trade-completed.png` |

Copy: 2h = **exact guide text** (`"<item>" trade auto-completes in 2 hours.`). 24h = minor variance (app: `Your trade for "<item>" auto-completes in 24h. Got it? Tap 'I Got It'.` vs guide `Your [Item] trade auto-completes in 24h. …`) — semantics identical.

**Bonus live evidence (not planned):** staging the banner's "expired" threshold (see §5) put a fixture trade past its deadline, and the **real `*/15` `process-auto-complete` cron completed it** mid-run — the trade flipped `in_progress → completed`, the item sold, and a genuine `trade_completed` notification ("Your trade for "…" was automatically marked complete.") was raised to both parties. Incidental but strong end-to-end corroboration of the auto-complete processor (D01-class).

### G03 — ✅ PASS (EF-layer; **no device surface — stated explicitly per R80**)
`send-push-notification`'s `shouldThrottlePush` is **server-side push-delivery logic with no Android-vs-iOS UI surface**, so a per-platform device verdict does not exist for this case. Verified at the EF layer instead:

| Assertion | Result |
|---|---|
| Baseline (0 logged pushes for the trade/user) | **NOT throttled** — `{"success":false,"message":"No active push tokens for user"}` |
| 3 logged non-payout pushes for (trade,user) → 4th non-payout | **`{"success":false,"throttled":true,"message":"Push throttled for this trade"}`** |
| `payout_sent` event at the same limit | **NOT throttled** (reached the token-lookup stage) → payout bypass confirmed |

Fixture `trade_push_log` rows were seeded via SQL and **deleted at cleanup** (3 rows removed, verified 0 residue).

### G04 — ✅ PASS (both legs, on Android)
- `ac_reminder_24h` / `ac_reminder_2h` tap → **Trade Timeline** for that exact trade (`android-G04-tapthrough-trade-timeline.png`).
- `offer_reminder_6h` tap → **Review Offer** for that exact trade (`android-G04-offer-reminder-to-review-offer.png`) — re-confirms the 2026-08-29 P2 `TYPE_TO_ROUTE_MAP` gap is fixed, now on Android too. The Review Offer header pill rendered the red **"1h left"** critical band, incidentally corroborating the D03 pill band set on Android.

## 3. Group H — Completion CTAs (Android)

All three driven via the documented `qa-trade-success` deep link, **with `feeSavingsCents=200` included** per the brief's docs-gap warning.

| Case | Rendered copy (Android) | CTA | Verdict |
|---|---|---|---|
| **H01** (free buyer, cash_only) | "Trade complete! Kids Club+ would've saved you **$2.00** on this trade." | [Join Kids Club+] | ✅ exact |
| **H03** (seller, accept_sp) | "**18 SP releasing in 3 days** — added to your pending wallet." | [View Wallet] | ✅ exact |
| **H04** (seller, cash_only) | "Sold for cash! Try "Accept SP" on your next listing to also earn SP." | [Create New Listing] | ✅ exact |

**Friction (R77 #12, re-confirmed):** the first `adb shell am start … -d "…&…&…"` **silently dropped every parameter after the first `&`** (the device shell re-split the URL; error `/system/bin/sh: com.…: inaccessible or not found`). The working form wraps the URL in **device-side single quotes**: `adb shell "am start … -d '<url-with-&>' <pkg>"`. Single-param links were unaffected all round. Worth adding to R77 #12 as the concrete fix, not just "prefer single-param".

**H05 — SKIPPED** (unchanged): remains PARTIAL — the trial-start leg is unreachable by product decision (D-001; `trial_enabled=false`, native subscription-choice screen permanently removed), and the cancel leg would mutate a primary persona. Not sampled this round (budget).

## 4. Group I — Safety UX (Android)

### I04 — ✅ PASS
Opening a **never-messaged** listing's thread rendered the pre-first-message safety modal:
`#safety-modal` → "Trade Smart, Trade Safe" / "Smart traders meet where people are around" + the 4 tips (Meet where others can see you · Drop a pin before you leave · Cancel anytime · Daytime only) + `safety-modal-confirm` **[Got it — Let's Trade Safely]** (`android-I04-pre-first-message-safety-modal.png`).
**DOC-DRIFT (copy):** the guide's expected modal text ("Keep your trade safe — SP and buyer protection only work for in-app transactions." + [Got it]) does **not** match the shipped redesign copy.

### I05 — 🟡 PARTIAL (Android)
- **Negative leg PASS:** on a terminal (cancelled) trade chat the composer is correctly inert — `message-input` **disabled** ("Chat is no longer active"), `quick-replies-toggle` **disabled**, no chips (`android-I05-negative-frozen-chat-no-chips.png`).
- **Positive leg BLOCKED:** there is **no reachable route** to the in_progress trade's chat on Android this round — the timeline's only entry point is `message-button`, which is unreachable (see I02), and a DB check confirmed **no existing conversation belongs to an in_progress trade** (all 5 threads for test-buyer map to `cancelled` trades).
- Positive leg therefore rests on the **iOS 2026-08-30 PASS** on record (R80 disclosure).
- *Incidental:* the same screen corroborated **I03** (pinned `safety-banner`) on Android.

### I02 — 🔴 **FAIL (Android) — see Critical Finding 1**

### I10 — ⏭️ SKIPPED
The disclaimer "Loading disclaimer…" state is not forceable with current tooling (no slow-network/throttle toggle for the policy fetch), identical to every prior attempt. Not re-attempted; iOS PASS on record.

## 5. D03 — AutoCompleteBanner staged drive (separate from the closed pill range)

**Why this is a separate drive:** D03's pill 4-band range was closed 2026-09-09. The **AutoCompleteBanner** is a different component with its own urgency logic — never separately driven until now.

**Source read first (R78-3) — and it changes the expected shape:**
`AutoCompleteBanner.tsx` **ignores `model.urgency` entirely** and computes its own single inline flag: `isUrgent = model.minutesLeft < 240` (**< 4 h**). `countdown.ts` defines a *different* 4-band set (normal > 6 h · warning ≤ 6 h · critical ≤ 2 h · expired). So the banner is a **2-band progression (normal / urgent)**, **not** a 4-band mirror of the pill — and its threshold is **4 h**, deliberately misaligned with the shared countdown bands.

**Staged drive** (disposable buyer `in_progress` fixture; `auto_complete_at` fast-clocked per stage; screen remounted between stages):

| # | Staged `auto_complete_at` | Rendered title | Icon (AX id) | Band | Colour evidence (icon region) |
|---|---|---|---|---|---|
| 1 | now + 24 h | "Confirm pickup — auto-completes in 24h" | `…timer-fill` | normal | — |
| 2 | **now + 5 h** | "Confirm pickup — auto-completes in 5h" | `…timer-fill` | **normal** | urgent `#F59E0B` **0.00%** / normal `#FEF3C7` **6.04%** |
| 3 | now + 3 h | "Confirm pickup — auto-completes in 3h" | `…warning-circle-fill` | urgent | urgent **5.68%** / normal 0.06% |
| 4 | now + 2 h | "Confirm pickup — auto-completes in 2h" | `…warning-circle-fill` | urgent | — |
| 5 | now − 2 min | **"Trade is ready for auto-completion"** + "Complete the trade now or contact support if there is an issue." | `…warning-circle-fill` | urgent (expired) | urgent **5.68%** / normal 0.06% |

**Stage 2 is the discriminator:** at 5 h `countdown.ts` classifies the countdown as `warning` (≤6 h), yet the banner renders the **normal** band — proving the banner uses its own 4 h rule and does **not** inherit the shared urgency model.

**Container is invariant across bands:** scanning the banner body in the *urgent* stage returns `#FFFBEB` at **16.46%** — the container fill, border, title (`#92400E`) and subtitle (`#B45309`) do **not** change; the **only** visual delta is the icon square (`#FEF3C7` → `#F59E0B` with the glyph switching Timer → WarningCircle in white).

**Verdict: PASS** for the banner's colour/copy progression (all stages captured with colour **and** copy evidence). **Findings:** (a) a **2-band** progression where the guide/tracker language implies a 4-band set; (b) `countdown.ts`'s exported `urgency` is dead for this consumer — a maintenance trap worth flagging (dev).

**Fixture-race finding (real, reproduced):** the `process-auto-complete` cron runs **every 15 min** on staging and **consumed my expired-stage fixture** — the first `in_progress` fixture was auto-completed at the 16:45 tick, which silently invalidated a subsequent G02 2 h call (`ac_reminded_2h: 0`). Root-caused from D1 (`reminder` 0 → trade `status='completed'`), **not** reported as a failure; a fresh fixture was built and the leg re-run successfully. Any future "expired-stage" drive must either capture within the ≤15 min window or accept the cron consuming the fixture.

## 6. Critical findings (ranked)

### Finding 1 — 🔴 P1 (Android): safe-meetup card **and** Message-Seller button unreachable on the in_progress Trade Timeline
- **Setup:** disposable `in_progress` fixture trade (buyer = test-buyer, seller = test-seller) with `auto_complete_at` set — i.e. **both** card render conditions in `TradeTimelineScreen.tsx` L2056-2058 (`trade.status === 'in_progress' && trade.auto_complete_at`) are satisfied. Confirmed `status=in_progress` in the DB at capture time.
- **Observed:** neither `safe-meetup-toggle` (the FIX-Task-7 item 5b **collapsed** default) nor `safe-meetup-card` appears in the Android AX tree, and **no** "Trade Smart, Trade Safe" / "Tips" text is visible at **any of 3 scroll positions** (top / mid / fully-scrolled-to-bottom) — OCR-confirmed on each.
- **Not an off-screen artefact:** the same AX dumps *do* list other below-fold content (e.g. `Need more time?` at y2390 on a 2400-px-tall screen), so the omission is not merely "below the fold".
- **Same for its JSX sibling:** `message-button` (L2014-2033, gated only on `status !== 'cancelled' && !== 'pending'`) is **likewise absent** — so this is a *contiguous* region, not a single-element locator gap.
- **Suspected mechanism (needs dev confirmation, R12):** the FIX-Task-7 item 5a **pinned footer** (`confirm-trade-button`, AX y **1921–2106**) overlays the ScrollView exactly where those two siblings render (~y1930–2100), so they are permanently occluded; content near the tail (Payment Details → Estimated Sales Tax) also renders **beneath the floating tab bar**.
- **Impact:** on Android a buyer on an `in_progress` trade cannot reach the safety guidance **and cannot message the seller from the timeline** — the timeline's only message entry point is that button.
- **Scope caveat:** iOS was PASS on 2026-08-29 (**before** FIX-Task-7 landed on 2026-09-08), so this is a *post-FIX-Task-7* regression whose iOS status was **not re-checked** this round — it may well be cross-platform.
- **Evidence:** `screenshots/android-D03-banner-2h-scrolled-full-visible.png` + the three AX dumps in §4/I02 of the tracker row.

### Finding 2 — 🟡 P3: guide copy drift on the safety/reminder surfaces
- **G01:** guide "⏱ Offer expiring in 6h on [Item]" / "Last chance — …" → shipped "Offer Expiring Soon" + `You have an offer on "<item>" expiring in N hours.`
- **G02 (24h leg):** minor phrasing variance.
- **I04:** guide "Keep your trade safe — SP and buyer protection only work for in-app transactions." → shipped "Trade Smart, Trade Safe" + 4 tips redesign.
- **I01/I03 already drifted** in the same direction (noted 2026-08-29) — the guide has not been reconciled with the FIX-Task-7 safety-UX redesign. Behaviour is correct in all cases; the **guide** should be updated.

### Finding 3 — 🟡 P3 (process): tracker baseline drift
The brief quoted **238 PASS / 15 Remaining**; the tracker's own §1 roll-up + TRD section header read **236 PASS / 17 Remaining** before this round. The 2026-09-09 round updated rows (C06, D03) but did not refresh the §1 roll-up / section header. This round applied its deltas to the **tracker's** numbers and refreshed both surfaces (R52 step 2 / R56); the 238/15-vs-236/17 gap is flagged for owner reconciliation.

## 7. Perceived load-time table (§5.7)

Measurements are **wall-clock, ±polling-interval precision (simulator/emulator, dev build) — not a formal performance profile.**

| Screen → transition | Elapsed | ≥3 s flag |
|---|---|---|
| Dev Launcher → app bundle cold load (R79-1 cold reload) | ~35 s | ⚠️ **FLAGGED** — dev-build cold bundle load, environment artefact (not app behaviour); confirmed by comparing warm navigations below |
| Home → Notification Center (bell tap) | <1 s | — |
| Notification Center → Trade Timeline (notification tap) | ~1 s | — |
| Notification Center → Review Offer (offer-reminder tap) | ~1 s | — |
| Trade deep link → Trade Timeline remount | ~1 s | — |
| Home → Messages list (chat header tap) | ~1 s | — |
| Messages → Chat (conversation tap) | ~1 s | — |
| `qa-trade-success` deep link → TradeSuccess render | ~1 s | — |

**Android was materially more stable than the 2026-09-09 round** (that round: 2 app ANRs + a System-UI ANR + emulator reboot). This round: zero ANRs, zero repeated exits to launcher. The single ~35 s cold-start is the dev-bundle load on first connect, not a regression.

## 8. App state left behind (cleanup verified)

| Item | State |
|---|---|
| test-buyer | **0 pending / 0 in_progress trades**; wallet **474 available / 0 reserved / active** (baseline unchanged) |
| Fixture trades | All 3 `qa:r41-in-progress-trade` fixtures **deleted** (incl. the one the cron auto-completed) |
| Fixture items | **0** leftover "QA InProgress Trade Fixture (2026-09-10)" items |
| G01 pending offer | **Cancelled**; listing reset to `available` (`qa:reset-offer-fixtures`) |
| `trade_push_log` (G03 fixture) | **0 residue** (3 seeded rows deleted) |
| test-seller | Untouched (count 6 + flagged preserved; 2209 SP) |
| Session | **Android app logged out** (Landing) |
| Notification history (left intentionally) | test-buyer + test-seller now carry this round's reminder / `trade_completed` / `trade_cancelled` rows — historical `user_notifications` history, consistent with prior rounds |
| QA toggles / config | **No `admin_config` writes, no `qa-dev-toggle` armed** this round |

## 9. Coverage & running totals

- **TRD (per the tracker's own baseline):** before = **236 PASS / 28 PARTIAL / 2 OPEN / 3 DRIFT / 2 SKIP / 17 Remaining**.
- **After this round:** **234 PASS · 29 PARTIAL · 3 OPEN · 3 DRIFT · 2 SKIP · 17 Remaining** (PASS −2: I02 → OPEN, I05 → PARTIAL).
- **Android cross-platform confirmations gained:** G01, G02, G03 (EF-layer), G04, H01, H03, H04, I04, and the D03 banner extension.
- **New Android-only verdicts:** I02 (FAIL — regression), I05 (PARTIAL).
- **Platform-specific no-verdict disclosure (R80):** on the **Android** platform this round leaves **I05's positive leg** and **I10** without a genuine Android verdict (reasons above), and **G03 has no per-platform verdict by construction**. **H05** has no Android verdict. Everything else touched this round now HAS an Android verdict.

## 10. Calls & verdicts ratio

`qa:mine-call-ledger` was **not runnable** for this session (the debug-log folder holds only a pointer `main.jsonl` — the R71-fallback condition), so this is an explicit **manual tally**, not a mined figure:

- **~150 tool executions total**, of which **~26 were desk-work** (recon/source reads, DB fixture queries, tracker edit + report/handoff write-up) and **~124 were device/EF execution**.
- **Verdict rows produced: 13** (9 PASS · 1 FAIL · 1 PARTIAL · 2 SKIPPED) + ~8 cross-platform confirmations folded into existing rows.
- **Isolated device per-verdict ratio ≈ 124 / 13 ≈ 9.5** — essentially at the 43c baseline (9.6) and well below TRD-R1b's ~23, because this round was confirmation-heavy (existing iOS verdicts) rather than discovery-heavy.
- **Structural cost drivers:** (a) the Android notification/render legs are cheap, but **each reminder leg needs 3 calls minimum** (fast-clock write → real producer invoke → DB row read-back) before any device call; (b) **3 persona logins** (test-buyer → test-seller → test-free → test-buyer) for the G/H/I split, each ~2–3 calls; (c) the D03 staged drive = 5 stages × (fast-clock UPDATE + remount + tree read + screenshot) ≈ 22 calls — irreducible for colour-per-stage evidence; (d) **~12 calls spent root-causing the I02 occlusion** (3 scroll positions + OCR + 2 source reads) — worth it, since it produced the round's only FAIL; (e) **~5 calls lost to the `&`-param adb deep-link lossiness** before switching to device-side quoting.

## 11. Friction vs the operating rules (§9)

1. **`adb` multi-param deep links are lossy (R77 #12) — now with the fix.** The first `qa-trade-success` fire dropped all post-`&` params (device shell re-split). Working form: `adb shell "am start … -d '<url>' <pkg>"`. Recommend amending R77 #12 to state the quoting fix, not just "prefer single-param fragments".
2. **Fixture race with the real `*/15` `process-auto-complete` cron** (§5) — cost 2 calls to root-cause. Recommend a standing note: any "expired threshold" fixture on staging can be consumed by the cron within 15 min; capture immediately or expect it.
3. **`AutoCompleteBanner` ignores `countdown.ts` urgency** — a 2-band component masquerading as part of a 4-band system; a maintenance trap for anyone editing `countdown.ts` thresholds expecting the banner to follow.
4. **No AX exposure for the occluded timeline region** — the AX tree silently omitted a contiguous block (`message-button` + safe-meetup card) without any warning that it had done so. The §5.1 AX-truncation discipline covers *character* truncation but not *silent region omission*; a "if an expected sibling is missing, cross-check its adjacent JSX siblings" heuristic would have saved ~6 calls.
5. **`qa:ocr --region` on a mid-transition screenshot returns the wrong frame's content** — one OCR pass read the tab bar because the screenshot landed during a remount. Re-capture after the tree confirms the target state (already implied by §5.6, but the failure mode is a silent wrong answer, not an error).

## 12. Suggested to improve agent rules

- **Amend R77 #12** with the device-side-quoting fix for `&`-separated adb deep links (concrete, verified this round).
- **New rule — sibling-gap heuristic on missing AX elements:** when an element you *expect* by source condition is absent from the AX tree, immediately check its **adjacent JSX siblings**; if they are missing too, treat it as a **region omission / occlusion** (pinned footer, tab bar) rather than a locator gap, and switch to scroll + OCR as the authority.
- **Staging cron-window note:** `process-auto-complete` `*/15`, `send-*-reminders` `*/5`, `process-expired-offers` `*/2` — record these windows in repo memory so "expired-state" fixtures are staged knowingly.
