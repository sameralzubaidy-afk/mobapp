# QA Task 9 — Dev Task 63 Fix-Verify + Carried-Forward Cases (Rev 2)

- **Date:** 2026-08-30
- **Run folder:** `e2e-test-results/qa-task9-dt63-fix-verify-2026-08-30/`
- **Surface:** iOS mobile app (`Pass It Up!`, `com.sameralzubaidi.p2pmarketplace`, iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)
- **Backend:** Supabase staging `drntwgporzabmxdqykrp`
- **Method:** Real on-device interaction (no scripted automation), disposable fixtures, DB read-backs closing every money/state assertion (R11/R24), Dev Task 51/65 tooling (`qa-login-as`, `qa:reset-offer-fixtures`, `qa:admin-config-set`, `qa:ef-repro`).
- **Personas:** test-buyer (`49243010-…`), test-seller (`14be337c-…`, wallet frozen — benign), test-seller-2/-3 (saved-cart fixtures).
- **HEAD:** `e7b16e5e` = Dev Task 65 + Dev Task 63.

---

## Roll-up verdict

| # | Item | Verdict | Key assertion |
|---|---|---|---|
| 1 | **M13** — realtime-unavailable item excluded from cart subtotal (client + server agree) | ✅ **PASS** | cart $98→$80 (client) == `rpc_cart_validate_for_checkout` `cart_total_cents=8000` + UNAVAILABLE_ITEMS |
| 2 | **Checkout Max SP** — correct SP max for a 4-SP buyer via `computeMaxSpForItem` | ✅ **PASS** | "Max: 4 SP" (min(cap 9, wallet 4)) — was "Max: 0 SP" pre-fix |
| 3 | **Confirm All 2 → Done! perf** — fresh 2-item bundle, sub-second completion spread | ✅ **PASS** | `completed_at` spread **0.91s** (was ~7s serial); total tap→Done ~8s (per-call latency) |
| 4a | **M10 doc-drift** — guide matches app (server rejects 4th save, no LRU) | ✅ **PASS** | "You already have 3 saved carts…", all saved carts preserved, Switch works |
| 4b | **N02 doc-drift** — guide matches app (no $5 floor, negative rejected at UI, 0=no min) | ✅ **PASS** (+ finding) | **RPC layer accepts negatives (no server-side guard)** |
| 4c | **M12 doc-drift** — app matches guide (dynamic "Up to N SP", real category cap) | ✅ **PASS** | Bicycle 45 / QA Canned 10 / Puzzle 9 SP (Sports 75%, Toys 50%, Toys 50%) |
| 4d | **M20 doc-drift** — app matches guide (heart icon → Favorites) | ✅ **PASS** | Heart + a11y "View Favorites" → Favorites |
| 5 | **IssueReportModal AX** — `testID=issue-report-modal` + `accessibilityRole="alert"` on-device | ⚠️ **PARTIAL** | Container does NOT surface in AX tree (BP-53 class); modal children fully AX-exposed |
| 6 | **M05** (carried-forward) — own-item add | ✅ **PASS** | Add to Cart hidden for owner; server `SELF_PURCHASE` blocks self-buy |
| 7 | **M16** (carried-forward) — toast auto-dismiss + announce | ✅ **R38 class** | `AX-tree-exposure-verified, VoiceOver-interaction-not-directly-testable` |
| 8 | **M18** (carried-forward) — toast "Trade Basket" copy | ✅ **R38 class** | Copy confirmed on ALL 3 add paths |
| 9 | **UX browse copy** — dynamic "Browse N More Items" | ✅ **CONFIRMED** | "Browse 2 More Items" (correct remaining count) |
| 10 | **UX toast a11y announce** | ✅ **R38 scoping** | `announceForAccessibility` source-verified; utterance not tool-testable |

**Roll-up: 9 PASS · 1 PARTIAL (IssueReportModal container) · 0 FAIL · 0 BLOCKED · 2 R38 accepted-class (M16/M18)**

---

## Per-case detail

