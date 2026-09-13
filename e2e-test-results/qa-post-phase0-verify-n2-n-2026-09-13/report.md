# QA Task — Verify Post-Phase-0 Fixes, Finish Blocked Legs, Resume N2 → N → Remainder

**Date:** 2026-09-13
**Device:** Android `Medium_Phone_API_36.1` (emulator, API 36.1) — iOS `iPhone 17 Pro Max` booted but NOT driven (R80 platform disclosure)
**Backend:** staging Supabase `drntwgporzabmxdqykrp` (read-only SQL via MCP) + admin portal `:3001`
**HEAD:** `e94b8ab4` — "# Fix + UX Enhancement Prompt — Post Phase 0 (2026-09-13)"; working tree **clean**, `origin/main` matches.
**Code state correction (R78-2 / stale-note sweep):** the carry-forward note that FIX-Task-26 was "NOT committed, NOT pushed" is **stale** — the commit exists at HEAD and is pushed. A cold dev-client reload was still performed (R79-1) and the fresh bundle confirmed behaviourally via the F1 drive.

---

## Phase 0.5 — Backend health check (run FIRST, per brief)

| Leg | Probe | Result | Verdict |
|---|---|---|---|
| DB / Postgres | `select now()` via MCP read-only SQL | `2026-09-13 15:42:37.779064+00` returned in well under 1 s | ✅ HEALTHY |
| Project status | `list_projects` | `ACTIVE_HEALTHY`, Postgres 17.6.1 | ✅ HEALTHY |
| Edge | unauthenticated `POST /auth/v1/token` from the admin-page origin | structured **401** in **213 ms** (`Invalid API key` — expected, probe used a non-key) | ✅ HEALTHY (edge responsive; a 504/timeout is the outage signature and did NOT occur) |
| Auth/token handler leg | real login attempt | proven by the Phase A **F1** drive (a real `/auth/v1/token` failure path) — see Phase A | see Phase A |

**No outage signature present at session start.** Specifically absent: 504 on `/auth/v1/token`, Postgres `57014` statement timeout, `Connection terminated due to connection timeout`, `Gateway Timeout` from fixtures.

**Bonus de-risk:** read-only SQL via `mcp_supabase_execute_sql` **works this session** (first attempt used a wrong project ref and returned a permissions error — retry with the correct ref `drntwgkxkznwqopdgndzot`→`drntwgporzabmxdqykrp` succeeded). This means **Group N2's SQL-drivable route is available** if the app/UI leg degrades later.

---

---

# ⚠️ READ FIRST — Phase A / F1 (the security fix)

## F1 — auth error leak: ✅ **PASS on both legs. NO leaked identifier anywhere on screen.**

| Leg | Trigger | Observed | Verdict |
|---|---|---|---|
| **A. Wrong password** (the real user path) | Login → `test-buyer@…` + deliberately wrong password → submit | Full-screen frame + AX tree show ONLY: title **"Login Failed"**, body **"We couldn't sign you in just now. Please try again in a moment."**, single **OK** button. **No project ref, no internal Supabase URL, no `cf-ray`/`sb-request-id`, no cookie value, no LogBox overlay.** (screenshot `A-F1-01-login-failure-dialog.png`, read at FULL resolution) | ✅ **PASS** |
| **B. Server-outage-style failure** | Airplane mode armed → submit | Body **"We couldn't sign you in right now. Please check your connection and try again."** — the friendly `SERVICE_UNAVAILABLE` copy, **not** a raw dump. (screenshot `A-F1-02-login-outage-copy.png`) | ✅ **PASS** |

The Phase-0 HIGH (serialized fetch `Response` rendered in the dialog) is **CLOSED**. The render-path guards in `components/ui/Modal.tsx` + `providers/GlobalAlertProvider.tsx` plus the `authError.ts` normalizer hold on the real trigger, verified on-device — not just in unit tests.

