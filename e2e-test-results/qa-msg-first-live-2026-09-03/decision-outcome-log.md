# MSG First-Live Execution — Decision-and-Outcome Log (2026-09-03)

**Run:** MSG manual-testing guide, first live round against the fully-audited/rewritten copy (`cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`).
**Reference for process analysis:** `e2e-test-results/qa-msg-first-live-2026-09-03/` (this log + `report.md` + `screenshots/`).
**Device:** iPhone 17 Pro Max sim (iOS 26.1) · **Staging:** `drntwgporzabmxdqykrp` · **Personas:** test-buyer / test-seller.
**Result:** 23 PASS · 0 FAIL · 1 BLOCKED (B05 screen-render) · 1 NOT-SUPPORTED (J05); ~235–250 tool executions.
**Notation:** call counts per phase are approximate reconstructions from the session trace (labeled "≈"), sufficient for friction ranking, not an exact profiler.

Every row below is one "action that mattered": **Action → Reasoning → Key tool call(s) → Outcome**, so an AI agent can replay the agent's reasoning, not just the verdicts.

---

## Phase map (what happened, in order)

| # | Phase | Approx calls | Result |
|---|---|---|---|
| P0 | Recon: playbook/guide/memory reads, env busy-check, DB fixture-feasibility | ≈30 | Fixture picture + MSG table discovery |
| P1 | Group B (B01–B03 badges, B05 leaderboard reachability) | ≈38 | 3 PASS + 1 real finding (B05 deep-link dead) |
| P2 | Group I detour (I03–I06) — triggered by a mis-tap that landed on Notification Center | ≈28 | I03/I04/I05 PASS, I06 partial |
| P3 | Group J (Notification Preferences: J01–J04) | ≈35 | 4 PASS; toggle-under-header trap found |
| P4 | Group C (C01–C06, full group) + 2 persona switches | ≈55 | 6 PASS |
| P5 | Group A (A01–A03, A08, A09) | ≈34 | 5 PASS |
| P6 | Group F (F01–F05) | ≈20 | 5 PASS |
| P7 | Report + memory consolidation | ≈8 | — |

---

## Phase-by-phase trace

### P0 — Recon & fixture pre-checks (≈30 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| Read `.github/instructions/QA-Test-Agent.instructions.md` (playbook) + repo memory `qa-test-agent.md`, `qa-test-accounts.md`, `schema-cheat-sheet.md` | Agent is bound to §5 operating rules + §7 persona registry + R-NEW-3 schema-consult before SQL | `read_file` ×3, `memory view` ×2 | Operating context loaded. Memory files live under `/memories/repo/` (not the workspace path — first `read_file` on the workspace copy 404'd; corrected). |
| Environment busy check (R29) | Never start against a simulator/admin session another agent may be driving | `xcrun simctl list devices booted`, `ps` scan, `curl` Metro :8081 / admin :3001 / web :3002 | Clean: iPhone 17 Pro Max booted, Metro+admin+web live, no `run-suite.sh`/maestro/playwright run in flight. App installed ("Pass It Up!"). |
| Find Supabase project + confirm app state | DB reads need the right project id; app may hold a stale session | `mcp_supabase_list_projects` → `drntwgporzabmxdqykrp`; `mobile_list_apps`; `mobile_take_screenshot` | Screenshot returns a **URI only, not pixels** (R5 — all visual checks must route through `qa:*` OCR/pixel scripts, not `view_image`). |
| Discover MSG tables (schema) | The guide touches many tables not in the cheat-sheet | `information_schema` scan for message/review/badge/notif/referral/id-verification table names | 30+ tables named. **Gotcha:** a single multi-table `information_schema.columns` query returned columns interleaved across 9 tables WITHOUT `table_name`, so column-to-table attribution was ambiguous — had to re-query specific tables later (see P4 `review_reports` 42703). |
| Persona state read-backs (parallel read-only SQL) | R-NEW-6 fixture-feasibility BEFORE any device work | trades/messages/reviews/user_badges/user_notifications/notification_preferences/id_badge_verification_requests queries | test-buyer: node "Diag Test Node", 3 in-progress trades, 11/13 badges earned, 25+ unread notifications, all 5 pref rows; test-seller: 2 prior reports on his reviews; **no `leaderboard_rank_up` notification for ANY user; no standing pending ID request for test personas**. |
| Relaunch app cleanly + `qa-login-as?persona=test-buyer` | Leftover session from a prior task (Transaction History screen); deep-link persona switch is the canonical clean entry | `terminate_app` → `launch_app` (bundle ~10s) → `qa-login-as` openurl → tree poll | Landed on Home as test-buyer. |