### 1. M13 — realtime-unavailable item excluded from cart subtotal — ✅ PASS
- **Fixture:** 3-item cart (Puzzle $18 + QA Canned $20 + Bicycle $60, subtotal $98).
- **Steps:** Marked Puzzle Set `sold` via SQL (reversible, test-seller "another device" equivalent) → realtime channel propagated → cart row showed inline **"This item is no longer available"** (`cart-item-unavailable-…`), badge reverted to plain "Accepts Points", **subtotal $98 → $80** (client, `calculateSubtotal` excludes unavailable).
- **Server-side (DB read-back via buyer session):** `rpc_cart_validate_for_checkout` returned `cart_total_cents: 8000`, `item_count: 3`, `errors: [UNAVAILABLE_ITEMS count 1]` — **agrees with the client $80**. The blocked-checkout modal showed "Could not validate cart / One or more items are no longer available".
- **Verdict:** the DT-63 item-1 fix is verified end-to-end (client display == server total). Item restored to `available` afterward.

### 2. Checkout Max SP — ✅ PASS
- **Fixture:** test-buyer (4 SP real balance, sub active), Puzzle Set ($18, Toys 50% cap → maxAllowed 9).
- **On-device:** checkout showed **"Points remaining: 4"** and **"Max: 4 SP"** = `min(category cap 9, wallet 4)` via `computeMaxSpForItem` — the exact QA-observed regression scenario (4-SP buyer previously seeing "Max: 0 SP"). A 2-item bundle later showed **"Max: 4 SP"** on BOTH items (multi-item shared-wallet behavior correct).
- **Verdict:** DT-63 item-2 fix confirmed on-device with a known real balance.

### 3. Confirm All 2 → Done! perf — ✅ PASS
- **Fixture:** fresh 2-item bundle (`bundle_id 03b0f1e3`, Puzzle $18 + QA Canned $20, cash 0 SP). Buyer offered → seller Accepted All (both `in_progress`, PaymentIntents charged) → buyer Confirm All 2 → "Done!" modal.
- **DB read-back (completed_at):**
  - Puzzle `9880dc1c`: `2026-08-30 18:26:04.448`
  - QA Canned `91668589`: `2026-08-30 18:26:05.360`
  - **Spread = 0.91s** (sub-second; the pre-fix serial loop completed the two trades ~7s apart).
- **Perceived load time:** Confirm All tap (14:25:57) → "Done!" modal (~14:26:05) ≈ **8s**. The spread is the DT-63 deliverable (0.91s ✓); the ~8s total is dominated by per-`completeTradeV2` RPC latency (~7-8s each) which now runs in parallel (`Promise.all`). Flagged as a performance observation (≥3s), not a fix failure.
- **State:** both trades `completed`, payouts `pending`, SP earned 5+6=11 (seller). Items restored to `available` at cleanup.

### 4a. M10 doc-drift (guide now matches app) — ✅ PASS
- Built 3 saved carts (Bicycle $60 / Board Game Set $18 / Kids Bike Helmet $14) across 3 sellers. **4th save** (Science Kit $20) → rejected: **"Could not save cart / You already have 3 saved carts. Delete one to save a new one."** — exactly the guide's updated copy.
- **DB:** 3 saved carts preserved (no LRU eviction), Science Kit stayed active. **Switch leg:** Helmet saved→active + Science Kit active→saved (works when capacity exists).
- **FIXED (follow-up):** the switch-with-full-saved-carts error originally showed the raw string "SAVED_CART_LIMIT_REACHED: user already has 3 saved carts" (DB trigger `RAISE` text leaked via `r.error.message`). Fixed at the root cause — migration `20260830190000_fix_cart_switch_saved_limit_copy` makes `rpc_cart_switch_to_saved` pre-validate the 3-saved limit and return the friendly structured `{code,message}` (same as the save path) — **plus** a client-side safety net in `CartScreen.confirmSwitchCart` mapping the raw prefix. **Verified:** as test-buyer with 3 saved + 1 active seeded, the RPC now returns `success:false, error:{code:'SAVED_CART_LIMIT_REACHED', message:'You already have 3 saved carts. Delete one to save a new one.'}` (no raw string). Seeded rows cleaned up (0 residue).

### 4b. N02 doc-drift + `qa:admin-config-set` path — ✅ PASS (+ finding)
- Guide now matches app/admin behavior (no hard $5 floor; negative rejected at admin UI; ≥$0 saves; 0 = no minimum) — the admin-UI inline guard was verified as PASS in QA Task 7.
- **`qa:admin-config-set` (R37) re-test:** baseline `cart_min_value_cents=0` → attempted `set … -5` via the legitimate `upsert_admin_config_setting` path → **the RPC ACCEPTED −5** (read-back `value:"-5"`). **Finding: the negative-value guard is admin-UI-ONLY — the RPC/DB layer has no server-side validation for `cart_min_value_cents ≥ 0`.** Reverted to 0 + read-back verified (zero residue).
- The helper itself worked as documented (write + auto-read-back + revert all clean).