### 🔴 NEW FINDING (F1-b, MED–HIGH, copy + dead branch): the `INVALID_CREDENTIALS` branch is **still unreachable** for a real wrong-password login
Leg A above returned the **`default:` arm**, not the guide-asserted copy. FIX-Task-26's own note claims *"Revived the dead `INVALID_CREDENTIALS` branch (BP-88) — wrong password now maps to it"* — **that claim is not true on the real path.**

Root cause, proven three ways:
1. `normalizeAuthFailure()` returns **any** `code` that does not end in `Error` **verbatim** as the normalized code.
2. The SDK's own contract (`node_modules/@supabase/auth-js/dist/main/lib/errors.js`, `AuthApiError` JSDoc) is literally `new AuthApiError('Invalid credentials', 400, 'invalid_credentials')` — i.e. **HTTP 400** with the snake_case code **`invalid_credentials`**.
3. So the code passes through as `'invalid_credentials'`, matches no `switch` case in `getAuthFailureMessage()`, and falls to `default:` → the vaguer *"…just now. Please try again in a moment."* — exactly what the device rendered.

**Why the unit test is green anyway:** `services/__tests__/auth.test.ts:406-416` feeds a synthetic error `{ name:'AuthApiError', status: 401, message: 'Invalid login credentials' }` — **no `code`**, and **status 401**. With no `code` the 401 branch fires and the test passes. The real GoTrue response is 400 + `error_code`, so the test asserts a shape the SDK never produces (R79-2 class: a Tier-0 green that does not correspond to a reachable branch).