**P0 lessons:** (1) the MSG table set is NOT in the schema cheat-sheet → every query this run was a guess-and-verify instead of a one-shot; (2) interleaved `information_schema` output cost an extra query; (3) screenshot tooling is URI-only (known, but recon confirmed). All three are cheap to fix (see §Derivation-c).

### P1 — Group B: B01/B02/B03 badges + B05 leaderboard reachability (≈38 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| Profile → tap `badge-showcase` ("My Badges") | B01 grid is on the My Badges route | tree list → tap (220, 923) | My Badges screen; **grid tiles are NOT AX-exposed** — tree shows only header + tab bar. |
| OCR the grid to enumerate tiles | Tiles are image+label; AX silent → OCR is the primary channel | `qa:ocr` | 13 badge names readable (SP Earner Bronze/Gold/Platinum, 50 Trades, 1-Year Subscriber…). |
| Read `BadgesScreen.tsx` + DB badge catalog | Two-source corroboration (source rule + data path) for earned-vs-locked styling; get badge names for test-buyer's 11 earned | `read_file` ×2, read-only SQL | Source: earned cell `#FFF9EC`, locked `#F7F7F7`@0.6 + `#999999` label; DB earned set = 11/13. |
| Pixel-scan grid region for `#FFF9EC` | Prove the "highlighted yellow" treatment renders, not just source | `qa:badge-scan --region` | 40.4% of grid region = cream → **B01 PASS**. (~6 calls: nav + OCR + 2 reads + scan.) |
| Tap top-left tile (estimated coords) | Tile not AX-exposed → derive position; first-guess-confirm rule | click (77,168) | Native badge-detail modal opened — **tree blanks to status-bar-only** (native `ui/Modal`); verified via screenshot. |
| OCR modal + locate green Close pill | R1: native modal invisible to AX → straight to OCR/pixel-scan | `qa:ocr` modal; `qa:badge-scan` region for `#5DBB8E` ×2 (broad then narrowed y-band) | Earned modal: name + description + **"Unlocked: 8/28/2026"** (matches DB). Green pill pinned to y~2520–2820px → tap pt (220,888) → **B02 earned leg PASS**. |
| Tap a locked tile (row3col3, estimated) | Exercise the locked-state modal leg | click (363,396) | Locked modal (50 Trades): name + description + Close, **no Unlocked date**; gray Lock icon per source → **B02 locked leg PASS**. (~10 calls for the two modal legs — modal coordinate-location dominated.) |
| Back to Profile; OCR the `badge-showcase` region | B03 asserts count + strip | screenshot + `qa:ocr --region` | **"My Badges (11)"** count visible. |
| Swipe Profile to reveal the strip — overshot twice | Flingy-scroll class (§5.9): swipes move far more than requested | `swipe` ×2 + screenshots | Overshot past the showcase both times; strip visual left to source+OCR (badge names "SP Earner Platinum/Gold…" later seen in the strip). **B03 PASS** on count + navigation + source; extra ≈4 calls from scroll overshoot. |
| **B05:** fire `/leaderboard` deep link twice → no navigation | Guide claims deep-link reachability; must verify empirically | `openurl p2pkidsmarketplace://leaderboard` ×2 + tree polls | No navigation (stayed on Profile). |
| Investigate source: `deepLink.ts`, `AppNavigator` linking config | R12/R18: confirm root cause from source before recording | `read_file` deepLink.ts + AppNavigator linking | **Finding:** `linking.config.screens` has NO `Leaderboard` (nor `Badges`/`SpWallet`/`Referrals`/`Chat`/`TradeList`) path; `deepLink.ts` is only the *notification* deep-link service. So raw `/leaderboard` cannot navigate — only a `leaderboard_rank_up` notification tap reaches it. |
| DB check for any `leaderboard_rank_up` notification | Decide notification-tap path feasibility | read-only SQL on `user_notifications` type=`leaderboard_rank_up` | **Empty for all users** → screen-render leg BLOCKED (fixture-gated). B05 = **real doc-drift finding** + BLOCKED render leg. (~9 calls; high value — a genuine reachability defect found.) |