### 4c. M12 doc-drift (app now matches guide: dynamic "Up to N SP") — ✅ PASS
- With test-buyer as a genuine active subscriber, the cart showed the subscriber-only numeric badge using the REAL per-category cap:
  - Kids Bicycle $60 @ Sports 75% → **"Up to 45 SP"**
  - QA Canned $20 @ Toys 50% → **"Up to 10 SP"**
  - Puzzle Set $18 @ Toys 50% → **"Up to 9 SP"** (also Board Game Set $18 → 9 SP, Chapter Book Box Set $16 → 11 SP)
- **Fixture-state finding (root cause):** test-buyer's subscription was stale — `status='active'` but `current_period_end` (2026-07-27) is in the past while `grace_ends_at` is 2026-09-12. `is_active_subscriber()` checks `current_period_end > NOW()` (NOT `grace_ends_at`) → returned **false** → the subscriber-gated numeric badge was hidden. A reversible fixture fix (current_period_end → +30d) restored subscriber status → badge appeared → **fixture reverted** (original value restored, verified).
- Also verified: unavailable items revert to plain "Accepts Points" (no numeric).

### 4d. M20 doc-drift (app now matches guide: heart icon) — ✅ PASS
- Discover header now shows a **Heart** (`discover-header-favorites`, a11y label **"View Favorites"**) → tapping navigated to **Favorites** ("No favorites yet" empty state). Navigation-only (no toggle) per source.
- **Minor:** the icon renders neutral-gray (`ds.neutral[700]`, consistent with sibling header icons); the guide says "pink/red heart" — minor doc-drift to update.

### 5. IssueReportModal AX instrumentation — ⚠️ PARTIAL
- Reached via a real in-progress trade (Bicycle, buyer timeline → Report Problem → modal opened).
- **On-device AX tree:** ALL interactive elements surfaced (title, 5 reasons `issue-reason-*`, `issue-submit-button`, `issue-cancel-button` — BP-53 conformant). Screen-reader users can fully operate the modal.
- **BUT the container `testID="issue-report-modal"` + `accessibilityRole="alert"` did NOT surface** as a distinct AX element (the sheet `<View>` has testID + role but no `accessible`/`accessibilityLabel` → flattened on iOS). This is the same BP-53 container-exposure class as `cancel-reason-modal`. **The "alert" announcement semantics are NOT delivered** — the DT-63 item-5 claim ("present and usable on-device") is only partially met (present in source; role inert on-device).
- **Fix recommendation (dev):** add `accessible` + `accessibilityLabel="Report an Issue dialog"` to the sheet View (mirrors the documented cancel-reason-modal fix), or move the alert role onto an element that actually renders as an accessibility element.
- Modal copy verified parent-appropriate ("What went wrong with this trade?", clear reason rows). Design-system: warning icon amber `#D97706`, reason rows with radio affordance, green Submit — no deviations found.

### 6. M05 own-item add (carried-forward) — ✅ PASS
- As test-seller (owner), opened own available listing (Kids Bicycle): **Add to Cart button is HIDDEN** (CART-014 gate `user?.id !== listing?.seller_id`). 
- Server blocks self-purchase at the EF layer: `create-trade-offer` returns `SELF_PURCHASE` ("Cannot buy your own item") at both the single and batch paths (source-verified).
- **Related UX finding:** the **"Request to Buy" CTA is NOT gated for the owner** — tapping it on an own listing navigates into the offer flow, which ultimately fails server-side. Recommend hiding/`disabled` the CTA for owners (or showing "You can't buy your own item").

### 7/8. M16/M18 toast capture (carried-forward) — R38 accepted class
- **Capture attempts (all miss the 2.5s window):** immediate + delayed screenshots on two adds (badge-scan confirmed no toast band), AX-tree catch post-add, screen-recording (1.4MB captured but no ffmpeg available to extract frames).
- **Source-verified (strong):** toast renders on `ItemDetailScreen` + `MoreFromThisSellerScreen`; copy **"Added to Trade Basket"** on all 3 add paths (direct 941/946, Save & Start New Cart 968, Replace Cart 985) with Trade Basket-language subtitles (M18 ✓); auto-dismiss `duration=2500`; non-blocking absolute-positioned Animated.View; `announceForAccessibility(message)` fires on visible→true (SuccessToast:66, DT-63 item 7); AX config `success-toast`/`accessibilityRole="alert"`/`accessibilityLiveRegion="polite"`.
- **Verdict:** `AX-tree-exposure-verified, VoiceOver-interaction-not-directly-testable` (accepted R38 class) — the toast's AX config + announce call are verified; the 2.5s transient visual/AX catch and the VoiceOver utterance itself are not directly testable with the current toolset (same conclusion as QA Task 7 D4, now classified per Dev Task 65 instead of ambiguous PARTIAL).