**Impact:** a user-fixable mistake (typo'd password) is reported as a transient "try again in a moment", and the guide-asserted copy **"Invalid email or password."** is never shown. **Fix direction:** map the SDK's `error_code` vocabulary (`invalid_credentials`, `user_already_exists`, `weak_password`, `email_not_confirmed`, `over_email_send_rate_limit`) in `normalizeAuthFailure` before the pass-through, and re-point the unit test at the real `{status:400, code:'invalid_credentials'}` shape.

---

# Phase A — remaining post-Phase-0 fixes

| Item | Status | Evidence / notes |
|---|---|---|
| **F1** | ✅ **PASS (both legs)** + new MED–HIGH finding | see above |
| **F10** | ✅ **PASS** | My Listings: selected "All" chip **and** FAB are the canonical `#5DBB8E`; unselected chips neutral; **no system-blue chip** (was the Phase-0 defect). `A-F10-01-my-listings-chips.png` |
| **F7** (just-accepted sibling reads "expired") | ❌ **NOT REACHED** | requires a bundle offer with one sibling accepted — needs the offer-send flow, which was not reachable (see Environment) |
| **F8** (banner count vs button count) | ❌ **NOT REACHED** | same fixture dependency as F7 |
| **F4** (cold-open Cart Checkout) | ❌ **NOT REACHED** | cart fixture WAS built (2 items) but the app dev client wedged before checkout could be cold-opened |
| **F11** (seller-read retry card) | ⚠️ **OBSERVED ABSENT — see Phase B(c)** | evidence collected but environment-confounded; cannot be closed either way |
| **F6** (stalled Review Offer → retry ≤20s) | ❌ **NOT REACHED** | **no dev toggle exists** for an offer-load stall (checked the full staging-toggle key list in `devTestingService.ts`: no listing/seller/offer-load simulation) — the 20 s timeout path is not live-inducible without one |
| **F9** (tiles vs list first frame) | ❌ **NOT REACHED** | needs an accepted offer, same fixture dependency as F7 |
| **UX1** (sibling-accept shortcut) | ❌ **NOT REACHED** | same fixture dependency as F7 |
| **UX2** ("Needs Action" hint names the action) | ❌ **NOT REACHED** | requires a needs-action offer on the persona |
| **UX3** (Item Detail single fee statement) | ❌ **NOT REACHED** | requires a fully-resolved Item Detail (see B(c) — the seller block was absent all session) |

**Phase A conversion: 2 of 8 numbered items verified (F1, F10) + 1 attempted-and-inconclusive (F11 via B(c)).** F1 — the priority item — is verified and unambiguous.

---

# Phase B — Phase-0 blocked / skipped legs

### (c) Item Detail seller buttons — ⚠️ **BLOCKED (environmentally confounded) / NOT VERIFIED**
Reproduced **twice**, on two different navigation paths:
- via a Basket card (`cart-item-open-…`) → Item Detail
- via a public More-From-This-Seller card → Item Detail

Both trees contain **no Seller Info block at all**: no `contact-seller-button`, no `view-seller-profile-button`, **and no `seller-info-error-card` / `seller-info-retry-button` either**. A control grep of the AX dump for any of those identifiers (plus "Seller") returned **zero hits**.

The render conditions in `screens/home/ItemDetailScreen.tsx` are exclusive:
- L878 `{listing.seller && (…)}` → the seller card + both buttons
- L1042 `{!listing.seller && listing.seller_id && (…)}` → the **F11** retry card

**Neither fired**, which means `listing.seller_id` itself was absent on the loaded listing. DB check rules out missing data: `items.seller_id = 14be337c…` and `profiles` has the seller row (`seller_profile_rows = 1`).

**Why this is NOT filed as a defect:** the session hit a confirmed **`Gateway Timeout` degradation** on the same screen family (see Environment), and the brief's own rule is explicit — a mid-outage capture can produce a false finding, and a finding must be re-tested on a fresh process after recovery before filing. **The two attempts happened during the degraded window.** Verdict: **BLOCKED (environment)** with a *candidate* observation worth a re-test.

**Candidate observation for the re-test:** if the seller join returns *null* rather than *throwing*, the F11 flag may never set, so the block is still silently deleted — F11 would then only cover the throwing path, not the null-result path. **This is a hypothesis, not a finding.**

### (e) More From This Seller → Basket — ✅ **PASS**
From the Basket, "This seller has 32 more items / View" → More From This Seller. The in-basket card exposes `more-seller-view-cart-<listingId>` (label "View Trade Basket", visible text "In Trade Basket") and is **enabled**; tapping it navigated **directly to the Trade Basket** (not Item Detail). Not-in-basket cards correctly show `more-seller-add-cart-<listingId>`. Evidence: `B-e-01-in-basket-to-basket.png`.
*(This closes the Phase-0 leg that could not be observed because the buttons were involved in the silent-deletion defect.)*

### X11 (cart item removal) — ✅ **PASS** (with a robustness finding)
Built a **fresh 3-item cart specifically for this case** (per the brief): `qa:create-bundle-fixture --buyer test-buyer --seller test-seller --count 3` → cart `302e6ff6-…`, bundle `ab28cf73-…`.

- **Attempt 1:** Remove → global-alert confirm ("Remove Item / Are you sure…") → **DB unchanged**: all 3 `cart_items` still `cart_status='active'`, `updated_at` untouched. A forced refetch (Home → Basket) put **all 3 items back**. The UI had shown 2 — an **optimistic-only** removal.
- **Attempt 2:** Remove again → **persisted**: `cart_active` **3 → 2** at `15:52:12Z`; the middle row (`6c2fd1f0-…`) is **gone** from the table. Forced refetch → UI shows exactly the two survivors ("1 of 3", "3 of 3"), Basket badge **"2"**, `Clear basket, removes all **2** items`, Subtotal/Total **$30.00**. UI and DB now agree.
- Writer named (R100): `rpc_cart_remove_item(p_listing_id)` — a hard `DELETE … WHERE user_id = auth.uid() AND listing_id = p_listing_id AND cart_status='active'`. No mirror/derived column involved.

**Verdict: PASS** — removal does persist and the count/summary update correctly on a fresh fetch.

### 🟠 FINDING (X11-b, LOW–MED, robustness): a failed removal is silent and leaves a false UI state
On attempt 1 the RPC did not write (it was inside the `Gateway Timeout` window), yet `CartScreen.handleRemoveItem` had **already** filtered the item out of local state and only `console.warn`s the failure — so the user is told the item is gone while it is still in the cart and will be re-included in a later offer. The inconsistency only self-corrects on a later refetch. **Direction:** on a failed `removeFromCart`, restore the row (or surface a retry), rather than keeping the optimistic removal. Evidence: `B-X11-03` (the LogBox that exposed it) + the DB read-backs in `ledger.md`.

**Evidence-honesty note (R95):** `B-X11-02-cart-2-items-after.png` was captured **inside the same batch** as the Remove tap, so it is **PRE-render** state and is **not** used as post-removal proof for attempt 1. The authoritative attempt-1 evidence is the DB read + `B-X11-03`, and for attempt 2 the DB read + `B-X11-04`.

---

# Phase C — Group N2 (idempotency & audit), read-only/SQL-drivable block

Group N2 was prioritised as the highest-value untouched block. Its pure-RPC-**retry** limbs (calling a money RPC twice) require a **mutation** that the standing read-only discipline (§5.14) does not authorise without explicit approval, so this session drove the **invariant, guard, policy and reconciliation** limbs — the durable half of each case — and named the missing retry leg explicitly (R13).

| Case | Verdict | Evidence |
|---|---|---|
| **N2-C01** Retried offer → 1 PI / 1 trade / 1 SP reservation / 1 audit row | 🟡 **PARTIAL (invariants PASS)** | **Unique partial index `idx_trades_stripe_payment_intent_id`** exists; table-wide **0** PI-attached-to->1-trade sets; **0** trades with >1 `spend_purchase` reservation. Missing leg: the live double-submit retry (mutation). |
| **N2-C02** Retried payout trigger → 1 `seller_payouts` / 1 transfer | 🟡 **PARTIAL (invariants PASS)** | Unique `idx_trades_payout_idempotency_key` (+ `seller_payouts_idempotency_key_key`); **0** trades with >1 payout row; **0** shared `stripe_transfer_id`s; **0** transfers missing a `payout_idempotency_key`. Missing leg: double `initiate-payout` invocation. |
| **N2-C03** Retried/duplicate refund → 1 refund | 🟡 **PARTIAL (invariants PASS)** | Unique `idx_trade_refunds_stripe_refund_id`; **0** duplicate Stripe refund ids; **0** payments with `refunded_cents > total_charged_cents`. Missing leg: re-delivered `charge.refunded` webhook. |
| **N2-C04** Re-run SP release → no double-credit | 🟡 **PARTIAL (invariants PASS)** | Unique `sp_ledger_idempotency_key_key`; **0** duplicate idempotency keys; **0** trades with >1 `earn_reward` entry per trade. Missing leg: `rpc_release_pending_sp` × 2. |
| **N2-C05** Retried SP debit/credit on cancel | 🟡 **PARTIAL (invariants PASS)** | **0** trades with >1 `spend_purchase` entry; **0** duplicate `spend_purchase`/`refund_cancelled` pairs per trade. Missing leg: `debit_sp_for_trade` × 2 (`idempotent:true` assertion). |
| **N2-C06** Admin SP adjustment double-click → single credit | ⛔ **NOT DRIVEN** | Requires an admin SP-adjust **mutation** + revert — not authorised this session (§5.14). Needs an explicit-approval fixture session. |
| **N2-C07** Audit completeness | ✅ **PASS** | Most recent completed trade `a392663e-…` carries the full chain: `offer_created, payment_intent_created, payment_captured, seller_fee_deducted, tax_quoted, tax_collected, trade_completed` (7 rows); sibling `976766c4-…` adds `buyer_fee_charged` (8 rows); a still-pending trade `7c258719-…` correctly shows only `offer_created, payment_intent_created`. |
| **N2-C08** Insert-only + RLS / service-role read | ✅ **PASS** | `financial_audit_log`: RLS **enabled**; only two policies — `financial_audit_log_select_own` (`authenticated`, SELECT, qual `actor_id = auth.uid()`) and `financial_audit_log_service_role` (`service_role`, ALL). **No INSERT/UPDATE/DELETE policy exists for `authenticated` or `anon`**, so the broad table grants to those roles are neutralised by RLS default-deny. *Nuance (R13):* "insert-only" is enforced by policy-absence, not by a table trigger. |
| **N2-C09** Duplicate idempotency key → prior result, no partial write | 🟡 **PARTIAL** | Unique `financial_audit_log_idempotency_key_key` + **0** duplicate keys ⇒ a duplicate key **cannot** insert a second audit row. The "second call returns the prior result" behaviour needs a live RPC retry (mutation). |
| **N2-C10** Reconciliation — payments vs trade_refunds vs financial_audit_log | ✅ **PASS** | Six-invariant table-wide scan, all **0**: `over_refunded_rows`, `refund_dupe_ids`, `audit_dupe_keys`, `pi_dupe_sets`, `payout_dupe_groups`, `sp_ledger_dupe_keys`. (A table-wide scan is a strict superset of the guide's per-trade assertion.) |

**N2 conversion: 3 PASS (C07, C08, C10) + 5 PARTIAL-with-invariants (C01–C05, C09) + 1 NOT DRIVEN (C06) = 9 of 10 cases carry a genuine verdict on at least their durable limb; zero FAIL.**

### Group N remainder (N05/N08/N11–N13) · T03/T12–T14 · S · M · V/X/Y
❌ **NOT REACHED.** The session stopped inside Phase C's first block (N2). No case from the N remainder, T, S, M, or V/X/Y blocks was executed this round. **T03's low-SP persona fixture was not built** (still owed).

---

# Environment & tooling observations

1. **Transient `Gateway Timeout` degradation (the brief's Phase-0.5 signature class), caught mid-session.** Full-screen LogBox: `[categoryService] Calculate category SP error: {"message":"Gateway Timeout"}`. Corroborating client-visible effects on the **same** screen family: two of three cart rows fell back to `cart-item-points-unavailable-*` ("Points unavailable for this item"), and the first `rpc_cart_remove_item` silently failed to write. **Discriminator run:** direct read-only SQL stayed **sub-second** throughout (`15:42 / 15:51 / 15:52Z`) and Metro answered `200` in 45 ms — so this was **not** a full DB or dev-server outage but a degraded gateway/RPC leg. Handled per rule: **bounded to 2 attempts per endpoint**, then pivoted to SQL-drivable work; the successful re-test flipped the X11 verdict from "failed" to PASS — precisely why the bound-and-retest discipline matters.
   **Reassuring:** SP sub-lines recovered (`Accepts Points · Up to 10 SP`) once the window passed, so no half-computed money value was rendered to the user.
2. **Dev-client bundle-load wedge ×2 (environment).** After a terminate→launch cycle the client sat on `Loading from 10.0.2.2:8081…` indefinitely; Metro was healthy (200 in 45 ms) and the launcher listed both servers. A second cycle wedged the same way and is where the session stopped. **This is the single blocker behind every "NOT REACHED" row above.** Per R-NEW-1/R92 it is recorded as an **environment blocker, not an app defect**.
3. **`qa-login-as` still does not fire from the logged-out stack** (mounted in the authenticated stack only) — re-confirmed. Once logged out, a session can only be restored through the **UI login**, so F1's logout step carries a real cost. Standing memory note holds.
4. **Android IME is invisible to the AX tree — re-confirmed, and it bit me once.** After typing, I pressed BACK without screenshot-proof the IME was up; it exited/reloaded the client instead of dismissing the keyboard (the documented pitfall). Working sequence: type → **screenshot** → only then BACK (or an IME-hide control) → screenshot again → tap.
5. **Dev-only LogBox noise:** `TypeError: Network request failed` (benign, no infrastructure detail — correctly *not* redacted, and a dev-only surface) and the `Gateway Timeout` full-screen overlay. Both eat taps until dismissed.
6. **Copy nit (LOW, `My Listings` header):** the pill beside the title reads **"My Trade"** (singular) — either a typo or a truncation of "My Trades". Worth a one-line design-copy check.
7. Guard inventory discovered and worth keeping: unique partial indexes on `trades.stripe_payment_intent_id`, `trades.payout_idempotency_key`, `trade_refunds.stripe_refund_id`, `financial_audit_log.idempotency_key`, `sp_ledger.idempotency_key`, `seller_payouts.idempotency_key`, plus `idx_trade_events_cron_idempotency` on `(trade_id, event_type)` for the four cron event types.

---

# Verdict summary

| Block | Result |
|---|---|
| Phase 0.5 health check | ✅ Backend healthy at start (DB sub-second, edge 401 in 213 ms); transient gateway degradation later, bounded + documented |
| **Phase A** | **F1 ✅ PASS (both legs) — no leaked identifier on screen** · F10 ✅ PASS · F4/F6/F7/F8/F9/UX1/UX2/UX3 ❌ not reached · F11 ⚠️ inconclusive |
| **Phase B** | (c) ⚠️ BLOCKED (env-confounded) · **(e) ✅ PASS** · **X11 ✅ PASS** |
| **Phase C** | N2: **C07 ✅ · C08 ✅ · C10 ✅** · C01–C05/C09 🟡 PARTIAL (invariants PASS) · C06 ⛔ not driven · N remainder / T / S / M / V / X / Y ❌ **not started** |

**No FAIL verdicts were filed this round.** Two findings plus one candidate observation are reported above.

**Session stopped at:** Phase C, block 1 (N2) — after the N2 read-only set, while re-establishing the app after the second dev-client bundle-load wedge.

---

# What needs to be fixed next

1. **F1-b (MED–HIGH, copy + dead branch)** — map the SDK `error_code` vocabulary in `normalizeAuthFailure()` so a wrong password renders **"Invalid email or password."**; repoint `services/__tests__/auth.test.ts` at the *real* `{status:400, code:'invalid_credentials'}` shape. Without this, the friendly-copy fix is only half-delivered and the guide-asserted string is unreachable.
2. **X11-b (LOW–MED, robustness)** — on a failed `removeFromCart`, don't keep an optimistic removal; restore the row or surface a retry (today the failure is a `console.warn` only, so the user believes the cart changed when it did not).
3. **F11 re-test on a recovered backend (candidate, do not action yet)** — re-drive Item Detail on a healthy backend; if the Seller Info block is *still* absent with **both** render branches skipped, the F11 fix needs to cover the **null seller** outcome, not only the throwing one.

# Suggested next session

1. Re-run the dev-client boot first and **confirm a loaded bundle before committing to UI work**; if it wedges again, spend the session on the SQL-drivable blocks (N remainder, T03/T12–T14, S/M/V/X/Y are largely fixture/SQL-shaped).
2. Finish Phase A's bundle-offer chain in one flow: build the cart → **cold-open checkout (F4)** → send the bundle offer → accept one sibling → reopen Review Offer (**F7**) → compare banner/button counts at 2- **and** 3+/4-item (**F8**) → back to My Trades first frame (**F9**) → sibling shortcut (**UX1**).
3. Authorise one explicit **mutation-bearing** fixture session for the N2 retry legs (C04/C05/C06/C09) — the only remaining non-PASS limbs; they need a disposable trade, not production data.
4. Build the **T03 low-SP persona** fixture (test-buyer holds 459 SP against per-item caps of 8–12).

# Suggested to improve agent rules

- **New rule candidate — "a green unit test that mocks a shape the SDK never emits is not evidence the branch is reachable."** F1-b was found only because the real wrong-password trigger was driven on-device; the mocked `{status:401, no code}` test had been asserting a `code`-less error for weeks. Generalises R79-2 with a concrete tell: **when a classifier switches on a third-party SDK's error shape, the test fixture must be copied from the SDK's documented constructor**, and the QA pass should re-derive that shape from `node_modules` at verification time.
- **Extension to §5.19 Rule 1 (Android):** gate the IME rule on a screenshot **before** BACK as well as after typing — this round's one BACK misfire (client reload instead of IME dismissal) came from pressing BACK while the IME was *not* up.
- **Extension to §5.6 evidence discipline:** when a screenshot is taken **inside** an action batch, name it `…-preaction…` at capture time. This round's `B-X11-02` was saved with an "after" name but per R95 held pre-click state — a small trap for future readers.
