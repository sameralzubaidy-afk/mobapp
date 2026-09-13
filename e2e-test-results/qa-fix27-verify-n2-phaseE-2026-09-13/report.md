# QA Task — FIX-Task-27 remainder verify → N2 mutation legs → Phase E sweep

**Run dir:** `e2e-test-results/qa-fix27-verify-n2-phaseE-2026-09-13/`
**Date:** 2026-09-13 · **HEAD:** `ea51dcb4` ("FIX-Task-27 — Login-As Retry + Item Detail Padding + Disclaimer-Stamp Check + Failure-Injection Toggles"), working tree clean
**Device:** Android emulator `Medium_Phone_API_36.1` (1080×2400, API 36.1) — driven
**iOS:** `iPhone 17 Pro Max` (3F3293A3) booted but **NOT driven** this round (R80 disclosure — no iOS verdict is claimed for anything below)
**Metro:** `:8081` + `:8082` up · **Admin portal:** `:3001` up (not exercised — no admin-scope case was reached before budget ran out; see Known Gaps)
**Evidence:** `screenshots/` (12 on-disk frames, all Phase-0 legs), this file, `ledger.md`

---

## 0 · Headline

| Phase | Scope | Delivered |
|---|---|---|
| **Phase 0** — FIX-Task-27's 6 owed legs | 6 legs | **6 / 6 ✅ PASS** |
| **Phase D** — N2 mutation-bearing legs | C01–C06, C09 (7 cases) | **5 ✅ PASS · 1 ⏸ BLOCKED · 1 ✅ PASS w/ DOC-DRIFT** (C01 cross-referenced) |
| **Phase E** — full remainder sweep | ~45 listed cases | **10 ✅ re-verified** (2 of them PARTIAL→PASS promotions) + 4 extra already-PASS rows re-verified · **35 not reached** (named in §5) |

**FIX-Task-27 is fully verified: all 6 owed device legs pass, including the item-3 sibling disclaimer stamp (3/3 siblings TRUE, vs. 1/3 on every pre-fix bundle).**

---

## 1 · Phase 0 — FIX-Task-27's 6 owed legs (all ✅ PASS)

### Leg 1 — `offer_load_stall` → Review Offer converts to a retry state at ~20 s ✅ PASS

- Armed via `p2pkidsmarketplace://qa-dev-toggle?key=offer_load_stall&value=stall`; arming proven by the `[QA] Toggle Applied` dialog (`offer_load_stall = stall (verified read-back: stall)`) **and** the JS log line `[ReviewOfferScreen] offer load simulated stall (qa_local_offer_load_stall)`.
- Navigated Trades → single-offer row → **Review Offer**. Screen showed spinner + **"Loading offer…"** (loading feedback present, §6.2 ✓).
- **At the ~20 s bound the screen converted to the retry state**: text **"We couldn't load this offer. Please try again."** + **`review-offer-retry-button`** ("Try again") + `review-offer-back-button` ("Back to Offers"). testIDs confirmed from the AX tree.
- **Retry leg:** disarmed (`offer_load_stall = none (verified read-back: none)`) → tapped **Try again** → offer loaded in place: countdown pill "46h 46m left", BUYER OFFERS $27.00 → $27.00, YOUR PAYOUT Cash $27.00 / Safety & Platform Fee −$5.40 / **Net Cash Payout $21.60**, Accept Trade + Decline. Disarm verified **by observable effect** (the reload was instant, no second 20 s stall) — R28.
- **Evidence:** `screenshots/P0-L1-01-review-offer-loading-stalled.png`, `P0-L1-02-review-offer-20s-timeout-retry-state.png`, `P0-L1-03-review-offer-loaded-after-retry.png`

### Leg 2 — `cart_remove_failure` → rollback + inline retry ✅ PASS

- Built a real 3-item same-seller cart through the UI (3 × Item Detail → **Add**; each add confirmed by the "Added to Trade Basket" toast and the Basket badge 1→2→3).
- Armed `cart_remove_failure=remove_failure` (dialog read-back confirmed) → Basket → row 1 remove → `GlobalAlertProvider` confirm **"Remove Item / Are you sure you want to remove this item from your cart?"** [Cancel] [Remove] → **Remove**.
- **Row rolled back to its original index + inline error card**: **"We couldn't remove "QA Bundle Fixture 2 of 3 (2026-09-13)" / It's still in your trade basket. Please try again."** + **`cart-remove-retry-button`**; error card `cart-remove-error-card` measured 954×276; badge stayed 3. App log: `[CartScreen] removeFromCart simulated failure (qa_local_cart_remove_failure)`.
- **Retry leg:** disarmed → tapped **Try again** → the item was genuinely removed (badge 3→2, card cleared, banner recalculated to "Make one offer for these 2 items", Total $42.00).
- **Evidence:** `P0-L2-01-basket-3-items-before-remove.png`, `P0-L2-02-remove-rollback-inline-error-retry.png`, `P0-L2-03-remove-retry-succeeded-badge-2.png`

### Leg 3 — `profile_read_failure` both modes ✅ PASS (once + persist)

**`once` (self-heal):** armed `once` → `qa-login-as?persona=test-seller` →
```
[auth] profile read attempt 1/3 failed: 'Simulated profile read failure (qa_local_profile_read_failure)'
(no 2/3 or 3/3 failure)
[QaLoginAsDeepLink] Logged in as test-seller …
[Analytics] view_recommendations {"user_id":"14be337c-aad6-403f-bab2-ba1a7d80b666"}
```
The persona switch **completed** on retry attempt 2 — no wedge, no "Loading trade…". Identity independently confirmed by `user_id` in the analytics event and the **TS** header avatar.

**`persist` (exhaust + recover):** armed `persist` → `qa-login-as?persona=test-buyer` →
```
login-as test-buyer attempt 1/3 failed: code=PROFILE_NOT_FOUND   (3 × profile-read retries)
login-as test-buyer attempt 2/3 failed: code=PROFILE_NOT_FOUND
login-as test-buyer attempt 3/3 failed: code=PROFILE_NOT_FOUND
[QaLoginAsDeepLink] Login-as test-buyer failed after 3 attempts
[QaLoginAsDeepLink] Cleared the half-switched session — re-fire the deep link to retry the switch
[NAV] route: 'Landing'
```
The **both-sided fallback worked exactly as designed** — session cleared and the app returned to Landing with **no** wedged spinner. Disarmed afterwards; a subsequent `qa-login-as test-buyer` succeeded normally (`Logged in as test-buyer; TOS accepted: true, Privacy accepted: true`).
- **Evidence:** `P0-L3-01-profile-read-failure-once-armed.png` + the log excerpts above (this leg is log-evidenced, not screenshot-evidenced — named here as a capture gap, §5.6).