**P1 lessons:** the deep-link "try then investigate" pattern cost ~9 calls; the dead-end was provable from a 30-second source grep BEFORE firing (linking config lacks the path). Grid/modal AX gaps drove most of the other calls.

### P2 — Group I detour triggered by a mis-tap (I03–I06, ≈28 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| On Notification Preferences, tapped `toggle-trades-push` at its AX-logical y94 | Intended the J01 toggle test | click (370, 94) | **Mis-tap — hit the fixed header bell** (header-notifications-btn occupies the same y-band) → opened Notification Center. |
| Recognized the incidental Notification Center and repurposed it (R10/§5.33) | test-buyer has 25+ unread notifications — Group I fixtures are here; avoid discarding the state | — | Started Group I in-place instead of navigating back (net-neutral detour). |
| **I03:** OCR the list + pixel-scan the icon column | Assert per-type icon chips render with color | screenshot + `qa:ocr` + `qa:badge-scan` for `#E8F5F0` chip | Titles + bodies + relative times ("21h ago"); green icon chips 24% of icon column → **I03 PASS**. |
| **I04:** tap "New message from Test Seller" notification | Verify notification → deep link + mark-read | click on item → tree; read-only SQL `is_read` | Navigated to **Chat**; DB `read_at` set → message leg PASS. |
| Back → tap "Trade Complete" notification | Second destination type (trade → My Trades) | click → tree; DB | Navigated to **My Trades**; DB read → trade leg PASS. |
| Locate an SP notification for the wallet leg | I04 wants SP→Wallet too | list → SP item is below the fold (y1434) | Skipped scrolling (diminishing value); remaining destinations share the same source-verified `parseNotificationDeepLink` mechanism → I04 PASS (2 live legs + source). |
| **I05:** tap "Mark all read" | Bulk-read case | click header link → DB | Unread 25+ → **0** over 1067 rows → **I05 PASS** (state change flagged). |
| **I06:** swipe deep into the list | Verify pagination loads past page 1 | swipe up 700 + tree count | Older items (page ≥2) render; AX only exposes ~9 in viewport at a time → pagination evidenced. Pull-to-refresh gesture not driven (needs a top pull; budget). I06 **partial**. |

**P2 lessons:** the mis-tap was *preventable* — the toggle sat at an AX-logical y inside the fixed-header band (a R17-class overlap I hit live). The Group I work itself was efficient because the fixtures (notifications) were rich; the only real cost was the J01 toggle needing re-attempts in P3.