### 9/10. UX confirmations — ✅ CONFIRMED
- **Dynamic "Browse N more items":** set `cart_min_value_cents=2500` → added Chapter Book Box Set ($16) → banner showed **"Add $9.00 more to check out"** + **"Browse 2 More Items"** (correct remaining count for test-seller-3's 3 items). Config reverted to 0 + verified.
- **Toast a11y announce:** the `announceForAccessibility` call is present and wired to the toast's `visible→true` transition (source-verified); the spoken utterance is not tool-observable (R38 scoping).

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision)

| Screen/transition | Elapsed | Flag |
|---|---|---|
| Checkout open (cart → checkout) | ~1-2s | — |
| Send Offer → Trade Initiated (2-item bundle) | ~2-4s | — |
| **Confirm All 2 tap → "Done!" modal** | **~8s** (spread between the 2 completions 0.91s) | ⚠️ ≥3s — but the DT-63 deliverable (sub-second spread) is met; total dominated by per-`completeTradeV2` RPC latency in the dev environment |
| Report Problem → IssueReportModal | ~1-2s | — |
| Discover heart → Favorites | ~1s | — |

## Cross-cutting UX findings (wording/structure)
1. **M10 raw error string — FIXED (follow-up):** the switch-with-full-saved-carts error originally showed "SAVED_CART_LIMIT_REACHED: user already has 3 saved carts" (developer-facing). Fixed at the DB RPC (friendly structured error) + client safety net; verified end-to-end. A playbook rule (§6.3) now mandates flagging such raw error-code leaks on every run.
2. **M05:** "Request to Buy" visible + reachable on own listings (server eventually blocks) — recommend gating the CTA for the owner.
3. **M20:** guide says "pink/red heart" but the header renders neutral-gray (consistent with the header icon system) — update guide copy.

## Cross-cutting design-system compliance
- No deviations found on the screens/modals reviewed (checkout, cart, TradeInitiated, TradeTimeline, IssueReportModal, Discover, Favorites). Confirm All / Done modal used the brand green `#5DBB8E`; toast uses primary green; IssueReportModal warning icon amber `#D97706`. Headers use the canonical back button where applicable.

## Follow-up (this session) — Cart "Make an offer" CTA overlap — FIXED ✅
**Reported:** on the Trade Basket screen the fixed "Make an offer" CTA visually overlapped the Subtotal/content and read as *not anchored* at the bottom.