### Leg 4 — F11 in-place retry recovery ✅ PASS

- Opened Item Detail with the healthy Seller Info card (**Test Seller · 4.5 ★★★★★ · 6 reviews · Contact Seller · View Profile**) — baseline frame captured.
- Armed `seller_read_failure=read_failure` → re-mounted Item Detail → error card rendered:
  **`seller-info-error-card` 996×235** ("We couldn't load this seller's details / Contact Seller and View Profile appear as soon as the seller's details load.") + **`seller-info-retry-button` 996×95** — both clear of the pinned CTA band (retry bottom 1925 < band top 1949). Measured dimensions match FIX-Task-27's own note.
- **Disarmed, then tapped "Try again" → the Seller Info card recovered IN PLACE** (Test Seller · 4.5 · 6 reviews · Contact Seller · View Profile) with **no navigation and no relaunch**; `seller-info-*` identifiers dropped to **0** in the tree and `contact-seller-button` reappeared at {207,1824,386,101}.
- **Evidence:** `P0-L4-01-…healthy-baseline.png`, `P0-L4-02-toggle-applied-alert.png`, `P0-L4-03-itemdetail-remounted-armed-top.png`, `P0-L4-04-seller-info-error-card-armed.png`, `P0-L4-05-seller-info-recovered-inplace-after-retry.png`

### Leg 5 — items 7/8 visual confirmation ✅ PASS

- **Item 7 (bundle card pending count):** `trade-bundle-55ede89f-38e7-4a90-a749-c5f5c5e545e5-pending-count` renders the real count **"All 2 awaiting your review"** (not a static label); the card also shows the 2 sibling rows with prices.
- **Item 8 (single-offer vs bundle button treatment):** the **single** offer row carries exactly **one full-width** primary CTA (`trade-offer-row-<id>-review`, 928×115 → "Review Offer"); the **bundle** card carries a **three-button** treatment — `-review-each` (outline), `-accept-all` (solid primary), `-decline-all` (red outline) — i.e. **one primary per card**, consistent with the design system's max-one-primary rule.
- **Evidence:** `P0-L5-01-tradelist-single-offer-vs-bundle-button-treatment.png`

### Leg 6 — item 3 SQL read-back: sibling disclaimer stamp ✅ PASS (the fix works)

**Pre-fix comparison (read-only, from bundles created before FIX-Task-27):**

| bundle | siblings | `disclaimer_acknowledged` |
|---|---|---|
| `55ede89f-38e7-4a90-a749-c5f5c5e545e5` (12:59 local) | 3 | **false / false / TRUE** → **1 of 3** |
| `15b77972-2c14-44ef-a917-1b062da533b9` (09:35 local) | 3 | false / **TRUE** / false → **1 of 3** |

That is exactly the previously-reported F4 defect state.

**Post-fix fresh 3-item bundle checkout (driven end-to-end in this round):**
1. Basket emptied (`Clear Trade Basket` → destructive-red confirm dialog) → `npm run qa:create-bundle-fixture -- --buyer test-buyer --seller test-seller --count 3` → 3 fresh items + preloaded cart (`bundle_id=4a0ebecf…`, cart `61259e4c…`).
2. Basket → **`bundle-cta-button`** ("Make one offer for these 3 items") → Checkout (**"Combined Offer"** banner, ITEMS (3), Points remaining 458).
3. Order Summary: Subtotal $84.00 · Safety & Platform Fee **$1.49 (one fee for the bundle)** · Sales Tax $3.92 · **Cash Total $89.41**.
4. **Send Offer** → **Liability Disclaimer** modal → checkbox → **Accept & Continue** → Processing → **"Trade Initiated!"**.

**Read-back (`SELECT id, listing_id, status, bundle_id, disclaimer_acknowledged FROM trades WHERE bundle_id='61259e4c-da53-49ce-830f-65786d6de1d4'`):**

| trade | sibling | status | `disclaimer_acknowledged` |
|---|---|---|---|
| `119ecf63-bd36-4125-bc9b-02069995369a` | 1 of 3 | pending | **TRUE** |
| `3a9c297f-be13-43af-8d9e-0cc0e9cef025` | 3 of 3 | pending | **TRUE** |
| `502bb9d9-ce56-47cf-9921-a985b1fa6e54` | 2 of 3 | pending | **TRUE** |

**→ 3 of 3 siblings stamped TRUE.** Expected result met exactly ("TRUE on all 3 siblings, not just one"). **FIX-Task-27 item 3 = VERIFIED FIXED.**
- **Evidence:** `P0-L6-01-disclaimer-modal-checkbox-unchecked.png`, `P0-L6-02-trade-initiated-bundle-289-41.png`

**All failure-injection toggles were disarmed and each disarm verified** (`seller_read_failure`, `cart_remove_failure`, `profile_read_failure`, `offer_load_stall` → all `none`).

---

## 2 · Phase D — N2 mutation-bearing legs

Method per N2-C01's proven pattern: drive the real path twice, then a **separate-statement** DB read-back (R24).

