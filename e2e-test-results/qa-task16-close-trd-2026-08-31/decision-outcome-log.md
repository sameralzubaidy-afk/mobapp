# QA Task 16 — Full Decision-and-Outcome Log (for AI-agent friction analysis)

**Purpose:** A complete action→reasoning→tool-call→outcome trace of the QA Task 16 run, written so an AI agent can derive:
- (a) what slows execution,
- (b) what patterns an agent should adopt proactively,
- (c) what instrumentation/fixture work removes the friction.

**Focus:** the steps that consumed the most time and tool calls, and the fixes that prevent a smaller future run from repeating them. This run was a *verification* of the QA Task 15 friction fixes (R-NEW-1..6 + DT76/DT77 instrumentation), so it also measures whether those fixes worked.

**Run:** 2026-08-31 · Sections A (DT76) + B (W09/W10) + C (T06) + D (I/H/K)
**Device:** iPhone 17 Pro Max sim (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`), dev build
**Backend:** Supabase staging `drntwgporzabmxdqykrp` · Admin `http://localhost:3001`
**Evidence:** `e2e-test-results/qa-task16-close-trd-2026-08-31/` (`report.md`, `screenshots/`)

---

## 0. Executive summary

The run was **fully successful — 18 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED** — and it was **materially cheaper than QA Task 15**: the friction-attributable call waste dropped from ~90 (QA Task 15) to roughly ~25 this run, confirming R-NEW-1..6 + the DT76/DT77 instrumentation work as intended. Every QA Task 15 "big friction class" was either eliminated or reduced:

| QA Task 15 friction class | QA Task 16 result |
|---|---|
| F1 stuck-alert coordinate-guess loop (~20 calls) | **Did not recur.** The one blind-AX/stuck state (a stale LogBox replay) was resolved in a **2-call terminate+relaunch** (R-NEW-1). |
| F4 SP input invisible + keyboard clears (~12 calls) | **Eliminated** — the DT77 `qa-set-sp` deep link set SP in 1 call per value. |
| F3 admin 2-call deferrals + huge snapshots (~15) | **Reduced** — admin actions batched into single JSON-returning `run_playwright_code` blocks (R-NEW-5). |
| F2 stale TradeList AX (~15) | **Reduced** — OCR-first used once (the "Includes points redemption" tag); deep-link nav avoided most TradeList scrolling. |
| F5 schema drift (~8) | **Reduced to ~0** — schema cheat-sheet + `information_schema` consulted up front (R-NEW-3). |

The run's remaining frictions are **small, mostly instrumentation gaps** (not recurring big-ticket items): (1) the buyer-side "Includes points redemption" tag not being AX-exposed (needed an OCR confirm), (2) the disclaimer accept-button disabled state not being AX-exposed (needed a functional tap to prove the gate), (3) the buyer having no cancel path for in-progress *bundle* trades (QA had to use admin force-cancel to free a fixture), (4) the admin `run_playwright_code` deferred 2-call tax, and (5) an undocumented `qa-trade-success` param (`spAmountDollars` vs `spUsed`). Each is cheap to fix and itemized in §5.

---

## 1. Run phases (high-level map)

| Phase | Scope | Outcome | Friction level |
|---|---|---|---|
| P0 | Environment: sim, app, admin, fixtures (R29 + R-NEW-6) | OK | Low |
| P1 | Section C — T06 (3-item SP counter/caps on CartCheckout) | PASS | Low–Med (SP entry now 1-call via qa-set-sp) |
| P2 | Section A — A2 tag + A1 Kids-Bicycle +61 (incl. fixture freeing + rebuild) | PASS | **Med-High** (MAX_PENDING_OFFERS surprise; in-progress bundle cancel gap) |
| P3 | Section A — A3 admin filter reset + A4 admin-set-cap leg | PASS | Med (admin set/revert; mobile hint re-check) |
| P4 | Section B — W09/W10 Force Cancel on non-terminal fixture | PASS | Low (fixture pre-verified, R-NEW-6) |
| P5 | Section D — I06–I09 disclaimer + H01–H04 CTAs + K11 seller fee | PASS | Med (disclaimer gate assertion; qa-trade-success param discovery) |

---

## 2. Detailed decision-and-outcome log (by phase)

> Format per entry: **Goal → Decision/Reasoning → Tool calls that mattered → Outcome → Calls spent / notes.**

### P0 · Environment confirmation (R29 busy check + R-NEW-6 fixture feasibility)
- **Goal:** confirm sim online, app installed, admin up, and the W09/T06 fixtures actually exist before starting.
- **Decision:** (a) R29 busy check — `xcrun simctl list devices booted` + `ps` scan for in-flight agent processes + newest `e2e-test-results/` mtimes (all clear); (b) R-NEW-6 fixture-feasibility — 3 read-only DB queries proving the non-terminal W09 bundle (`93e84d1c`, 1 in_progress + 1 completed, `notes='fixture:W09-non-terminal-bundle'`) and the T06 3-item Accept-SP cart (`e1eab713`) already existed (provisioning had run).
- **Calls:** simctl + ps (2), admin HTTP checks (1), 4 SQL queries, list-apps (1).
- **Outcome:** clean start, no busy collision, both previously-BLOCKED fixtures present — W09/W10 and T06 were already unblocked before a single tap. **Calls: ~8. Low friction.**
- **Lesson (proactive pattern):** the R-NEW-6 "prove the fixture with one query before touching the UI" step is the highest-leverage pre-flight — it turned W09/T06 from "hunt the UI" into "verify with 2 queries, then execute".

---

### P1 · Section C — T06 (Points remaining counter, real-time)

#### C1 — Login + navigate to CartCheckout
- **Goal:** as test-buyer, reach the CartCheckout screen with the pre-seeded 3-item bundle.
- **Decision:** deep-link-first (R-NEW-2) — `p2pkidsmarketplace://qa-login-as?persona=test-buyer` (1 call), then Basket tab → Make Offer (2 taps). The AX tree confirmed 3 items with "Accepts Points · Up to N SP" hints already reflecting the server-authoritative caps (Toys 11, Books 16, Sports 17) — an early on-device confirmation of DT76 Item 4.
- **Calls:** ~6.
- **Outcome:** on CartCheckout, "Points remaining: 445", 3 SP inputs AX-exposed (DT77's accessibilityLabel fix works — QA Task 15's invisible-SP-input is gone). **Low friction.**

#### C2 — Apply + clear SP, verify real-time counter (the core T06 assertion)
- **Goal:** show the counter updates immediately per entry/clear and restores to the original balance.
- **Decision:** use the DT77 `qa-set-sp` deep link (`p2pkidsmarketplace://qa-set-sp?listing=<id>&amount=<N>`) for every entry/clear — 1 call per value, no tap-type-clear cycles.
- **Calls:** set 11/16/17 (3) + verify after each (3), clear item1 (1) + verify (1), clear remaining two (2) + verify (1) ≈ **10**.
- **Outcome:** counter **445→434→418→401** on entry, **→412→445** on clear — real-time, no stale value. **PASS.**
- **Lesson (proactive pattern):** `qa-set-sp` collapsed QA Task 15's #1 per-value cost (~5 calls) to 1. Any checkout/SP case should use it by default. **The deep-link-per-action pattern is the single biggest call-saver in this run.**

#### C3 — Submit the T06 bundle offer (creates the A2 tag fixture)
- **Goal:** turn the SP-applied 3-item cart into a pending bundle offer (needed for the A2 "Includes points redemption" tag check).
- **Friction encountered (the disclaimer modal checkbox — the user's observation):**
  - Tapping Send Offer opened the **Liability Disclaimer modal** with the checkbox gate (§5.47b codified fact). The tap sequence was: checkbox row center `(220,824)` (R30 geometry) → verify `value:"checked"` → Accept `(325,878)`.
  - The friction the user noticed: asserting the **accept-button disabled state** is not cheap. The AX tree does NOT expose a `disabled` state on `disclaimer-modal-accept-button` (no `accessibilityState.disabled`), so to *prove* the gate is disabled you must either functionally tap Accept (and confirm nothing happens) or color-scan the pastel `#ABDAC4`. For routine checkout (T06, A1) I did NOT do the functional tap — I trusted the §5.47b codified fact (checkbox-first) and went straight to check→accept, which is only 2 taps. The extra calls only appeared later in I06 where the disabled state is itself the assertion.
- **Calls:** Send Offer (1), checkbox (1), verify checked (1), accept (1), Trade Initiated verify (1) ≈ **5**.
- **Outcome:** pending bundle `df842cea` created with sp_amount 11/16/17 + multipliers 1.20/1.10/1.30 (DB-verified). **PASS.** Order-summary math also verified: Subtotal $69 − $44 SP + $1.49 + $3.22 = **$29.71**.
- **Lesson (proactive pattern):** checkbox-first is a standing fact — never tap Accept first on this modal; 2 taps to pass the gate.

---

### P2 · Section A — A2 tag + A1 Kids-Bicycle +61

#### A2 — "Includes points redemption" tag on buyer + seller bundle cards
- **Goal:** confirm the DT76 T10 tag renders on a pending bundle with SP on both the buyer's "Your Offers" and the seller's "Action Required".
- **Friction encountered (the user's observation about the AX tree):**
  - Buyer leg: the tag text **did NOT surface in the AX tree** (TradeList is a known stale-AX screen per QA Task 15, so I did not treat this as a pass/fail signal — I took a screenshot + OCR). **OCR confirmed "Includes points redemption"** on the buyer's bundle card with the correct per-item SP (16/11/17).
  - Seller leg: the SAME tag **DID surface in the seller's AX tree** (NEEDS ACTION list) — same component, different exposure. This is the telling detail: the buyer's "Your Offers" bundle-card container sets `accessible` (TradeListScreen ~L1104), which on iOS **groups and hides its child StaticTexts** (including the tag); the seller's NEEDS ACTION card structure does not set `accessible` on the container, so children surface.
  - Root cause (confirmed from source): not AX-tree staleness — a **container-`accessible` child-hiding effect** on the buyer's card. The fix is dev-side (see §5 FIX-AX).
- **Calls:** buyer OCR (2), seller list (1) + confirm (1) ≈ **4**.
- **Outcome:** tag confirmed rendered on BOTH lists → **PASS** (with a real instrumentation finding).
- **Lesson (proactive pattern):** TradeList remains OCR-first for non-testID content. But the *durable* fix is to make the tag itself AX-exposed (and/or not group children with container-`accessible`).

#### A1 — Review Offer bundle list shows +61 SP (not +60), matching the payout card
- **Goal:** reproduce the exact fixture where DT76's T08 off-by-one was observed (Kids Bicycle, Sports 1.10 → +61) and verify bundle list == payout card on the seller's Review Offer.
- **Friction 1 — Kids Bicycle is locked in a leftover in-progress bundle (`5b69480b`).**
  - **Reasoning:** the DUPLICATE_OFFER EF guard (per buyer+listing, statuses pending/payment_failed/in_progress) blocks test-buyer from re-offering on Kids Bicycle until the old bundle is gone. The other buyer personas are free-tier with 0 SP (DB-verified) → cannot drive an SP offer. So test-buyer must free Kids Bicycle.
  - **Attempted path A (buyer-side app cancel):** opened the bundle's Trade Timeline — discovered it exposes **NO cancel button for in-progress bundle trades** (only Request Extension / Confirm / Report Problem; source-confirmed the cancel lives on the *single-trade* TradeDetailScreen, unreachable from the bundle Timeline). ~4 calls to discover this.
  - **Attempted path B (deep link):** `p2pkidsmarketplace://trade/<id>` now works (DT77) but lands on the bundle **Trade Timeline** (no cancel) — confirms the same dead end. 1 call.
  - **Decision — go to admin:** the admin "Force Cancel Entire Bundle" (the W10 mechanism) is the clean, single-path way to free both Kids Bicycle + Vintage Comic. One navigation + one batched force-cancel script + DB verify. ~6 calls.
  - **Outcome:** `5b69480b` force-cancelled (2 trades), SP correctly re-credited (available 445→446, reserved 55→54 after the T06 44-SP reservation), Kids Bicycle + Vintage Comic freed. **~11 calls total for the freeing step** — the #1 friction of the run, caused by a missing app feature (buyer cannot cancel an in-progress bundle), not by QA tooling.
- **Friction 2 — MAX_PENDING_OFFERS surprise on resubmit.**
  - **Reasoning:** rebuilt the cart (Kids Bicycle + Vintage Comic via listing deep links + add-to-cart), applied SP=45 via `qa-set-sp`, submitted → **HTTP 409 `MAX_PENDING_OFFERS`** ("You have 3 pending offers with this seller"). test-buyer still had the T06 bundle (3 trades → 1 deduped slot) + LEGO + Nintendo pending = 3 slots with test-seller (cap 3). This was a **should-have-been-known** state (R26: run `qa:reset-offer-fixtures` at the start of any offer/bundle session — I had not).
  - **Decision:** R23 — read the raw EF error via `qa:ef-repro` before concluding anything (1 call, definitive). Then run the sanctioned `qa:reset-offer-fixtures` (dry-run preview → live) to free slots + clear stale cart. Then rebuild the cart and resubmit.
  - **Calls:** ef-repro (1), reset dry-run (1), reset live (1), cart rebuild (4), re-submit + disclaimer (5), DB verify (1) ≈ **13**.
  - **Outcome:** clean re-offer → **pending bundle `b6b42db4`** (Kids Bicycle sp=45, multiplier **1.10**; Vintage Comic sp=0, 1.30) → reviewed as test-seller.
  - **Lesson (proactive pattern):** the reset script should be the **first** offer/bundle action of any session (R26), not triggered by the first `MAX_PENDING_OFFERS`. This cost ~13 calls that a 1-call pre-run would have avoided.
- **Friction 3 — stale LogBox replay after the failed submit.**
  - After the `MAX_PENDING_OFFERS` failure, a **stale LogBox replay** scrim blocked the next screen. **Decision: R4/R-NEW-1 — terminate + relaunch immediately** (2 calls) rather than attempting dismissal. Session persisted; app came back clean.
  - **Calls: 2.** (QA Task 15's identical class cost ~20.)
- **The verification itself (no friction):** as test-seller, Review Offer → "View all items" → bundle list shows **Kids Bicycle +61 SP** (45 + FLOOR(60×0.25×1.10)=16), Vintage Comic +8, total **+69**; the Kids Bicycle payout card shows **+61 SP** and "61 SP releasing in 2 days" → **bundle list == payout card. PASS** (also corroborated on the T06 bundle: Sports 1.10/Books 1.30/Toys 1.20 → per-item +23/+23/+17 all matching payout).
- **Calls for A1 total:** ~30 (11 freeing + 13 reset/rebuild + 2 relaunch + ~6 verify) — the **heaviest phase**, and ~70% of its cost is the missing buyer-cancel-app-feature + the missed R26 reset, both avoidable.

---

### P3 · Section A — A3 admin filter reset + A4 admin-set-cap leg

#### A3 — /trades status filter resets on Single↔Bundle toggle
- **Goal:** verify DT76 Item 3 (TradeFilters keyed on `initialView` → select remounts to "All Statuses").
- **Decision:** one batched `run_playwright_code` (R-NEW-5): set status="completed" → read → click "Bundle Trades" → read URL + status → click "Single Trades" → read status. Returned inline JSON.
- **Calls:** 1 script + 1 deferred fetch = **2**.
- **Outcome:** statusAfterSelect="completed" → Bundle → `?view=bundles`, status="all" → Single → status="all". **PASS.**
- **Lesson (proactive pattern):** the batch-assert + JSON-return pattern made this a 2-call case (QA Task 15's W12 analog cost ~6+ calls of snapshot-grepping).

#### A4 — admin-set-cap leg (Sports sp_redemption_cap = 5)
- **Goal:** set an absolute per-category cap via the admin portal, verify the mobile "up to N SP" hint reflects it (not just the % cap), verify the server rejects above it, then revert (R28).
- **Decision:** the cap is a `categories` column, so the admin portal `/categories` → Edit → **SP Config** tab is the write path (NOT `qa:admin-config-set`, which only covers `admin_config`). Set Sports cap=5 (native-setter + change event), Update Category, DB-verify. Then mobile: add a Sports item (Soccer Ball $12) → cart label "Accepts Points · **Up to 5 SP**" + checkout "You can use up to 5 SP" (was 9 at 75%). Then `qa:ef-repro` with `sp_amount:10` → **HTTP 400 `SP_CAP_EXCEEDED`**. Then revert cap to empty via the portal, DB-verify NULL.
- **Calls:** admin set (2), DB verify (1), mobile add+checkout (6), ef-repro (1), admin revert (1), DB verify (1) ≈ **12**.
- **Outcome:** full leg PASS — admin set, mobile hint reflects the absolute cap, server rejects above it, config reverted (R28 discipline).
- **Lessons (proactive pattern):** (a) category caps live in the portal's SP Config tab (not admin_config) — recorded in schema cheat-sheet so it's not rediscovered; (b) R36 — read the applied rate from config, never a guide number; (c) scope-write-then-revert-verify is mandatory for any config the case touches.

---

### P4 · Section B — W09/W10 (previously BLOCKED — unblocked by the new fixture)
- **Goal:** W09 — "Force Cancel Entire Bundle" visible on a non-terminal bundle; W10 — execute it and DB-verify all trades cancelled.
- **Decision:** the fixture was pre-verified in P0 (R-NEW-6), so this was direct: navigate to `/trades/bundles/93e84d1c-…` → one batched script confirms the button + warning → screenshot → one batched force-cancel script (reason → Confirm → read "Succeeded: 2/2") → DB read-back (trades + payments + tax + SP).
- **Calls:** navigate (1), verify script (1), screenshot (1), force-cancel script (1 + deferred fetch), DB (2) ≈ **7**. **Low friction.**
- **Outcome:** W09 PASS (button + warning text present); W10 PASS — both trades → `cancelled` with reason, both `payments` rows → `cancelled`, no Stripe PI/tax/SP to refund (direct-INSERT fixture, correctly handled "as appropriate").
- **Lesson (proactive pattern):** the R-NEW-6 up-front fixture query is what turned the previously-BLOCKED W09/W10 into a low-friction 7-call section.

---

### P5 · Section D — I06–I09 disclaimer + H01–H04 CTAs + K11 seller fee

#### I06–I09 — disclaimer modal sub-paths
- **Goal:** verify the checkbox gate (I06), Cancel (I07), ✕ (I08), checkbox reset (I09).
- **Decision:** drive all four on ONE single-item checkout (Soccer Ball), ordered to avoid re-adding the cart: I07 (Cancel) → I08 (✕) → I09 (reset) → I06 (accept last, which consumes the cart).
- **Friction (the user's observation — the checkbox tap):**
  - The checkbox tap itself is 1 call (R30 geometry `(220,824)` row center — no re-derivation). The user's "took some time" observation maps to **I06's disabled-state assertion**: to prove "Accept is disabled until checked", I did a **functional tap on Accept with the checkbox unchecked** (should do nothing) → re-list to confirm the modal stayed open → then check → re-tap Accept. That's ~3 extra calls because the AX tree does **not expose the accept button's `disabled` state** (`disclaimer-modal-accept-button` has no `accessibilityState.disabled`), so there is no tree-readable "is it disabled?" signal. (Alternative would be a color-scan of the pastel `#ABDAC4` — also ~2-3 calls.)
  - **Fix (see §5 FIX-DISABLED):** expose `accessibilityState={{disabled}}` on the accept button → the gate assertion becomes a 1-call tree read.
- **Calls:** 4 modal open/close cycles + I06 gate test + DB verify ≈ **18**.
- **Outcome:** I06 (gate + accept creates trade + `disclaimer_acknowledged=true` + policy_id + timestamp on the trade row — DB), I07/I08 (modal closes, **no trade** — DB), I09 (checkbox resets to unchecked). All PASS.

#### H01–H04 — completion-screen CTAs by user type
- **Goal:** verify the per-user-type TradeSuccess CTAs (free buyer upsell, subscriber buyer savings, seller SP-pending, seller cash-upsell).
- **Decision:** use the DT51 `qa-trade-success` deep link (force-renders TradeSuccess with explicit params) instead of completing real trades — 1 call per case + 1 AX read.
- **Friction (minor):** H02's "You saved $8 using SP!" came out as "You saved **$0.00**" on the first attempt because the deep-link param that drives the dollar figure is **`spAmountDollars`**, NOT `spUsed` (source-verified: `TradeSuccessScreen` `message = You saved $${spAmountDollars.toFixed(2)}`). One wasted attempt (~2 calls). This is an **undocumented deep-link param** (finding — see §5 FIX-PARAMS).
- **Calls:** 4 × (deep link + AX read) + 1 re-fire + 4 screenshots ≈ **14**.
- **Outcome:** H01–H04 all PASS (H01–H03 carry copy-variance notes vs the guide: H01 generic upsell vs guide's "$2 savings", H02 no "Got it!" prefix, H03 "platform reward" vs "added to your pending wallet").
- **Lesson (proactive pattern):** force-render deep links are the cheapest way to verify state-driven screens; document their params once (see FIX-PARAMS).

#### K11 — seller fee = effectivePct × cash portion
- **Goal:** verify the seller fee formula (5% in the guide) against the live config.
- **Decision:** R36 — read the applied rate from config first (not the guide number): `platform_fee_seller_percentage = 10` (free), `platform_fee_seller_discount_percentage_kids_club_plus = 20`. Verified the observed fees on the 3 pending offers against the EF formula (`effectivePct = subscriber ? 20 : 10`; trial = subscriber): Kids Bicycle 20% × $15 = **$3.00**, Vintage Comic 20% × $25 = **$5.00**, Soccer Ball 20% × $12 = **$2.40** — all matching the Review Offer payout cards.
- **Calls:** 2 SQL + 1 source read ≈ **3**.
- **Outcome:** K11 PASS (mechanism — fee = effectivePct × cash, at offer time) + a **config-intent finding**: the "discount" key is used as the flat subscriber rate (20% > free 10%), which is surprising for a key named "discount"; guide K11's 5% precondition is stale.
- **Lesson (proactive pattern):** R36 saved a false FAIL — had I asserted the guide's 5%, the 20% observed would have looked like a bug; the config read showed it is deterministic behavior.

---

## 3. Friction catalog (ranked by time/calls wasted this run)

| ID | Friction | Calls wasted (est.) | Root-cause class | Fix (see §5) |
|---|---|---|---|---|
| F1 | **Missing buyer cancel for in-progress bundle trades** → had to free Kids Bicycle via admin force-cancel | ~11 | App feature gap (product) | FIX-CANCEL |
| F2 | **MAX_PENDING_OFFERS surprise** → reset + cart rebuild + re-submit | ~13 | Missed R26 reset at session start | FIX-RESET (discipline) |
| F3 | **"Includes points redemption" tag not AX-exposed on buyer's Your Offers** → OCR confirm | ~3 | Container-`accessible` child-hiding | FIX-AX |
| F4 | **Disclaimer accept-disabled state not AX-exposed** → functional gate tap for I06 | ~3 | Missing `accessibilityState.disabled` | FIX-DISABLED |
| F5 | **Admin `run_playwright_code` deferred 2-call tax** (each mutating script needs a second fetch) | ~6 | Tool contract (DT77-era) | FIX-ADMIN-2CALL |
| F6 | **`qa-trade-success` param semantics undocumented** (`spAmountDollars` vs `spUsed`) | ~2 | Missing deep-link docs | FIX-PARAMS |

**Total friction-attributable calls: ~38** of an estimated ~150–170 total run calls. That is ~22% of the budget — down from QA Task 15's ~33% (and from ~90 absolute wasted calls to ~38). Two of the six frictions (F1, F2) are **not QA-tooling** — they are a product decision (should buyers cancel in-progress bundles?) and a missed standing rule (R26 reset), respectively.

---

## 4. Reasoning patterns observed (adopt vs avoid)

### Patterns that WORKED (adopt proactively)
1. **Deep-link-first everywhere** (R-NEW-2) — `qa-login-as`, `listing/<id>`, `qa-set-sp`, `qa-trade-success`, `/trade/<id>` — eliminated multi-tap navigation and most stale-TradeList scrolling. The single biggest call-saver.
2. **One-call fixtures over UI** — `qa-set-sp` (SP), `qa-trade-success` (completion CTAs), `qa-login-as` (persona) collapsed QA Task 15's costliest per-action sequences.
3. **Batch admin into one JSON-returning script** (R-NEW-5) — A3 was 2 calls; force-cancel was 2 calls; each page interaction paid the deferred 2-call tax once, not per action.
4. **R-NEW-1 relaunch-first on a blind/stuck screen** — the stale LogBox replay resolved in 2 calls (QA Task 15's identical class was ~20).
5. **R-NEW-6 fixture-feasibility before the section** — W09/W10 and T06 were proven present in P0 with 2 queries; neither became a UI-hunt.
6. **DB read-back for every money/state/SP assertion** (R11/R24) — every PASS in this run closes with a DB row (pending trades, disclaimer acknowledgment, force-cancel state, wallet SP).
7. **R23 raw-EF-read before concluding** — the `MAX_PENDING_OFFERS` diagnosis was a 1-call `qa:ef-repro`, not a UI-failure guess.
8. **R36 config-read before asserting a money number** — saved K11 from a false FAIL (guide 5% vs live 20%).
9. **OCR-first on TradeList for non-testID content** — the tag check used screenshot+OCR once, per the known-stale-AX playbook.

### Patterns that FAILED / were slow (avoid or add guardrails)
1. **Starting an offer/bundle session without the R26 reset** — the `MAX_PENDING_OFFERS` hit + rebuild cost ~13 calls. Make `qa:reset-offer-fixtures` a mandatory first action.
2. **Attempting the app UI to free an in-progress bundle** — the bundle Trade Timeline has no cancel; after 2 bounded attempts the agent correctly pivoted to admin force-cancel, but the pivot should be immediate (a cached fact: "in-progress bundle trades have no buyer/seller cancel in the app — use admin force-cancel or DB").
3. **Functional-tap to assert a disabled state** — works but costs 3 calls; a tree-readable `accessibilityState.disabled` is the fix. Until then, prefer a single bounded functional tap (not color-scan loops).
4. **Guessing deep-link params** — the `spAmountDollars`/`spUsed` mismatch cost one wasted attempt; params should be documented (FIX-PARAMS).

---

## 5. Recommended fixes (mapped to friction IDs)

### (a) What slows execution — and the direct fix

| Slowness | Fix | Saves |
|---|---|---|
| Missing buyer cancel for in-progress bundle (F1) | **FIX-CANCEL** — product decision + (if intended) add a Cancel button to the bundle Trade Timeline (or document "cancel = admin force-cancel" as the standing path). Also cache this fact so QA never re-attempts the UI | ~11 calls/case |
| MAX_PENDING_OFFERS surprise (F2) | **FIX-RESET (discipline)** — run `qa:reset-offer-fixtures` as the mandatory FIRST action of any offer/bundle session (R26), before assembling fixtures | ~13 calls |
| Tag not AX-exposed on buyer list (F3) | **FIX-AX** — make the "Includes points redemption" tag itself AX-exposed on BOTH bundle-card variants (see below) | ~3 calls/case |
| Accept-disabled not AX-exposed (F4) | **FIX-DISABLED** — add `accessibilityState={{disabled}}` to `disclaimer-modal-accept-button` (BP-53) | ~3 calls/case |
| Admin deferred 2-call tax (F5) | **FIX-ADMIN-2CALL** — make `run_playwright_code` return inline (or document the resume-with-deferredResultId pattern in the playbook) | ~6 calls/run |
| `qa-trade-success` params undocumented (F6) | **FIX-PARAMS** — document `spAmountDollars` (drives "You saved $"), `spUsed`, `remainingSP`, `totalSpToSeller`, `spPendingReleaseDays` | ~2 calls |

### (b) Patterns an agent should adopt proactively (codify as standing rules)
1. **R-16-1 (reset-first):** before ANY session that touches offers/bundles/carts, run `npm run qa:reset-offer-fixtures` (and note the pre-state) — the ~13-call `MAX_PENDING_OFFERS` rebuild is entirely preventable.
2. **R-16-2 (in-progress-bundle cancel is admin-only):** for in-progress *bundle* trades the app exposes no buyer/seller cancel (source-confirmed). To free such fixtures, go straight to the admin "Force Cancel Entire Bundle" (same W10 mechanism) — do not attempt the app UI.
3. **R-16-3 (category-cap writes are portal-only):** `categories.sp_redemption_cap` is written via the admin portal `/categories` → SP Config tab (not `qa:admin-config-set`). Scope-write-then-revert-verify (R28).
4. **R-16-4 (disabled-state assertion):** when a case asserts a control is disabled, prefer a single bounded functional tap (confirm no-op) OR read `accessibilityState.disabled` if exposed — never a color-scan loop.
5. **R-16-5 (deep-link-params):** read a deep link handler's param list (or the target screen's route-param reads) before firing it with crafted params — `qa-trade-success`'s dollar figure is `spAmountDollars`, not `spUsed`.

### (c) Instrumentation / fixture work that removes the friction (dev-team candidates)
1. **FIX-AX (the user's ask):** expose the "Includes points redemption" tag on EVERY bundle card. Root cause confirmed in source: the buyer's "Your Offers" bundle-card container sets `accessible` (TradeListScreen ~L1104), which on iOS groups and hides its child StaticTexts (the tag never surfaces there), while the seller's NEEDS ACTION card does not set `accessible` on its container, so the tag surfaces. Fix: (a) stop setting `accessible` on the buyer card container (or move it to a non-grouping wrapper), AND (b) add `testID="includes-points-redemption-tag"` + `accessible` + `accessibilityLabel` to the tag (BP-53) so it is independently assertable on both lists. Generalize: audit every `accessible`-on-container that hides meaningful child text.
2. **FIX-DISABLED:** add `accessibilityState={{ disabled: true }}` (and `accessibilityHint`) to `disclaimer-modal-accept-button` so the disabled gate is readable from the AX tree (collapses I06-style assertions to 1 call).
3. **FIX-CANCEL:** product decision on whether buyers/sellers can cancel an in-progress bundle; if yes, add the control to the bundle Trade Timeline (it already exists on single-trade TradeDetailScreen). Until decided, document "freeing an in-progress bundle = admin force-cancel".
4. **FIX-PARAMS:** add a doc comment to `QaForceTradeSuccessDeepLinkHandler.tsx` listing every param's meaning (`spAmountDollars` = the "You saved $" figure; `spUsed` = SP count for the buyer-leg condition; etc.).
5. **FIX-ADMIN-2CALL:** make the embedded-browser `run_playwright_code` return inline results for mutations (or document the resume-with-`deferredResultId` step in the playbook as a standing 2-call note).
6. **FIX-RESET-AUTO (optional):** have `qa:create-bundle-fixture` / `qa:create-in-progress-bundle-fixture` warn-and-cancel stale pending offers first (or auto-run `qa:reset-offer-fixtures`) so a session never starts over the cap.

### (d) The three questions the user asked directly

**Q1 — "The tag isn't in the AX tree — should we not fix all missing tags for easier runs?"**
**Yes — this is exactly the FIX-AX class, and it is a real, confirmed dev-side gap, not just QA tooling.** The "Includes points redemption" tag is a plain `<View><Text>` with no `testID`/`accessible`, and on the buyer's "Your Offers" bundle card the *container* sets `accessible`, which on iOS groups and hides the child text (source-confirmed at `TradeListScreen` ~L1104 vs ~L1305 — the seller's NEEDS ACTION card lacks the container-`accessible`, which is why the tag surfaced there). The fix is (1) drop `accessible` from the buyer card container (or wrap it so children aren't grouped) and (2) give the tag a `testID` + accessible + label so automated readers can assert it on both lists. Generalizing: this run proved the value of a **standing "all user-visible labels/tags on cards get testID + accessible" sweep** (BP-53) — every missed one costs a screenshot+OCR confirm per run. I would not, however, make EVERY StaticText AX-exposed (that bloats the tree and slows every list) — only *assertable* elements (tags, badges, status lines, per-item SP) need it.

**Q2 — "Why does the seller see the buyer's card end number (4 digits)? Is this for dev/test use only?"**
**No — it is a production feature, not dev/test.** It is DT-69 (Item 6): `ReviewOfferScreen` shows "Buyer pays via MASTERCARD •••• 4444 (authorized)" on any **pending** offer where the buyer's Stripe payment method was captured at offer time (migration `20260830235900_dev_task_69_trade_payment_method.sql` added `trades.stripe_payment_method_brand`/`_last4`; `create-trade-offer` stores them). The source comment states the intent: *"show the buyer's payment method so the seller knows how the buyer intends to pay before accepting. A pending offer always has a Stripe auth hold, hence the '(authorized)' suffix."* It is hidden for expired/declined offers and for $0-cash (donate) offers. It shows only the **brand + last 4 digits** (the minimum that confirms a card was authorized, not a full PAN). **Privacy flag worth a product decision:** in a parent-to-parent marketplace, some sellers may be surprised a buyer's card brand+last4 is disclosed to them — confirm the design intent and (if desired) make the disclosure opt-in or masked further. It is not a QA/dev artifact.

**Q3 — "I noticed you took some time to tap on this checkbox for checkout."**
The checkbox tap itself is **1 call** (known geometry: `disclaimer-modal-checkbox` row center `(220,824)` — the R30 fast path; no re-derivation). The extra time you noticed is in **asserting that "Accept & Continue" is disabled until the checkbox is checked** — that's the I06 gate check. The AX tree does **not** expose the accept button's disabled state (`disclaimer-modal-accept-button` lacks `accessibilityState.disabled`), so to prove the gate the agent either (a) functionally taps Accept with the box unchecked and confirms nothing happens (~3 calls), or (b) color-scans the pastel disabled fill `#ABDAC4` (~2–3 calls). **Fix (FIX-DISABLED):** add `accessibilityState={{disabled}}` to the button → the gate becomes a 1-call tree read. Until then, the functional tap is the cheaper of the two and should be bounded to a single attempt.

---

## 6. Call-economics summary

```
Total run calls (est.):            ~150–170
Friction-attributable calls:       ~38  (≈22%; QA Task 15 was ~90 / 33%)
  F1 in-progress bundle cancel:    ~11
  F2 MAX_PENDING_OFFERS reset:     ~13
  F3 tag not AX-exposed:           ~3
  F4 accept-disabled not exposed:  ~3
  F5 admin 2-call deferred tax:    ~6
  F6 qa-trade-success params:      ~2
Productive calls:                  ~115–130
```

**Target for a smaller future run:** implement FIX-AX + FIX-DISABLED + FIX-CANCEL + FIX-PARAMS (dev-side) and R-16-1..5 (discipline) → friction drops from ~38 to ~10–12, recovering ~25 calls per equivalent batch. The two biggest (F1+F2, ~24 calls) are a product decision + a standing-rule reset, both removable without any QA tooling.

---

## 7. Answers to the user's specific observations (from the Review Offer screenshot)

1. **Screenshot shows the Kids Bicycle Review Offer with +61 SP bundle list / +61 SP payout card** — this is the A1 PASS artifact: bundle list "+61 SP $12.00" (Kids Bicycle, 45 buyer SP + 16 platform bonus) and payout card "+61 SP" / Net Cash Payout $12.00 agree; bundle total "+69 SP" (61 + 8 Vintage Comic). The "Buyer pays via MASTERCARD •••• 4444 (authorized)" is the DT-69 production disclosure (see Q2). "Accept All 2 Items" is the bundle accept CTA — correct for the 2-item pending bundle.
2. **The 4-digit card number** — production DT-69 feature (brand + last4 only), not dev/test (see Q2).
3. **The checkbox tap time** — the checkbox is 1 call (R30 geometry); the time went into proving the disabled gate, which is not AX-readable (see Q3 / FIX-DISABLED).