### P3 — Group J: Notification Preferences (J01–J04, ≈35 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| Settings → Notification Preferences (route entry per the rewritten guide) | J-group targets the LIVE screen | click `settings-notification-preferences-button` | Live screen open; **fully AX-exposed** (17KB tree). |
| Parse tree for categories/toggles | Enumerate the 5 categories + `toggle-<cat>-push|in_app|email` | node parse of tree | 5 categories match the guide exactly (Subscription & Membership / Swap Points Events / Badges & Achievements / Trades & Transactions / System Updates), no Safety. |
| Scroll down; parse again for System Updates + Quiet Hours + footer | J03 footer + J04 quiet-hours live below the fold | swipe + tree parse | Footer copy **"Critical system alerts and safety notifications cannot be disabled."** → J03 PASS; Quiet Hours section (toggle + Start/End + Save). |
| **J01:** toggle `toggle-system-push` at mid-viewport y377 | Choose a mid-viewport toggle (NOT the top-of-scroll one that caused P2's mis-tap) | click → DB | `system.push_enabled` true→false→true, DB-verified both ways → **J01 PASS**. |
| **J04 invalid:** tap Start input (125,750) → Cmd+A → type "9pm" | R3: select-all-and-retype; invalid value for the validation path | click, `osascript Cmd+A`, `type_keys` | Field shows "9pm" (OCR). |
| Dismiss keyboard + tap Save | §5.19 hard gate: never tap below-fold with keyboard up | screenshot to confirm keyboard gone → click Save (220,806) | GlobalAlert **"Invalid time format / Please use 24-hour format: HH:MM (example: 22:00)."** → invalid leg PASS. |
| **J04 valid:** Cmd+A → "21:30" → Save → DB verify → restore "22:00" | Drive a real persist, then leave the shared persona at baseline | click, Cmd+A, `type_keys`, click Save, DB ×2 | **"Saved / Quiet hours have been updated."** + DB `21:30:00`, restored to `22:00:00` (DB-verified) → **J04 PASS**. |
| Diagnose the P2 mis-tap (why did the toggle hit the bell?) | Understand the trap so it isn't repeated | screenshot + OCR | AX-logical y for content scrolled under the fixed header **overlaps the header band**; the tree reports scroll-content coords that render beneath the pinned header. Rule: only tap toggles mid-viewport. |

**P3 lessons:** the J-group was otherwise cheap BECAUSE the screen is fully AX-exposed. The whole P2 detour + J01 re-attempt trace to one trap (header-band overlap) worth a targeted fix (`qa:ax-tree` occlusion flags already exist — a `--header-bottom` band flag would catch it).

### P4 — Group C: C01–C06 + 2 persona switches (≈55 calls — largest phase)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| **C05:** deep link to test-seller's public profile | `/seller-profile/:userId` is a registered linking path | `openurl p2pkidsmarketplace://seller-profile/14be337c-…` | Seller Profile open: **4.3 + (3 reviews)**, **"Reviews (3)"**, histogram 5★:1/4★:2, cards (Test Buyer 2, Anonymous User). No stale strings; 0 review-⋯ menus for a non-owner (correct) → **C05 PASS**. |
| Switch persona to test-seller (`qa-login-as`) | C06 is reviewee-only; test-seller is the reviewee of 3 reviews | openurl → Profile | test-seller's own Profile shows Recent Reviews with **3 `review-menu-button`** entries. |
| Scroll to reviews; DB dedupe check on existing reports | Avoid the "already reported" dead-end (codified fact) | read-only SQL `review_reports` | `20c09442` + `14372222` already reported by test-seller in prior QA → pick clean target = `8b65662d` (Test Buyer's 4★). |
| Tap ⋯ on Test Buyer review → report sheet | Open the report action sheet | click menu (390,755) → tree | **4 options incl. "Report Other"** (`review-report-other`) — the new 4th option. |
| Report Other → confirm → success | Drive the new option end-to-end | click `review-report-other` → confirm `global-alert-button-1` → tree | **"Review reported. Thank you!"** (GlobalAlert, not native Alert — minor doc drift) + DB `review_reports` row (reason `other`) → **C06 PASS**. |
| Switch persona back to test-buyer | C01–C04 need test-buyer as reviewer with completed trades | `qa-login-as?persona=test-buyer` | Home. |
| Navigate to a completed trade's review entry | SubmitReview route needs `{tradeId,…}` — reach via completed-trade timeline | My Trades → Active/History subtab confusion (see below) → settled on **`/trade/<id>` deep link** (works, DT77) | Trade Timeline for completed Kids Bicycle (`01121468`). |
| **Navigation friction:** My Trades shows summary filters (Your Offers/In Progress/Needs Action/Completed) × subtabs (Active/History) — several re-lists to figure out which shows completed trades with Message/Review | Unfamiliar multi-level list structure | tree lists ×4 | ~8 calls before using the deep link as the primary entry. Lesson: deep-link-first to the trade; don't fight the list. |
| Scroll timeline to bring `review-button` above the tab-bar band (R31) | Review CTA at y918 sits under the floating tab bar | swipe up 250 + re-list | review-button at y772 → tap → SubmitReview ("Review the seller"). |
| **C02:** tap Submit with no star | Rating-required validation | click submit → tree | **"Rating Required / Please select a star rating before submitting."** → C02 PASS (no data). |
| **C01:** select 5★ + tap comment input + type comment + verify 66/500 | Stars fill + live char count | click star 5, click input, `type_keys`, screenshot + OCR | Comment + **66/500 characters** visible; keyboard up. |
| Dismiss keyboard (Cmd+K), confirm gone, tap Submit | §5.19 gate; multiline comment has no AX-visible Done accessory | `osascript Cmd+K`, screenshot + OCR to confirm, click submit | Success **"Your review has been submitted!"** + DB review `f4f3205f` (5★, named) → **C01 PASS** (audit caveat cleared). |
| **C04:** `/trade/<id>` → another completed trade (Puzzle Set `9880dc1c`) → scroll → Review → **Skip for Now** | Skip leaves no data | openurl, swipe, clicks, DB count | Returned to timeline; DB 0 reviews → **C04 PASS**. |
| **C03:** `/trade/<id>` → Remote Control Car `d55a58a8` → Review → toggle Post anonymously + 4★ → submit | Anonymous submission leg | clicks, submit, DB | Success + DB `8565e7f8` `is_anonymous=true` → **C03 PASS**. |

**P4 lessons:** (1) the persona-switch cost (~2 cycles × few calls) is the standing "login tax" — batch by persona (R19) matters; (2) My Trades multi-level list cost ~8 calls before deep-link-first took over; (3) two **review submissions created residue on shared test-seller data** — unavoidable for live C01/C03 but must be flagged for cleanup; (4) the C06 dedupe DB pre-check is a **reuse-worthy pattern** (killed a guaranteed dead-end in one call).

### P5 — Group A: Messaging (A01–A03, A08, A09; ≈34 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| Open Messages (header chat icon) | A01 conversation list | click header-chat-btn | Conversation list (4 convos w/ Test Seller): name + trade chip + preview + relative time + unread "1". |
| Search "Remote" then "zzzzqq" | Search-filter + no-result legs | click search field, `type_keys` ×2 (Cmd+A between) | "Remote" → 1 result; "zzzzqq" → **"No matches found / Try a different search term"** → A01 search legs PASS. Empty-inbox leg fixture-gated (test-buyer has 4 convos). |
| Navigate to an ACTIVE chat for A02/A03/A08/A09 | Completed-trade chats are read-only ("Chat is no longer active") — need an in-progress trade | My Trades → Active subtab → Message button on Cash-Only Item (`943097a5`) | Active Chat opens; first-open triggers the **safety modal**. |
| **A09:** OCR + dismiss the safety modal | Modal = "Trade Smart, Trade Safe" + "Got it — Let's Trade Safely" (brief spot-check copy) | screenshot + OCR, click `safety-modal-confirm` | Exact copy confirmed → A09 modal leg PASS. |
| **A02:** verify header + trade context banner in the active chat | Chat thread header + banner | tree | Header (TS/Test Seller/Cash-Only Item) + banner "Cash-Only Item • $20.00" + View Trade → A02 PASS. |
| **A08:** (accidental) chip tap inserted the 🗓 Suggest-times payload into the input; send button appeared | Chip→input insertion is the A08 mechanism | tap near chip row → tree | Input prefilled "I'm available on [DATE] at [TIME]…"; send button visible only-with-text (A03 sub-assert). |
| **A03:** tap Send → message bubble + DB | Send leg | click send → DB | Right-aligned bubble w/ timestamp; DB `d7788d55` `delivery_status: sent` → A03 send leg PASS. Delivered→read needs the recipient persona (single-sim limit). |
| **A08 confirm:** read `QuickReplyChips.tsx` + reveal chips | Verify the exact 5-chip set + "+ More" (INITIAL_VISIBLE=3) | read_file + tree | **5-chip set matches the brief exactly** (today/tomorrow/suggest/public-place/running-late); 3 visible + "+ More" on device → A08 PASS. |
| **A09:** tap the in-chat safety banner | Banner→modal re-open | click `safety-banner` → tree | Modal re-opens → A09 PASS. |
| A04/A05/A07/A10 | Assessed, not driven | — | Real-time/typing need 2 concurrent sessions; A07 needs a 2000-char paste (cost); A10 needs OS permission control; A06 needs the native picker. Ledgered with reasons. |

**P5 lessons:** cheap once on an ACTIVE chat (fixture = an in-progress trade's Message button). The guide's assumption that test-buyer has an in-progress trade with an existing thread was wrong (the in-progress trades had no messages) — reaching an active chat required the My Trades → Message path, which is itself a worthwhile recon fact to record.

### P6 — Group F: Referrals (F01–F05, ≈20 calls)

| Action | Reasoning | Key tool calls | Outcome |
|---|---|---|---|
| Profile → tap "Share & Earn" card | test-buyer has a referral code (fixture from profile OCR earlier) | tree parse → click (220,655) | **Referrals** screen: hero "Refer Friends, Earn SP", code `42dvco4j`, rewards, history. |
| **F01/F04/F05:** read the screen (AX-exposed) | Assert hero/code/rewards/empty-history | tree | F01 (hero+code+SP strip), F04 (First Trade +20SP / First Listing +25SP / referrer 40·10), F05 ("No referrals yet — share your code!") all match. |
| **F02:** tap copy → alert | Copy confirmation | click copy-btn → tree | **"Copied! / Referral code copied to clipboard"** → F02 PASS. |
| **F03:** tap Share → native sheet | Share sheet opens with the message | click share-btn → screenshot + OCR | Native iOS share sheet with "Join Kids Club+ and get 20 SP for trade…" + actions → F03 PASS. Dismissed by tapping the dimmed area. |
| Note: "Share & Earn" card is NOT a distinct AX button (locator gap) | Tapped by derived coordinates | — | Flagged as locator gap. |

---

## Call-cost heatmap (highest-friction actions this run)

| Friction | Where | Approx cost (calls) | Root cause |
|---|---|---|---|
| Grid/list content invisible to AX (badge tiles, notification icon chips, showcase strip) | P1, P2 | ~12–14 across B01/B02/B03/I03 | Image-based tiles without per-tile `testID`/accessibilityLabel → every assertion = screenshot + OCR + pixel-scan |
| Native modal coordinate location (badge detail modal) | P1 | ~6 | Modal blanks the tree → OCR + 2-step pixel band scan to find the Close pill |
| Header-band AX-logical-y trap → mis-tap (opened Notification Center) | P2/P3 | ~6 (the mis-tap + J01 re-do + diagnosis) | Toggles scrolled under the fixed header report logical y overlapping header buttons |
| My Trades multi-level list (summary filters × Active/History subtabs) | P4 | ~8 | Unfamiliar list structure; resolved by `/trade/<id>` deep link |
| Persona switches | P4 | ~6 (2 cycles) | Standing login tax (R19) |
| Keyboard dismiss + select-all per form field (Cmd+A/Cmd+K) | P3, P4 | ~6–8 | No reliable AX-visible Done accessory on multiline/comment inputs; osascript round-trips + re-list + screenshot to confirm |
| Profile flingy-scroll overshoot | P1 | ~4 | Swipes move far beyond requested distance |
| B05 deep-link dead-end discovery | P1 | ~9 (but produced the run's top finding) | Deep-link "try then investigate" instead of a source pre-check |
| MSG table schema discovery | P0 | ~4 | Tables not in the schema cheat-sheet; one interleaved `information_schema` output was ambiguous; `review_reports` 42703 on first guess |

---

## Derivation (a) — What slows execution (ranked, with fixes)

1. **AX-invisible image grids/lists (badge grid tiles, notification icon chips, showcase strip).** Every earned/locked, per-type-color, and grid-structure assertion degenerated into screenshot→OCR→pixel-scan. Highest per-assertion cost in the run. **Fix:** per-tile `testID` + `accessibilityLabel` on the grid cells and icon chips (BP-53) — turns each into a one-read tree assertion.
2. **Fixed-header overlap of scrolled content's logical coords.** Caused the single largest self-inflicted cost (an accidental navigation) and is a standing trap for any scrollable screen with a pinned header. **Fix (tooling):** `qa:ax-tree` already flags `under-pill`/`below-viewport`; add a `header-band` flag (y < headerBottom) so no agent taps a scroll element whose logical y overlaps the header. **Fix (rule):** only tap scroll-list toggles/buttons mid-viewport.
3. **Persona + navigation tax (My Trades, deep settings stacks).** Two persona switches and the My Trades multi-level list cost ~14 calls. **Fix:** `/trade/<id>` and `/seller-profile/<userId>` deep links are the primary entry (confirmed working) — record them as the default navigation for trade/review work (R-NEW-2 cache). A `/submit-review?tradeId=` deep link would remove the scroll-to-CTA hop entirely.
4. **Native modals blanking the AX tree** (badge detail). Cheap when the app's own branded modals are AX-exposed (they were this build — positive), but the badge-detail modal Close still needed pixel work. **Fix:** give the badge modal Close a `testID` (it has none), matching the instrumented confirmation buttons elsewhere.
5. **Keyboard dismiss/select-all per field.** The Cmd+A→retype→Cmd+K→confirm sequence is reliable but verbose (≈3–4 calls per field). **Fix:** ensure the app-wide `keyboard-done-button` accessory surfaces in the AX tree on every TextInput including multiline comment fields (it was AX-silent on the review comment this run), giving a one-tap in-app dismiss.
6. **Schema re-discovery for the MSG feature tables.** Cost a handful of calls but recurs every run. **Fix:** fold the verified column sets into `/memories/repo/schema-cheat-sheet.md` (R-NEW-3 standing duty).

## Derivation (b) — Patterns an agent should adopt proactively

1. **Deep-link-first, and verify the linking config before firing.** `/trade/<id>`, `/seller-profile/<userId>` work; `/leaderboard` does NOT (and the reason is provable in 30s: is the route in `AppNavigator` `linking.config.screens`?). Before trusting any guide's "reachable via `/x` deep link", grep the linking config — not after two failed deliveries.
2. **DB dedupe/pre-condition check before shared-data mutations.** The C06 report would have dead-ended on "already reported" without the one-query `review_reports` check. Same class as the codified "fresh fixtures may not be fresh" fact. Apply before report/submit on shared personas.
3. **On scrollable screens with a pinned header, tap only mid-viewport controls.** This one rule would have prevented the run's only real mis-tap (Notification Center detour).
4. **Reuse incidental navigation states.** The mis-tap opened Notification Center with 25+ unread rows — an I-group fixture — so the "mistake" became the I03–I05 run. (R10/§5.33.)
5. **When a screen is AX-exposed, read it in one parse** (categories, toggles, counts) instead of many small list calls — Group J and Referrals were the cheapest phases precisely because the full tree parse answered most assertions at once.
6. **Source-read the exact visual rule before pixel work** (earned `#FFF9EC` vs locked `#F7F7F7`, chip `INITIAL_VISIBLE=3`) so one targeted pixel scan or OCR suffices as the on-device confirmation.
7. **Two-source corroboration for anything not directly assertable** (empty states, locked-badge "keep going" nuance) — source + DB beats an unobservable UI.

## Derivation (c) — Instrumentation / fixture work that removes the friction (ranked)

1. **App linking config:** add `Leaderboard` (and `Badges`, `SpWallet`, `Referrals`, `Chat`, `TradeList`) to `AppNavigator.linking.config.screens`. Unblocks the B05 deep-link leg + makes several guides' "reachable via deep link" claims true. *(Highest-value single change; also corrects a guide-currency finding.)*
2. **`leaderboard_rank_up` fixture / badge-award QA trigger.** Nothing can currently reach the Leaderboard screen live (no notification exists for any user; raw deep link dead). A seeded `leaderboard_rank_up` notification for a test persona (or a `qa-badge-award` trigger) unblocks B05 render AND B04's celebration modal.
3. **AX-instrument the image grids:** per-tile testIDs/labels on the My Badges grid and the notification icon chips; a `testID` on the badge-detail-modal Close. Turns pixel/OCR work into tree reads.
4. **`qa:ax-tree` header-band occlusion flag** (elements whose logical y overlaps the pinned header) — catches the P2 trap before a tap.
5. **`qa:scroll-to?testID=` deep link** (previously proposed) — removes the flingy-scroll positioning cost on Profile/long lists (B03 spent ~4 calls just placing the showcase).
6. **AX-visible `keyboard-done-button` on multiline TextInputs** (review comment field this run) — one-tap keyboard dismiss instead of the Cmd+K round-trip.
7. **A `/submit-review?tradeId=` deep link** — removes the My Trades → timeline → scroll → Review-button hop (~6 calls per review case).
8. **Schema cheat-sheet update:** append the verified MSG table column sets (`messages`, `reviews`, `review_reports`, `user_notifications`, `notification_preferences`, `user_badges`/`badges`, `id_badge_verification_requests`, `referrals`) so P0 recon is one query instead of guess-and-verify.
9. **Seed fixture:** a no-conversation persona for A01's empty-inbox leg, and/or an in-progress trade WITH a pre-seeded message thread (the guide assumes "in-progress trade so a chat thread exists" — on this data the in-progress trades had no threads, which cost recon to discover).

---

## Run roll-up (for cross-reference)

23 PASS / 0 FAIL / 1 BLOCKED (B05 screen-render, fixture-gated after a real reachability finding) / 1 NOT-SUPPORTED (J05).
Full verdicts + DS/copy notes + App-State-left-behind: `report.md` in this folder.