| Case | Verdict | Evidence |
|---|---|---|
| **N2-C01** retried offer submission | ✅ PASS — **cross-referenced** from `qa-fix26r2-verify-bundlechain-n2mut-2026-09-13` (HTTP 409 `DUPLICATE_OFFER`, 1 trade / 1 PI / 1 audit row). Verified unchanged: `git diff a6ce831a..ea51dcb4 -- supabase/functions/create-trade-offer` is **empty** (FIX-Task-27 touched only `src/` + docs). | — |
| **N2-C02** retried payout trigger | ✅ PASS (retried-trigger leg) | `initiate-payout` called **twice** on `080551cb…` (test-seller JWT, `qa:ef-repro`). Both calls HTTP 200 `{success:true, payout_status:"requires_action", requires_action:true}`. Read-back: `seller_payouts` rows for the trade = **1** (unchanged), `trades.payout_status` unchanged, `stripe_transfer_id` still NULL, **no new notifications** (all 4 notification rows pre-date the calls). |
| **N2-C03** retried refund / duplicate `charge.refunded` webhook | ⏸ **BLOCKED (harness)** | Re-delivering a `charge.refunded` event requires a **signed** Stripe webhook (Stripe CLI / secret) — not available to this agent, and forging the signature is out of scope. Data invariant observed read-only (see §4 F5). |
| **N2-C04** re-run `rpc_release_pending_sp` | ✅ PASS (idempotency) + 📄 DOC-DRIFT | Fast-clocked `080551cb`'s `pending_sp_release_at`; call 1 `{success:true, released_count:1}`, call 2 `{success:true, released_count:0}`. Read-back: seller `available_balance` 2256 → **2263** (+7 exactly once), `pending_balance` 498 → **491**, `sp_released_at` set once, **no duplicate ledger row**. Independently corroborated on-device: Home SP strip showed **2263 SP** after the release. See F2 for the audit-row sub-assertion. |
| **N2-C05** retried SP debit / credit | ✅ PASS (both legs) | **Refund:** `credit_sp_for_cancelled_trade` on the existing keyed fixture returned `{success:true, idempotent:true, ledger_entry_id:6593a2c0…}` **twice** (same entry id), 1 ledger row, balance unchanged. **Debit:** `debit_sp_for_trade(test-buyer, <synthetic trade uuid>, 1)` call 1 `{success:true, balance_after:458, ledger_entry_id:5946eed6…}`, call 2 `{success:true, idempotent:true, ledger_entry_id:5946eed6…}` — read-back `sp_ledger` rows for the key = **1**, balance 458 (debited exactly once). |
| **N2-C06** admin SP adjustment double-click | ✅ PASS | `admin_adjust_sp_wallet(..., p_idempotency_key='qa_n2c06_adj_20260913')` +1 called twice. Call 1 `{success:true,new_balance:1,ledger_entry_id:29f84548…}`; call 2 `{success:true,idempotent:true,note:"SP adjustment already applied (idempotent replay)",ledger_entry_id:29f84548…}`. Read-back: balance **1** (not 2), ledger rows for the key = **1** (`earn_admin_grant:1`), audit rows = **1**. |
| **N2-C09** duplicate idempotency key | ✅ PASS (DB-helper leg) + EF leg cross-ref | `fn_log_financial_audit(..., 'qa_n2c09_dupkey_20260913')` → first call **true**, second call **false**, `count(*)` for the key = **1** (no double-log, no partial write). The EF-replay half (`409 DUPLICATE_OFFER`) is the same assertion C01 verified live on this HEAD family, and the guide now documents the 409 (FIX-Task-27's doc fix) — re-read and confirmed consistent with the shipped EF. |

---

## 3 · Phase E — remainder sweep

**Framing (R78-2 / prior-round note):** the dispatched M/N/S/T/U/V/X/Y blocks contain **no `NEVER RUN` rows** — this block is **Android-coverage re-verification**, not first verdicts. Every case below already had an iOS/other verdict on record.

### 3a · Verified this round (10 from the dispatched list + 4 extra)

All were verified from frames captured **incidentally while driving Phase 0/D on the same build** (§5.33 repurpose-incidental-state / §5.27 simultaneous evidence). The method is stated explicitly so the reader can weight it.

| Case | Assertion | Verdict | Basis |
|---|---|---|---|
| **TRD-TC-S08** | Bundle CTA hidden with single item or empty cart | ✅ PASS (Android) | Empty basket rendered **no** bundle CTA — only "Your trade basket is empty" + `browse-items-button`; the 3-item basket **did** render it. |
| **TRD-TC-S09** | Bundle CTA navigates to checkout in bundle mode | ✅ PASS (Android) | `bundle-cta-button` → Checkout with the **"Combined Offer"** banner and IPTEM (3) list. |
| **TRD-TC-S11** | Regression: Discover/search grid unchanged (no badges) | 🟡 **PARTIAL → ✅ PASS** | Discover grid rendered normally (cards + price + "Accepts SP" chips, no badges). Prior verdict was source-only. |
| **TRD-TC-S22** | Regression: Seller Info card elements unchanged | 🟡 **PARTIAL → ✅ PASS** | Full card observed on-device: Test Seller · 4.5 ★★★★★ · 6 reviews · **Contact Seller** · **View Profile** (and its retryable error twin). Prior verdict was source-only. |
| **TRD-TC-S23** | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected | ✅ PASS (Android) | Basket rendered rows + bundle CTA + `cart-summary` Total $42.00 / $84.00 consistently. |
| **TRD-TC-V03** | Empty state shows "trade basket" in copy | ✅ PASS (Android) | "Your trade basket is empty / Start adding items you love to your trade basket". |
| **TRD-TC-V04** | "View Trade Basket" button on Item Detail | ✅ PASS (Android) | After Add, the Item Detail CTA flips to **"View Trade Basket"**. |
| **TRD-TC-V14** | Functional behaviour unchanged (adding items, submitting offers) | ✅ PASS (Android) | 3 UI adds + a real 3-item bundle offer submitted (3 pending trades created, Cash Total $89.41). |
| **TRD-TC-X01** | Bottom nav renders identically on Home | ✅ PASS (Android) | Tab bar + Sell FAB rendered on Home across multiple personas. |
| **TRD-TC-X02** | Bottom nav renders identically on Discover | ✅ PASS (Android) | Tab bar rendered on Discover, `tab-basket-badge` present when the cart was non-empty. |
| *TRD-TC-S07 (bonus)* | Bundle CTA appears with 2+ same-seller items | ✅ PASS re-verified | `bundle-cta-button` rendered for both the 2-item and 3-item same-seller baskets. |
| *TRD-TC-V10 (bonus)* | Bundle CTA says "Make one offer" (no "Bundle" visible) | ✅ PASS re-verified | Banner reads **"Make one offer for these 3 items"**. |
| *TRD-TC-V11 (bonus)* | "Combined Offer" banner on checkout (no "Bundle" visible) | ✅ PASS re-verified | Checkout banner reads **"Combined Offer / You're making a single offer for all 3 items from this seller."** |
| *TRD-TC-M16/M17 (bonus)* | Add-to-cart toast + badge sync | ✅ PASS re-verified | "Added to Trade Basket" toast + Basket badge 1→2→3 on each add. |

**Net tracker effect: 2 status flips (S11, S22: 🟡 PARTIAL → ✅ PASS) + Android evidence added to 12 already-PASS rows.**

### 3b · Not reached (35 cases) — named precisely with the reason

| Block | Cases not reached | Reason |
|---|---|---|
| **N remainder** | N05, N08, N11, N12, N13 | All require the admin `min_listing_price` precondition ($5) **and** the bulk-listing flow (photo upload → grouping → per-item pricing → review → submit). The threshold was set (verified) and then **reverted unused** when the remaining budget proved insufficient to drive a bulk session to completion. N08's **bundle leg is effectively covered** by this round's $84 bundle checkout (≥ threshold, no "Price Below Minimum" error); its **single-item purchase leg is owed**. |
| **T03 / T12–T14** | 4 | Require the **low-SP persona fixture** (test-buyer holds **458 SP** vs. per-item caps of 8–21). Building that fixture is a dev-team/seed task; the agent must not create accounts (registry §Provisioning). **Fixture-gated, not skipped for convenience.** |
| **S remainder** | S03, S06, S10, S12, S13, S15, S16, S18, S19, S24 | S03/S04-class cases need the shared `qa_reset_error_simulation` toggle (dev-armed per the registry). S10/S12/S13 need a **single-item** checkout (this round drove a bundle). S15–S19/S24 need the **More-from-seller filtered page** journey. |
| **M remainder** | M05, M06, M14, M15, M19, M20 | Need a dedicated cart/favourites pass (own-listing add rejection, unavailable-item add, favourites add/remove + Favorites screen, and the Favorites entry points). The Favorites tile/icon were **observed** on Home/Discover but not tapped. |
| **V/X/Y remainder** | V08, V12, V13, X08, Y02, Y03, Y05–Y08 | V08/V12/V13 need the filtered-seller page and the Bundle Builder screen. X08 needs the Profile/Settings/Wallet/Subscriptions sweep. Y02/Y03 need **trade-history pagination and the row Message button**; Y05–Y08 are the **R15 Request-More-Time** four-party legs (requester + counterparty accept/decline/granted) — a dedicated multi-step trade-timing session. |
| **N2 (not dispatched)** | C07, C08, C10 | Not in this round's dispatch (audit completeness / RLS insert-only / reconciliation). Note **C07 is directly implicated by finding F2** below. |

---

## 4 · Findings

**F1 — MED (UX/correctness) — a transient `get_subscription_status` failure silently downgrades an ACTIVE subscriber's Home SP strip to the free-tier upsell.**
Observed live: Home first rendered the correct green **"2263 SP / Earn More →"** strip, then flipped to the grey **"Unlock Swap Points / Upgrade →"** upsell for **test-seller (Kids Club+ Active, 2263 SP)**. The app's own log names the cause: `[subscription] get_subscription_status skipped due transient network issue`. Root cause read from source: `src/services/subscription.ts:149` — on `isTransientNetworkError(error)` the function **returns `createFreeTierSummary()`**, i.e. it fabricates a free-tier summary. Downstream, Home renders the free-tier upsell branch. There is **no retry and no error state**, and the wrong strip persisted across two screenshots.
*Why it matters:* the user is shown an "Upgrade" CTA implying they lack a membership they are paying for, and the SP balance (the app's core currency) disappears.
*Recommended fix:* do not fail-soft to the **free** branch on a transient error — keep the last-known summary, or return a distinguishable `unknown` state so Home renders a neutral/loading strip (and retry once), reserving the upsell branch for a genuinely-confirmed free user.

**F2 — MED (audit completeness, SR-N2-001) — the SP earn/release transition is ledger-logged but NOT audit-journal-logged on every path except `complete-trade`.**
`financial_audit_log` shows **no** `sp_*` row for any of the four sampled completed trades, including `472ef43a` with `sp_amount=15` (>0). Writer introspection (R100): the `sp_released` audit row is written **only** by `supabase/functions/complete-trade/index.ts:321-327`, and only when `trade.sp_amount > 0`; the key is `sp_release_<tradeId>`. Neither `rpc_release_pending_sp` (verified by `pg_get_functiondef` on staging + the repo migration `20260528000005_auto_complete_cron.sql`) nor `process-auto-complete` writes any audit row. Consequence: **N2-C04's documented sub-assertion ("Exactly 1 `sp_released` audit row") is not satisfiable by following the guide's own steps** — the guide drives the bare RPC, which has never written that row. The durable idempotency requirement (no double-credit) **passes decisively** (see Phase D). This also directly bears on **N2-C07 (audit completeness)**.
*Recommended fix:* write a `sp_released`/`sp_earned` audit row from the release RPC and from the auto-complete path (keyed `sp_release_<tradeId>`), so every SP transition is journaled regardless of which path drove it; and correct the N2-C04 expected result to name the writer.

**F3 — MED (tap target) — the liability-disclaimer checkbox only responds to a tap on the 63 px square; tapping the full-width row/label does nothing.**
`disclaimer-modal-checkbox` is reported by the AX tree as a full-width row `{42,2107,996,63}`, so the natural tap is the row centre. **Two taps at the row centre (540, 2138) left the box unchecked**; tapping the square itself **(73, 2138) ticked it immediately**, enabling `Accept & Continue`. For a disclaimer that legally gates checkout, an inert label row is both a UX barrier (users tap the text and nothing happens) and a QA-driver trap.
*Recommended fix:* make the whole row the pressable (the label and square should share one `onPress`), matching the ≥44×44 / full-row-toggle convention.

**F4 — LOW–MED (loading feedback / R59) — the Trade List stat tiles render `0 / 0 / 0 / 0` before resolving, with no skeleton.**
Immediately after opening Trades as test-seller (who had 3 offers awaiting review), the tiles displayed **"Your Offers 0 · In Progress 0 · Needs Action 0 · Completed 0"** and an empty list; a second read showed the true **0 / 1 / 3 / 38** and the offer cards. A user with real pending work briefly sees a "nothing to do" state.
*Recommended fix:* render the tiles with a skeleton/placeholder until both counts resolve (the previous round saw the same class on this screen).

**F5 — observation (needs writer attribution, NOT filed as a defect) — three trades carry TWO distinct successful refunds each.**
`trade_refunds` holds 9 rows, all `succeeded`, each with a **unique** `stripe_refund_id` (the guide's unique-index invariant holds). But `f9d53797`, `e54f608a` and `f2899f12` each have **two refund rows whose Stripe refund ids share the same PaymentIntent prefix** (`re_3Tzdbz4I6kCJlvXo1…`, `re_3U9n6L4I6kCJlvXo0…`, `re_3UEdW24I6kCJlvXo1…`). Per **R100** I am naming the shape, not the verdict: I did not read the writer for these rows, and dev/QA fixtures from earlier rounds plausibly created deliberate multiple/partial refunds. **Flag for the dev/QA side to attribute** before any "double refund" conclusion — do **not** read this as a confirmed C03 failure.

**F6 — LOW (dev-build hygiene) — a repeating `source.uri should not be an empty string` warning (LogBox) on list screens with image-less rows.**
Emitted ~8–20× per render on Trade Basket / Discover while items have no photo. On a dev build these accumulate into the LogBox scrim that the playbook documents as tap-blocking (§5.19 Phase-13.42). Test data here has "No Image" rows, so blast radius is limited, but the warning is noise that can mask real errors.
*Recommended fix:* guard the `Image source={{uri}}` for empty/absent urls (render the placeholder directly).

**F7 — MED (tooling, extends R87/R102) — an AX-tree dump can CRASH the app via the mobile-mcp JVMTI agent attach.**
While Review Offer's deliberately-stalled load was pending, `mobile_list_elements_on_screen` returned a status-bar-only tree and the process died. The tombstones are unambiguous: `signal 11 (SIGSEGV)` with the backtrace `mobilecli.so → art::ti::AgentSpec::DoLoadHelper → AgentSpec::Attach → Runtime::AttachAgent → VMDebug.attachAgent → ActivityThread.attemptAttachAgent`. **This is the mobile-mcp JVMTI agent attach (`mobilecli.so`), not app code.** Cost: one cold-start cycle and the round's Leg-1 evidence. Root-caused per R87 (a dev-tooling crash, not an app defect) — the recovered re-drive passed cleanly.
*Rule that worked:* during a deliberately-stalled screen, poll with **screenshots only**; do not issue an AX dump inside the stall window.

**F8 — LOW (agent-process, from this round) — a modal-opening tap batched with modal-target taps silently mis-fires onto a DIFFERENT control.**
`[send-offer-button (540,1848)] → [disclaimer checkbox (540,2138)] → [accept (798,2285)]` in one `mobile_batch_commands` call did **not** submit an offer: the modal had not rendered when taps 2–3 fired, and tap 3's coordinate `(798,2285)` lies **inside the `tab-trades` band**, so it navigated to My Trades. Confirmed by the JS log (no `send_offer`/`checkout_started` event; `tab_trades_tapped` → `[NAV] route: 'TradeList'`) and by the DB (zero new trades). Re-driven sequentially it worked first try.
*Rule:* a batch may chain taps only across **already-rendered** targets. Any modal-opening tap must be its own step (then verify), and modal controls whose coordinates overlap a persistent tab bar are especially unsafe to batch.

---

## 5 · Perceived load times (§5.7 — simulator, wall-clock, ±polling-interval precision; NOT a formal performance profile)

| Screen → transition | Elapsed | Flagged ≥3 s? |
|---|---|---|
| Item Detail (deep link) → "Loading item…" → content | **7–14 s** | ⚠️ **FLAGGED** — coincides with the same transient-staging degradation that produced F1 (`get_subscription_status` skipped). Dev-build + degraded-network artifact; **not** established as an app regression. |
| Trades tab → stat tiles resolve | ~2–3 s | ⚠️ marginal — F4 |
| Review Offer → 20 s timeout → retry state | ~20 s (by design) | Expected (the case's own assertion) |
| Review Offer retry → offer rendered | <1 s | no |
| Cart remove → rollback + error card | <1 s | no |
| `qa-login-as` (once-mode, incl. 1 failed read + retry) | ~6 s | ⚠️ marginal — includes the deliberate fault injection |
| Bundle CTA → Checkout rendered | ~2 s | no (skeleton shown) |
| Send Offer → Disclaimer → Accept → **processing** → success | ~60 s+ (Stripe hold + 3 trades) | ⚠️ FLAGGED — dev-build + staging; a spinner/"Processing…" state **was** shown throughout ✓ |
| Seller Info retry → recovered in place | <1 s | no |

---

## 6 · UX review (three layers, §6.2/§6.3/§6.4)

**Structural / affordance**
- ✅ Loading feedback is present on every async screen examined (spinner + "Loading offer…" / "Loading item…" / skeletons on Basket; "Processing…" on checkout).
- ⚠️ Trade List stat tiles show false zeros before resolving (F4).
- ✅ Retry affordances are consistent and in place: `seller-info-retry-button`, `review-offer-retry-button`, `cart-remove-retry-button` — all recover **in place**, all labelled "Try again".
- ⚠️ The disclaimer checkbox label row is inert (F3).
- ✅ Destructive actions are visually distinct (Clear Basket confirm renders red).
- ✅ Empty states are clear and actionable ("Your trade basket is empty" + Browse Items).

**Wording / copy clarity**
- ✅ Retry copy is plain and non-technical ("We couldn't load this offer. Please try again." / "It's still in your trade basket. Please try again.").
- ✅ Bundle copy is parent-friendly and jargon-free ("Make one offer for these 3 items", "Combined Offer", "You're making a single offer for all 3 items from this seller.").
- ✅ No raw error codes, `SCREAMING_SNAKE` strings, or stack traces appeared on any user-facing surface in this run (R58 check) — backend codes (`DUPLICATE_OFFER`, `PROFILE_NOT_FOUND`) stayed in logs only.
- ⚠️ **The liability disclaimer's body copy is verbatim Amazon Seller-Central text** ("section 9 of the Amazon Services Business Solutions Agreement", "USD 10,000 in gross proceeds in sales in one month on Amazon.com", "the Amazon.com store"). Per the dispatch this is an **excluded, already-tracked standalone CRITICAL** — recorded here only as re-confirmation, not re-litigated.

**Design-system compliance (`docx/design-system-passitup.md`)**
- ✅ Primary CTAs are the filled `#5DBB8E` pill with white bold text (Send Offer, Try again, Accept & Continue, Request to Buy, Review Offer, Accept Trade).
- ✅ Secondary/outline variants are green-outline (`Back to Offers`, `Go Back`, `Cancel`, `View Profile`, `Review Each`).
- ✅ Destructive actions render red (`Decline`, `Clear Basket` confirm).
- ✅ In-app dialogs (`GlobalAlertProvider`) use the white modal surface + green pill and are **fully AX-instrumentable** (`global-alert-button-0/1`) — no native-modal pixel-scan was needed anywhere this round.
- ✅ Max-one-primary-per-card held on the Trade List (single offer = 1 CTA; bundle = 1 solid + 2 outline).
- ✅ Error cards use the semantic error palette with a tinted surface and a clear action.
- ⚠️ Off-brand-hex grep (R62b) was **not** re-run this round (budget) — previous rounds' results stand.

---

## 7 · Friction vs. the operating rules

1. **AX dump inside a stall window crashed the app** (F7) — cost one cold-start + Leg-1's first evidence set.
2. **Batched modal taps mis-fired onto the tab bar** (F8) — cost one full checkout drive (~12 calls).
3. **The dev-client wedge reproduced on a warm persona switch** (`[trade] Error counting active trades` LogBox + perpetual spinner) → force-stop + cold relaunch + re-pick Metro row. Confirms the prior round's F4/R101 and the dispatch's own workaround note.
4. **Metro `--clear` cold start** — the first launch after the crash sat on "Connecting to the development server…" for >1 min; picking `:8081` (the other row) loaded successfully, as the dispatch predicted.
5. **`qa:ocr` prints no coordinates** — neither `--json` nor `--region` yielded bounding boxes, so it could not resolve the checkbox-position ambiguity; a coordinate-emitting mode (or `--coords`) would have saved ~4 calls.
6. **Checkout blocked by stale offers** — the fresh-checkout leg first failed with `DUPLICATE_OFFER` on all 3 items because earlier rounds' pending/in-progress offers still held those listings. Resolved by clearing the basket + regenerating a fixture bundle (R16-1 in spirit: run `qa:reset-offer-fixtures` at session start, but note the dispatch's rule against doing that *once a bundle/cart is built*).
7. **`items.price_cents` does not exist** (it is `items.price`) — one schema surprise, corrected on the first retry per R7.

---

## 8 · App state left behind

- **Personas:** last logged-in = **test-seller** (`14be337c…`). No persona was created or deleted.
- **test-buyer** (`49243010…`): SP wallet debited **−1 SP** (459 → **458**) by the bounded N2-C05 debit probe (`sp_debit_00000000-0000-0000-0000-00000000c05d`, a **synthetic** trade id). Cash state otherwise untouched.
- **test-buyer-3** (`a1234567-…0004`): SP wallet credited **+1 SP** (0 → **1**) by the bounded N2-C06 double-click probe (key `qa_n2c06_adj_20260913`).
- **test-seller** (`14be337c…`): `available_balance` 2256 → **2263**, `pending_balance` 498 → **491** — the legitimate N2-C04 SP-release of trade `080551cb` (+7 once). Also gained a **new 3-item pending bundle** `61259e4c-da53-49ce-830f-65786d6de1d4` (3 × $28 QA Bundle Fixture items) from the Leg-6 checkout, plus 3 new fixture listings.
- **New fixture rows created this round:** 3 items + 3 trades + 1 cart (from `qa:create-bundle-fixture`) and their PaymentIntent holds.
- **Config:** `min_listing_price` was set to `5` and **reverted to `0`** with a verified read-back. **No config is left changed.** All 4 QA failure-injection toggles are disarmed (`none`).
- **Cart:** empty (cleared during the bundle checkout).
- **App process:** running, cold-launched from Metro `:8081`.
- **Cleanup candidates for the dev team:** the 3 new fixture items/listings and the pending bundle above; the older "QA Bundle Fixture" listings accumulated across rounds; 3 trades carrying 2 refund rows each (F5).

---

## 9 · Known gaps / not tested

- **iOS: nothing was driven** (R80 disclosure). Every verdict in this report is Android-only; the iOS simulator was booted but untouched. **No row in this report may be read as an iOS re-verification.**
- 35 dispatched Phase-E cases not reached (§3b), each with its reason.
- **N2-C03's webhook re-delivery leg** BLOCKED (no signed-webhook harness).
- **N2-C02's transfer-count leg** could not be produced: every completed trade's payout is `requires_action`, so the EF never reaches the transfer branch. The **retried-trigger** assertion (no second `seller_payouts` row / no duplicate side-effects) **was** verified.
- **N2-C06's step-2** (keyless double-click within the same minute, testing the derived per-minute fallback key) was **not** driven — only the explicit-key leg.
- **Leg 3 (`profile_read_failure`)** is **log-evidenced, not screenshot-evidenced** — named as an unmet capture obligation per §5.6 rather than silently traded.
- The **admin portal was up but no admin-scope case was reached** before the remaining budget was spent; this is a reach gap, **not** an "admin-scope" exclusion (the standing rule treats a case needing the portal as the instruction to use it).
- R62b/R62c off-brand-hex scan and `view_image` full-resolution branch reviews were not re-run this round.

---

## 10 · What needs to be fixed next (dev-side, ranked)

1. **F1** — stop failing soft to the **free-tier** summary on a transient `get_subscription_status` error (`src/services/subscription.ts:149`); keep last-known or return an `unknown` state + retry. *(User-visible billing-status lie.)*
2. **F2** — write the `sp_released` audit row from `rpc_release_pending_sp` and `process-auto-complete` (not only `complete-trade`), and fix N2-C04's expected result to name the writer. *(Audit completeness, SR-N2-001; also C07's subject.)*
3. **F3** — make the disclaimer checkbox's whole row pressable (`disclaimer-modal-checkbox`). *(Legal gate with an inert label.)*
4. **F8 (agent-process)** — treat modal-opening taps as un-batchable; add a playbook rule + avoid modal controls whose coordinates overlap the persistent tab bar.
5. **F4** — skeleton/placeholder the Trade List stat tiles until the counts resolve.
6. **F6** — guard `<Image source={{uri}}>` for empty urls (removes the LogBox noise class).
7. **F5 (needs attribution first)** — have the dev/QA side identify the writer of the 3 double-refund trade pairs before any fix.
8. **Tooling asks:** `qa:ocr --coords` (or `--json` with boxes); and an AX-dump guard so a dump can never be the thing that kills a stalled dev-client (F7).

---

## 11 · Suggested next session

One focused session that (a) builds the **low-SP persona fixture** (unblocks T03 + T12–T14, 4 cases), (b) drives the **Group N bulk-listing flow end-to-end** with `min_listing_price=5` set and reverted (N05, N11, N12, N13, N14), and (c) runs the **More-from-seller + Favourites** journeys (S15–S19, S24, M14/M15/M19/M20, V08/V12/V13) — then a **Y-group R15 trade-timing** session for Y05–Y08. Also owed: the N2-C03 signed-webhook harness decision and the remaining N2 cases (C07/C08/C10).

---

## 📋 QA Session Handoff

**Test Scope:** FIX-Task-27's 6 owed device legs (Phase 0) · N2 idempotency/audit mutation legs C01–C06 + C09 (Phase D) · Phase E remainder sweep (10 of ~45 dispatched cases re-verified + 4 bonus rows). Guide: `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`. Device: Android `Medium_Phone_API_36.1`, HEAD `ea51dcb4`.

**Design-System Compliance:** PASS with qualifications — primary CTAs `#5DBB8E` filled pill with white bold text; secondary green-outline; destructive red; white modal surfaces; in-app dialogs fully AX-instrumentable; one primary per card. Deviations: (a) disclaimer checkbox label row inert (F3, tap-target); (b) Trade List tiles render false zeros with no skeleton (F4, loading affordance); (c) disclaimer body copy is verbatim Amazon Seller-Central text (excluded/previously-tracked standalone CRITICAL — re-confirmed, not re-litigated). The R62b off-brand-hex scan was not re-run this round (budget).

**Perceived Load-Time Verdict:** FLAGGED — Item Detail (deep link) → content: **7–14 s**; Test-buyer bundle checkout Send Offer → success: **~60 s+**; Trades tab → stat tiles: ~2–3 s; Review Offer → 20 s timeout: ~20 s (by design). The two largest are **environment artifacts** of the same transient staging degradation that caused F1 (`get_subscription_status skipped due transient network issue`) on a `--clear` dev build — **not** established as app-behavior regressions; loading feedback (spinner / "Processing…") was shown throughout.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Home (Dashboard): layout, SP strip, quick-action tiles, tab bar match the design system (aside from the F1 free/upsell branch flip).
- CONFIRMED — Discover grid: search bar, sort/SP chips, category row, card treatment.
- CONFIRMED — Item Detail: Item specifics, Description, Swap Points Eligible, Price Breakdown, Seller Info card, CTA band.
- CONFIRMED — "We couldn't load this seller's details" error card + Try again (semantic error palette, action present).
- CONFIRMED — Trade Basket (empty state, 2-item, 3-item), bundle CTA banner, Clear-Basket destructive confirm.
- CONFIRMED — My Trades: stat tiles, Active/History tabs, single-offer card, Bundle Offer card with the 3-button treatment.
- CONFIRMED — Review Offer: loading, 20 s timeout/retry state, and loaded offer (countdown pill, payout breakdown, Accept/Decline).
- CONFIRMED — Checkout: Combined Offer banner, per-item SP inputs with caps, Order Summary, Payment Method, Send Offer.
- CONFIRMED — Trade Initiated success screen.
- CONFIRMED — `[QA] Toggle Applied` and "Remove Item" / "Clear Trade Basket" / "Checkout Failed" dialogs (white surface, green primary, red destructive).
- DEVIATION — Liability Disclaimer modal: the checkbox **label row does not toggle** the checkbox (only the 63 px square does) — F3.
- DEVIATION — Trade List stat tiles: no loading skeleton; render `0/0/0/0` before resolving — F4.
- DEVIATION — (pre-existing, excluded scope) Liability Disclaimer body copy is Amazon Seller-Central text.

**Verdict Summary:** 21 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED (Phase 0 6/6 PASS · Phase D 5 PASS + 1 BLOCKED + 1 cross-ref PASS with a DOC-DRIFT note · Phase E 10 PASS incl. 2 PARTIAL→PASS promotions + 4 bonus re-verifications). 35 dispatched Phase-E cases not reached (named in §3b).

**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — **2 status flips, both improvements:** `TRD-TC-S11` 🟡 PARTIAL → ✅ PASS and `TRD-TC-S22` 🟡 PARTIAL → ✅ PASS (both were source-only PARTIALs, now Android on-device verified). Android re-verification evidence added (no status change) to `TRD-TC-S07, S08, S09, S23, V03, V04, V10, V11, V14, X01, X02` and `M16/M17`. New TRD totals: **274 ✅ PASS / 33 🟡 PARTIAL / 0 🔴 OPEN / 7 📄 DOC-DRIFT / 3 ⏭️ SKIPPED / 16 Remaining = 333 ✓** (roll-up ⇄ section header ⇄ rows reconciled in this pass, R56/R59). No rows regressed.

**Critical Findings:**
1. **F1 MED** — an active subscriber's Home SP strip silently downgrades to the free-tier "Unlock Swap Points / Upgrade" upsell on a transient `get_subscription_status` failure (`subscription.ts:149` returns `createFreeTierSummary()`); no retry, no error state.
2. **F2 MED (audit completeness, SR-N2-001)** — the SP earn/release transition is journaled in `sp_ledger` but **not** in `financial_audit_log` unless the trade completed through `complete-trade` **and** `sp_amount > 0`; N2-C04's documented audit sub-assertion is unsatisfiable via the guide's own steps (writer = `complete-trade/index.ts:321`).
3. **F7 MED (tooling)** — an AX-tree dump can **crash** the dev client via the mobile-mcp JVMTI agent attach (`SIGSEGV` in `mobilecli.so → AgentSpec::Attach → VMDebug.attachAgent`) — R87 class, **not** an app defect; crashed once during the stalled Review Offer.
4. **F3 MED** — the liability-disclaimer checkbox only responds to its 63 px square; the full-width label row is inert (legal gate).
5. **F4 LOW–MED** — Trade List stat tiles show false zeros before resolving (no skeleton).
6. **F8 LOW (process)** — a modal-opening tap batched with modal-target taps mis-fired onto the **tab bar**, silently navigating away and abandoning the checkout.
7. **F6 LOW** — repeating `source.uri should not be an empty string` LogBox warning on image-less list rows.
8. **F5 observation** — 3 trades carry two successful refunds each on the same PaymentIntent; **needs writer attribution before any defect claim**.

**App State Left Behind:** logged in as **test-seller** (14be337c…). test-buyer SP 459 → **458** (−1, bounded C05 probe on a synthetic trade id). test-buyer-3 SP 0 → **1** (+1, bounded C06 probe). test-seller `available_balance` 2256 → 2263 / `pending_balance` 498 → 491 (legitimate C04 release of `080551cb`). New pending 3-item bundle `61259e4c-da53-49ce-830f-65786d6de1d4` + 3 new fixture listings. `min_listing_price` set to 5 then **reverted to 0 (read-back verified)** — no config left changed. All 4 QA toggles disarmed. Cart empty. Cleanup candidates: the new fixture items/bundle, the accumulated "QA Bundle Fixture" listings, and the F5 double-refund rows.

**Why It Matters:** This round closes **FIX-Task-27 completely** — the four failure-injection toggles behave exactly as specified (stall→20 s retry, cart rollback→inline retry, profile-read once/persist, seller-read in-place retry) and the sibling-disclaimer stamp now writes **3 of 3** siblings instead of 1 of 3, on a live end-to-end bundle checkout. It also proves **N2's core promise on this HEAD** (a retried offer/payout/SP-release/SP-debit/SP-adjust/dedup-key can never double-mutate — six independent live drives) while surfacing that the **audit journal** half of N2 is only as complete as the `complete-trade` path. And it surfaces a user-visible billing-status regression (F1) that a UI-only test would never catch, because the UI looks perfectly fine — it is simply lying about the user's membership.

**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/qa-fix27-verify-n2-phaseE-2026-09-13/screenshots/` (12 frames, named `P0-L<leg>-<n>-…`).
- Leg 1: arm `qa-dev-toggle?key=offer_load_stall&value=stall` → Trades → Review Offer → wait ~20 s → assert `review-offer-load-error` + `review-offer-retry-button`; disarm → Try again → offer renders.
- Leg 6: `SELECT id, listing_id, status, disclaimer_acknowledged FROM trades WHERE bundle_id='61259e4c-da53-49ce-830f-65786d6de1d4'` → three rows, all `true`; contrast with `bundle_id='55ede89f-38e7-4a90-a749-c5f5c5e545e5'` (1 of 3).
- F1: `adb logcat -s ReactNativeJS` for `[subscription] get_subscription_status skipped due transient network issue` while observing the Home SP strip.
- F2: `SELECT pg_get_functiondef('public.rpc_release_pending_sp'::regproc)` → no `fn_log_financial_audit` call; `complete-trade/index.ts:321` → the only `sp_released` writer.
- F7: the tombstone is at `mobile_list_crashes` id `2026-09-13_14:12:49.903_24214`.

**Known Gaps / Not Tested:** iOS entirely (nothing driven — R80); 35 dispatched Phase-E cases (§3b) — N05/N08(single-item leg)/N11/N12/N13, T03/T12–T14 (low-SP fixture), S03/S06/S10/S12/S13/S15/S16/S18/S19/S24, M05/M06/M14/M15/M19/M20, V08/V12/V13, X08, Y02/Y03/Y05–Y08; N2-C03's signed-webhook leg; N2-C02's transfer-count leg (all payouts are `requires_action`); N2-C06's keyless same-minute leg; N2-C07/C08/C10 (not dispatched); Leg 3 is log-evidenced only (no screenshot); admin portal not exercised; R62b off-brand-hex scan not re-run.

**What Needs To Be Fixed Next:**
1. **F1** — `src/services/subscription.ts:149`: do not return `createFreeTierSummary()` for a transient error; preserve last-known status or return an `unknown` state + one retry so Home never shows the free-tier upsell to a paying subscriber.
2. **F2** — add the `sp_released` / SP-earn audit write to `rpc_release_pending_sp` and the auto-complete path (keyed `sp_release_<tradeId>`), and correct N2-C04's expected result to name the writer.
3. **F3** — make `disclaimer-modal-checkbox`'s whole row pressable so the label toggles the box.
4. **F8** — playbook-level: never batch a modal-opening tap with modal-target taps; specifically avoid modal controls whose coordinates overlap `tab-trades` / the persistent tab bar.
5. **F4** — render `trade-summary-*` tiles with a loading placeholder until both counts resolve.
6. **F6** — guard empty-uri `<Image>` renders on cart/discover rows.
7. **F5** — attribute the 3 double-refund trade pairs before any fix is scoped.
8. **Tooling** — add `--coords`/bounding boxes to `qa:ocr`; add a guard so an AX dump cannot crash a stalled dev client (F7).

**UX Enhancement Ideas (optional, not defects):**
- On **Review Offer**, the 20 s stall shows only a spinner + "Loading offer…" — consider a secondary affordance ("Taking longer than usual?") at ~8–10 s so a stuck user has an action before the hard timeout lands.
- On **Trade Basket**, the "This seller has 38 more items / View" banner and the "Make one offer for these N items" CTA sit adjacent and both read as navigation — consider differentiating them visually (the CTA is the primary action) to reduce mis-taps.
- On **Home**, the SP strip is the only place the balance appears with no tap target — consider making it open SP Wallet so the value is actionable.
- On **Checkout**, "Points remaining 458" is repeated under each of the 3 items — consider showing it once in the header and keeping only the per-item cap inline, to reduce repeated scanning.

**Suggested Next Session:** Build the low-SP persona fixture, then run the Group N bulk-listing block (with `min_listing_price=5` set and reverted) + the More-from-seller/Favourites journey block — together they clear the largest remaining clusters (N05/N08/N11–N14, S15–S19/S24, M14/M15/M19/M20, V08/V12/V13).

**Suggested to Improve Agent Rules:** Extend R95 (§5.77 batch-read timing) into a **batch-WRITE rule**: *a `mobile_batch_commands` chain may only contain taps whose targets are already rendered at batch start — any tap that OPENS a modal must be its own step, because the following taps fire before the modal exists and land on whatever occupies those coordinates (this round: the persistent tab bar), silently navigating away.* Pair it with the guard that modal-target coordinates overlapping a pinned tab bar must never be batched.