**Root cause (measured on-device, iPhone 17 Pro Max, AX points):** `CartScreen`'s `bundleCtaBar` was `position:absolute; bottom:164`, floating the sheet top at **y≈706** — ~56pt above the floating pill nav (y≈848) — which landed the sheet's top edge **on top of the Subtotal row** (text ends y≈712; the card top + `shadow.level2` covered the row's bottom). Because it sat mid-content instead of hugging the bottom, it felt like an in-flow element that overlapped other info.

**Fix (applied to `p2p-kids-marketplace/src/screens/cart/CartScreen.tsx`):** `bundleCtaBar.bottom: 164 → 134`.
- Sheet top moves to **y≈736** → clears the Subtotal/Total content by ~24–130pt (no overlap at rest).
- Sheet bottom moves to **y≈822** → sits ~26pt above the pill top (y≈848), reading as a genuinely anchored bottom bar.
- `scrollContent.paddingBottom: 244` still clears the sheet at max scroll (needed = 134 + 85 card height ≈ 219 → ~25pt of air). Comment updated to the new geometry.

**Verified:** typecheck clean; on-device AX tree shows `bundle-cta-button` at y744 (was 714, overlapping Subtotal) with content ending at y≈604 in a 1-item cart and clear air to the pill; fresh screenshot `LAYOUT-02-basket-cta-fixed.png` confirms no overlap + bottom-anchored CTA. Test item added for verification was removed (basket back to empty; 0 `cart_items` in DB for test-buyer — zero residue).

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 9 — Dev Task 63 fix-verification (M13, Checkout Max SP, Confirm All perf, M10/N02/M12/M20 doc-drift, IssueReportModal AX) + carried-forward (M05, M16/M18) + UX confirmations (browse copy, toast a11y announce).

**Design-System Compliance:** PASS — no design-system deviations found across the screens/modals reviewed (cart, checkout, TradeInitiated, TradeTimeline, Done/Confirm All modal, IssueReportModal, Discover, Favorites).

**Perceived Load-Time Verdict:** FLAGGED — [TradeTimeline → Confirm All 2 → "Done!" modal]: ~8s total (see load-time table). Distinction: the DT-63 deliverable (sub-second completion spread, 0.91s vs ~7s) is fully met; the ~8s total is dominated by per-`completeTradeV2` RPC latency in the dev environment (parallel now, not serial), not a parallelism failure.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Cart screen: subscriber "Accepts Points · Up to N SP" badge, min-value banner copy ("Add $X.XX more… / Browse N More Items"), subtotal exclusion — all match design intent.
- CONFIRMED — Checkout: "Max: N SP" hint, order summary, fee/tax rows.
- CONFIRMED — TradeInitiated + "Done!" confirmation modal: clear, parent-friendly copy, brand-green CTAs.
- CONFIRMED — IssueReportModal: "Report an Issue / What went wrong with this trade?" + clear reason rows (parent-appropriate).
- CONFIRMED — Discover header: heart + "View Favorites" label.
- DEVIATION (minor) — M20 guide says "pink/red heart"; app renders neutral-gray heart (consistent with header icon system) — guide copy should be updated.

**Verdict Summary:** 9 PASS / 0 FAIL / 1 PARTIAL (IssueReportModal container AX) / 0 BLOCKED / 2 R38 accepted-class (M16/M18) — 0 SKIPPED this run.

**Critical Findings:**
1. **[MOD] IssueReportModal container AX gap (DT-63 item 5 partially met):** `testID="issue-report-modal"` + `accessibilityRole="alert"` do NOT surface in the iOS AX tree (sheet `<View>` lacks `accessible`/`accessibilityLabel` → flattened; same class as `cancel-reason-modal`). The modal's interactive children ARE fully AX-exposed; the alert announcement is not delivered. Recommend `accessible` + `accessibilityLabel` on the container.
2. **[MOD] N02 server-side validation gap:** `upsert_admin_config_setting` (and the `qa:admin-config-set` path) accepts a negative `cart_min_value_cents` — the "Minimum cart value cannot be negative" guard is admin-UI-only. Recommend a server-side guard (RPC check or CHECK constraint ≥ 0).
3. **[LOW] M12 fixture-state:** test-buyer's subscription `current_period_end` (2026-07-27) is stale (status still 'active', grace to Sep 12) → `is_active_subscriber()` returns false (checks `current_period_end`, not `grace_ends_at`). This hides subscriber-only features (e.g., the "Up to N SP" badge) for a documented-subscriber persona. Flagged; a durable subscription-state refresh (or `is_active_subscriber` grace-awareness) is recommended — the QA run applied a reversible fixture fix.
4. **[LOW] M05 UX:** "Request to Buy" CTA is not gated for listing owners (reaches a server-blocked `SELF_PURCHASE` flow). Recommend hiding/disabling the CTA for owners.
5. **[FIXED] M10 UX:** the switch-with-full-saved-carts error originally showed a raw "SAVED_CART_LIMIT_REACHED: …" string — fixed via migration `20260830190000_fix_cart_switch_saved_limit_copy` (RPC pre-check returns friendly structured error) + `CartScreen.confirmSwitchCart` client safety net; verified behaviorally (RPC now returns "You already have 3 saved carts. Delete one to save a new one."). A §6.3 playbook rule now mandates flagging raw error-code leaks every run.
6. **[INFO] Confirm All perf:** completion spread 0.91s (sub-second ✓); total tap→Done ~8s (per-call `completeTradeV2` latency, now parallel).

**App State Left Behind:** test-buyer wallet at baseline (4 SP available / 10 reserved / 0 pending / lifetime 58). Zero residue verified: 0 cart_items, 0 pending/in-progress offers (buyer + seller), `cart_min_value_cents=0`, subscription `current_period_end` restored to the original `2026-07-27 12:41:17+00` (is_active_subscriber back to false), all fixture items (Puzzle, QA Canned, Kids Bicycle) restored to `available`. Two COMPLETED trades + payouts from the Confirm All bundle remain as historical data (per the standing completed-trades-stay-historical rule); the disposable in-progress Bicycle trade was properly cancelled via the `cancel-trade` EF (`ece840f3`, refund issued, item restored). The `qa-task9-m13-server-total.mjs` temp script remains in `temp/` (consistent with repo temp-script practice). Simulator app left running (test-buyer session). Stale hung Maestro process (PID 93025, since Aug 27) noted for cleanup.

**Why It Matters:** This run closes QA Task 7's open items: the DT-63 fixes for M13 (client+server subtotal agreement), Checkout Max SP (4-SP buyer now sees "Max: 4 SP"), Confirm All parallelism (0.91s spread), and the M10/N02/M12/M20 doc-drifts are all confirmed live on-device with DB read-backs. Two genuine backend gaps surfaced that scripted suites cannot see: the IssueReportModal container alert-role exposure (DT-63 item 5 only partially delivered) and the RPC-layer acceptance of negative cart-min values.

**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task9-dt63-fix-verify-2026-08-30/screenshots/` (M12-*, M13-*, MaxSP-*, ConfirmAll-*, IssueModal-*, M20-*, M16-*, UX-01-*). Repro each: M13 — mark a cart item sold (SQL) and watch subtotal drop + `rpc_cart_validate_for_checkout` return the matching total; Confirm All — 2-item bundle → Confirm All → read `completed_at` spread; IssueReportModal — open Report Problem on an in-progress trade and inspect the AX tree for `issue-report-modal`; N02 — `npm run qa:admin-config-set -- set --key cart_min_value_cents --value -5` (observe acceptance) then revert to 0.

**Known Gaps / Not Tested:** The toast's VoiceOver utterance and 2.5s transient capture are not directly testable with the current toolset (R38 accepted class). The admin-portal UI leg of N02 was verified in QA Task 7 (admin-web is the Playwright path, out of scope here). No video-frame extraction (ffmpeg unavailable) — the toast recording was captured but not frame-analyzable.

**What Needs To Be Fixed Next:**
- ✅ DONE this session — Cart "Make an offer" CTA overlap: `bundleCtaBar.bottom` 164→134 in `CartScreen.tsx` (anchored above the pill, clears Subtotal/Total). See "Follow-up (this session)" section above.
- Fix: IssueReportModal container — add `accessible` + `accessibilityLabel="Report an Issue dialog"` (or otherwise make the alert-role element surface) so the alert announcement is delivered on-device (BP-53 container class).
- Fix: Add server-side validation (RPC guard or CHECK constraint) rejecting `cart_min_value_cents < 0` in `upsert_admin_config_setting` (and audit sibling numeric money config keys for the same gap).
- Fix (fixture/schema): make `is_active_subscriber` grace-aware (consider `grace_ends_at`) OR refresh test-buyer's stale subscription `current_period_end`; decide the intended semantics for 'active'+past-period+future-grace.
- Fix (UX): gate "Request to Buy" for listing owners (hide/disabled) — mirror the Add-to-Cart CART-014 gate.
- Fix (UX/copy): ~~map `SAVED_CART_LIMIT_REACHED` to friendly copy on the saved-cart switch error path~~ **DONE** — `rpc_cart_switch_to_saved` now returns the friendly structured error (migration `20260830190000_fix_cart_switch_saved_limit_copy`) + client safety net in `CartScreen.confirmSwitchCart`; verified.
- Fix (docs): update the M20 guide's "pink/red heart" to the actual neutral-gray heart (or decide to tint it).

**UX Enhancement Ideas (optional, not defects):**
- On the cart min-value banner, the "Browse N More Items" CTA currently goes to the seller page — consider also surfacing the count on the banner subtitle ("Browse more items from this seller…") consistently with the button's dynamic count (observed both elements carry the count; no friction, just a consistency opportunity).
- None other this run.

**Suggested Next Session:** Begin the next TRD coverage batch (e.g., the TRD-TC-N03/N04/N05 min-listing-price group, which are still "NEVER RUN" in the master tracker), now that QA Task 7's open items are closed.

**Suggested to Improve Agent Rules:** none — the R38 accepted class and the `qa:admin-config-set` path both worked as intended; the only recurring friction (2.5s toast capture) is already covered by the R38 class.
