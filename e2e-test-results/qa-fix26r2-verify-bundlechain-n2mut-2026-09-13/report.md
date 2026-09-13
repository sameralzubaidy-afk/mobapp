# QA Task — Verify FIX-Task-26 (round 2) + Bundle-Offer Chain + N2 Mutation Legs + Remainder

**Date:** 2026-09-13 (session 13:49–14:10 EDT / 17:49–18:10 UTC)
**Device:** Android `Medium_Phone_API_36.1` (emulator-5554) — iOS `iPhone 17 Pro Max` booted but NOT driven (R80 platform disclosure)
**Backend:** staging Supabase `drntwgporzabmxdqykrp` (read-only SQL via MCP)
**HEAD:** `a6ce831a` — "# FIX-Task-26 — Invalid-Credentials Classifier Gap + Cart-Removal Rollback + Copy + UX"
**Prior round:** `e2e-test-results/qa-post-phase0-verify-n2-n-2026-09-13/` (HEAD `e94b8ab4`) — F1-A + F10 closed, X11 PASS, N2 partial.
**Evidence:** `screenshots/` (32 frames). Companion `ledger.md`.

> **Scope note (R78-1 recon-first):** the immediately preceding round covered the same brief's Phase A/B most of the way. This run is the **round-2 delta**: HEAD moved from `e94b8ab4` → `a6ce831a` (the dev's F1-b classifier + X11-b rollback + copy fixes), so the priority was re-verifying the fixed surface on a **fresh bundle**, then driving the previously-unreached legs.

---

## Phase 0 — Clean boot + backend health check

| Leg | Probe | Result | Verdict |
|---|---|---|---|
| DB | `select now()` via MCP | `2026-09-13 16:49:15 UTC` returned sub-second | ✅ HEALTHY |
| Boot | foreground-app check + screenshot | Client was **live on the Trade Basket** (NOT wedged — the prior session's end-state had recovered) | ✅ HEALTHY |
| R29 busy check | `pgrep expo`, `lsof :3001`, `adb devices` | Two Metros up (`:8081` **and** `:8082`), admin portal up on `:3001`, `emulator-5554` device. No competing agent driver. Per the standing rule, **neither Metro was killed**. | ✅ clear |

**Fresh-bundle discriminator (R79-1) — satisfied without a cold reload.** HEAD had moved since the last drive, so a stale bundle was a real risk. Rather than burn a 4-minute cold start, the first Phase-A drive **is** the discriminator: `"Invalid email or password."` is unreachable pre-`a6ce831a` (round-1 code rendered the `default:` arm). It rendered ⇒ **the running client was serving the current HEAD bundle**, behaviourally proven.

---

## Phase A — Verify FIX-Task-26

### Item 1 (wrong-password copy) — ✅ **PASS** (independent re-confirmation)

Real wrong-password login: `test-buyer` + a deliberately wrong password → submit.

- Dialog: title **"Login Failed"**, body **"Invalid email or password."**, single primary **OK**.
- **No leaked identifier** anywhere on the frame: no project ref, no internal Supabase URL, no `cf-ray` / `sb-request-id`, no `__cf_bm` cookie value, no serialized `Response`. Read at full resolution.
- Evidence: `08-A-F1-wrongpw-dialog.png`.
- Dialog type verified empirically (§5.4): it is **AX-instrumentable** (`login-failed-dialog-ok-button`) on Android — a platform difference from the iOS-era note that `ui/Modal` buttons never surface in the tree.

**This closes the prior round's F1-b (MED–HIGH).** Round 1 delivered the friendly copy but left the `INVALID_CREDENTIALS` branch dead for a real wrong password (the SDK emits `400` + `code:'invalid_credentials'`, which fell through to `default:`). Round 2's `SDK_ERROR_CODE_MAP` mapping **works on the real trigger**.

### Item 2 (cart-removal) — ✅ **PASS (success path)**, failure path **NOT attempted by design**

- Cart with 1 item (`302e6ff6`, listing `f8af8667`, $15.00). Tapped the row trash → in-app confirm (`global-alert-button-0/1`, "Remove Item / Are you sure…") → Remove.
- **Persisted on the FIRST attempt**: `cart_items` active **1 → 0** (DB, separate statement per R24).
- UI: item gone, `tab-basket-badge` **removed entirely**, empty state ("Your trade basket is empty" + Browse Items), summary rows gone, and **no `cart-remove-error-card` / `cart-remove-retry-button`** — no false error card.
- Evidence: `12-A-item2-cart-pre-removal.png` ⇄ `13-A-item2-cart-post-removal.png` (the pair is the proof).
- **Failure/rollback path: NOT attempted — unit-test-verified only, QA toggle pending.** Per the brief (and the dev's own on-device finding, `fix-task-26-round2`): airplane mode **cannot** induce a per-request failure here because the app's global `offline-screen` gate replaces the whole surface first, so `cart-remove-error-card` is unobservable. **No attempt was made this session** (per the standing tool rule). The rollback + inline retry (`CartScreen.attemptRemoveItem`) remains **unit-test-only until a `cart_remove_failure` QA toggle exists**.

### Item 3 (copy nit) — ✅ **PASS**

`MyListingsScreen` pill now renders **"My Trades"** (plural). Source: `MyListingsScreen.tsx:426` (`accessibilityLabel="View My Trades"`). Evidence: `11-A-item3-my-listings-header.png`. (Round 1 recorded the singular "My Trade".)

**Phase A conversion: 3 of 3 numbered items verified.**

---

## Phase B — Re-test of the env-confounded finding

### F11 (Item Detail Seller Info block) — ✅ **PASS** — and the prior round's finding is **RETRACTED**

Reproduced on a **confirmed-healthy** backend (DB sub-second, EDGE responsive, cart writes persisting, **0** seller-fetch errors in the logcat, `profiles` row verified present for `seller_id 14be337c`).

**The Seller Info block renders.** It sits **below the fold**, hidden behind the screen's **sticky CTA footer**, and needed **two swipes** to reach:

- "Seller Info" heading, avatar, 🔒 **"Seller Info Hidden"**, **4.5 ★ / 6 reviews**, **"Matches Your Trade Basket"** badge, and the explanatory note "Start a trade to see seller details and contact them."
- Evidence: `14-B-F11-item-detail-top.png` (top viewport — block invisible), `16-B-F11-item-detail-bottom.png` (after scrolling — block fully rendered).

**Why this matters:** the earlier round reported "no Seller Info block at all … neither render branch fired" and hypothesised a null-seller path. **That was a viewport artifact, not a data or render failure.** The first viewport is not the page: the sticky CTA band (`view-cart-button` / `request-to-buy-button`, pinned at y≈1949) occludes the section, and an AX tree only reports **on-screen** elements. The F11 retry-card path (`seller-info-error-card`) is correctly **absent** when the seller read succeeds — as its design intends.

> ⚠️ **This retraction also invalidates the earlier round's "candidate observation"** about a null seller join (`listing.seller_id` absent). `listing.seller_id` was present in the app's own log (`[listing] getListingById fetched item: … seller_id: '14be337c-…'`).

**The genuine F11 gap that remains:** the *failure* half of the fix (a real seller-read failure → `seller-info-error-card` + retry) is still **not live-inducible** — there is no dev toggle for a seller-read failure (confirmed round 1 against the full `devTestingService.ts` toggle key list). That leg stays **unit-test-verified only**.

### B(c) (contact / profile buttons in the AX tree) — ✅ **PASS**

Both controls are present as first-class AX elements **with the correct disabled state**:

| Element | testID | State |
|---|---|---|
| Contact Seller | `contact-seller-button` | **`disabled`** ✅ |
| View Profile | `view-seller-profile-button` | **`disabled`** ✅ |

Both match the on-screen masking copy ("Seller Info Hidden" / "Start a trade to see seller details and contact them.") — i.e. FIX-Task-25 items 3 & 4 hold. `item-detail-matches-cart-badge` also present. `seller-info-error-card` / `seller-info-retry-button` correctly **absent**.

**🟠 NEW FINDING (LOW, layout) — the sticky CTA band clips the Seller Info card's footer note.** The note "Start a trade to see seller details and contact them." measures **797 × 4 px** in the tree at the bottom of the section, i.e. almost entirely occluded by the pinned `view-cart-button` / `request-to-buy-button` band. Visible as a sliver of cut-off text in `16-B-F11-item-detail-bottom.png`. **Fix direction:** give the scroll content bottom padding ≥ the sticky footer's height (or measure the footer and inset the ScrollView), so the last card in every below-fold section clears the band.

---

## Phase C — Bundle-offer chain in one flow

Fixture: `qa:create-bundle-fixture --buyer test-buyer --seller test-seller --count 3` → cart `55ede89f-38e7-4a90-a749-c5f5c5e545e5`, bundle `5b3e9cc3-…`, 3 items ($21 each; **mixed-exemption**: 2× Sports/Toys taxable + 1× **Books** tax-exempt).

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | **F4** cold-open Checkout (no wrong total flash) | 🟡 **PARTIAL** | see below |
| 2 | **F7** status-aware copy after accepting one sibling | ✅ **PASS** | `36-C-post-single-accept.png` |
| 3 | **F8** banner-vs-button counts at 2- **and** 3-item | ✅ **PASS (both stages)** | `35-…-review-offer-3item.png`, `36-…` |
| 4 | **F9** My Trades first-frame tile/list agreement | ✅ **PASS (buyer + seller)** | `24-C-F9-my-trades-first-frame.png`, `33-C-seller-my-trades.png` |
| 5 | **UX1** sibling-accept shortcut | ✅ **PASS** | `36-C-post-single-accept.png` |
| 6 | **F10** My Listings chip + FAB colour | ✅ **PASS** (round 1; re-observed on-brand chips in `11-…`) | `11-A-item3-my-listings-header.png` |
| 7 | **UX2** Needs-Action hint names the action | ✅ **PASS** | `33-C-seller-my-trades.png` |
| 8 | **UX3** Item Detail single fee statement | ✅ **PASS** | `16-B-F11-item-detail-bottom.png` |
| 9 | **F6** Review Offer load timeout / retry | ❌ **NOT REACHED** | no dev toggle exists for an offer-load stall |

### F4 (cold-open Checkout) — 🟡 **PARTIAL**, precise missing leg named

**What was verified (strong):**
- Cold-open of `CartCheckoutScreen` via `bundle-cta-button` from the Trade Basket.
- The resolved money stack is **exact and internally consistent to the cent**: Subtotal **$63.00** + Safety & Platform Fee **$1.49** (one fee per bundle, not ×3) + Sales Tax **$2.94** = Cash Total **$67.43**, and the submit CTA label reads **"Send Offer · $67.43"** — the same number as the summary.
- **DB-closed:** `tax_amount_cents` 147 + 147 + 0 = **294** ✓; `buyer_transaction_fee_cents` 149 on **one** trade only ✓ (one-fee-per-bundle); `trades.taxable_amount_cents` = 0 on the Books item ✓ (`tax_exempt_goods`); 6300 + 149 + 294 = **6743** ✓ — every figure ties to the UI.
- **Tax-label issue resolved:** the checkout label is now plain **"Sales Tax"** (round 1 flagged a blended "Sales Tax (4.67%)" label). The blended arithmetic is correct: 2 taxable items × $21 × 6.99% = $2.9358 → **$2.94**; source comment at `CartCheckoutScreen.tsx:329` documents the mixed-exemption case explicitly and `resolveDisplayTaxRate` handles it.
- **Gating is real in source:** `chargeOneFeePerBundle` is `useState<boolean | null>(null)` (the old `false` default is exactly what produced the "$0.99 → $1.49" first-paint fee), `moneyReady` gates the fee row / cash total (`moneyOrDash` renders `'—'`), the cash-total row is conditional on `moneyReady`, and `send-offer-button` is `disabled={submitting || !moneyReady}`.
- **No wrong number observed in any captured frame.**

**Missing leg (why not PASS):** the **pre-settle transient** was not captured. On this device the ORDER SUMMARY and the submit CTA sit **below the fold at entry**, so the `'—'` / disabled state cannot be photographed before the async fee + tax resolve (the settle completes within one tool round-trip). The assertion "no wrong total flash" is therefore **source-verified + unit-tested + consistent-with-observation, but not visually witnessed**. Naming it rather than trading it for a PASS (R13).

### F7 — ✅ **PASS** (real trigger driven)

Flow: bundle offer sent (3 trades, all `pending`) → seller opened Review Offer → **"Accept Trade"** (single) → confirm (`accept-trade-confirm-button`) → **DB: only `c9799204` → `in_progress`; the other two stayed `pending`**.

The re-rendered Review Offer screen shows **status-aware copy**:
> "You accepted this offer — the trade is now in progress."

**Not** the old hard-coded else-arm *"This offer has expired and can no longer be accepted."* The pre-accept baseline correctly showed a live **"47h 51m left"** countdown. Evidence: `35-…` (baseline) and `36-C-post-single-accept.png` (post-accept).

### F8 — ✅ **PASS at both stages** (banner ⇄ button count agreement)

| Stage | Context banner | Companion count | Agree? |
|---|---|---|---|
| **3 items** | `bundle-context-banner` "Bundle offer · **3** items" | `accept-bundle-button` label "Accept all **3** items" | ✅ |
| **2 items** (1 accepted) | "Bundle offer · **2** items" **+ new sub-line "1 already accepted"** | in-place action "Accept the other **2** items" | ✅ |

The FIX-Task-26 sub-line ("N already accepted") and the shared pending-only count both behave. Note the Trade-List bundle card exposes `Review Each` / `Accept All` / `Decline All` (no count in the label) — the counted label lives on the Review Offer screen, so **F8 must be scored on the Review Offer surface**.

### F9 — ✅ **PASS** (first-frame agreement, both roles)

- **Buyer:** tiles **3** Your Offers / 0 In Progress / 0 Needs Action / **36** Completed; list showed exactly one "Bundle Offer · 3 items" card. DB: `pending` 3 ✓, `in_progress` 0 ✓.
- **Seller:** tiles 0 / 0 / **4** Needs Action / 38 Completed; list showed 1 single offer + one bundle-of-3 = **4** trades ✓ — exact.
- **R100 reconciliation (do not mis-file):** the Completed tile reads **36** while `status='completed'` counts **41**. The gap is **fully explained and by design**: `buyer_marked_completed_at` **32** + `auto_completed_at` **4** = **36**. The tile is the buyer-completion definition, not raw row status. Recorded here so a future round does not file it as an under-count.

### UX1 — ✅ **PASS**

The sibling-accept shortcut renders as a working link — **"Accept the other 2 items"** — after one sibling is accepted, correctly targeting the remaining pending siblings (`review-other-siblings-link`; `requestTradesRefresh()` fires after accept).

### UX2 — ✅ **PASS** (positive case, seller side)

Needs-Action tile sub-line reads **"4 offers to review"** — the hint **names the action**, not a generic "Waiting on you".

### UX3 — ✅ **PASS**, F6 — ❌ not reached

Item Detail presents the price breakdown as the single money statement (Item Price $21.00 / Safety & Platform Fee $1.49 / Sales Tax $1.47 / Total **$23.96**) with no second fee figure — the savings note is prose-only. **F6's 20-second load-timeout + retry state is not live-inducible** (no offer-load-stall toggle exists), so it was not attempted.

### 🔎 Incidental coverage (zero setup cost)
- **Bundle CTA:** `bundle-cta-button` ("Make one offer for these 3 items" / "All items from this seller") renders for a same-seller multi-item cart (S07-class).
- **Disclaimer gate:** the Amazon liability disclaimer modal is **correctly gated** — `disclaimer-modal-accept-button` is `disabled` until `disclaimer-modal-checkbox` is ticked (verified both states). *(Its **content** stays owner-excluded; only the gate mechanics were exercised, as the purchase could not proceed without it.)*
- **Post-checkout cart consumption:** after checkout the `cart_items` rows leave `cart_status='active'` (the cart is consumed) — consistent with a new `CART_ACTIVE_LIMIT` guard firing on the next fixture attempt.

---

## Phase D — N2's mutation-bearing legs

### N2-C01 — ✅ **PASS (live)** — the retry leg is no longer missing

Disposable fixture: orphaned `$27` listing `344d3761-…` (test-seller) + test-buyer's saved card `pm_1UEzkz4I6…`. Driven through the sanctioned harness `npm run qa:ef-repro -- --ef create-trade-offer --body '{…}'`.

| Call | Body | Result |
|---|---|---|
| 1 | `{item_id, cash_amount_cents:2700, sp_amount:0, payment_method_id, submission_nonce:"qa-c01-nonce-fixed-1"}` | HTTP **200**, `trade_id 1f3ec04d-…`, `status pending` |
| 2 | **byte-identical** | HTTP **409** `DUPLICATE_OFFER` — "You already have an active offer on this item" |

DB read-back (separate statement, R24): `trades_on_listing` **1**, `distinct_pis` **1**, and exactly **1** audit row per key — `offer_1f3ec04d…` = 1, `pi_1f3ec04d…` = 1, `tax_quoted_1f3ec04d…` = 1.

⇒ **No second PaymentIntent, no second trade, no partial write.** The mechanism is source-confirmed: `piKey = pi_offer_<buyer>_<item>_<submissionNonce>_<hashContent(…)>` with `submission_nonce` reused across retries of the same attempt. **SP-reservation limb N/A by state** (`sp_amount` 0 → no reservation).

> **Deviation worth recording (C09-adjacent):** the guide's N2 wording expects a replayed duplicate to **return the prior result**. The implementation instead **rejects** the replay with a structured `409 DUPLICATE_OFFER`. The durable assertion (no duplicate / no partial write) holds; only the *replay* semantics differ from the guide's phrasing — an **observed spec-vs-implementation deviation**, not a defect (the guard is safer than a silent replay).

### Not reached in Phase D
**C02** (double `initiate-payout`), **C03** (re-delivered `charge.refunded`), **C04/C05** (`rpc_release_pending_sp` / SP debit-credit retries), **C06** (admin SP adjustment double-click), **C09** (duplicate-key replay semantics) — all still owed. A mid-session `Gateway Timeout` degradation (§ Environment) plus budget made C01 the deliberate single target; the fixture it created is disposable and reusable.

---

## Phase E — Remainder — ❌ **NOT REACHED**

**Group N remainder (N05/N08/N11–N13) · T03/T12–T14 (low-SP persona) · remaining S (S03/S06/S08–S13/S15/S16/S18/S19/S22–S24) · remaining M (M05/M06/M14/M15/M19/M20) · remaining V/X/Y (V03/V04/V08/V12–V14; X01/X02/X08; Y02/Y03/Y05–Y08) — none executed.**

The session's budget went to the FIX-Task-26 verification, the Phase-B retraction, the bundle chain, and N2-C01. **T03's low-SP persona fixture was not built** (still owed: test-buyer holds 459 SP against per-item caps of 8–15).

---

## Findings

| ID | Sev | Class | Summary |
|---|---|---|---|
| **F1** | ✅ closed | fix verification | FIX-Task-26 round 2's wrong-password classifier works on the real trigger — guides copy "Invalid email or password.", no identifier leak. Prior round's F1-b (MED–HIGH) **CLOSED**. |
| **F2** | 🟠 LOW | layout | **Sticky CTA band clips below-fold content.** Item Detail's Seller Info footer note renders 797 × **4** px under the pinned `view-cart-button`/`request-to-buy-button` band. Add scroll-content bottom padding ≥ footer height. |
| **F3** | 🟠 MED (throughput) | agent enabler | **`qa-login-as?persona=test-seller` fails with "User profile not found"** although the profile row is intact (`profiles.id = profiles.user_id = 14be337c…`, name "Test Seller") and the auth user exists. Attempt 1 logged the failure; the retry produced no log line; the persona **did** eventually take after a force-stop + cold relaunch (spinner/wedge in between). Cost ≈ a full persona round-trip + a cold start. Root cause NOT established (bounded per R97) — the handler's profile read looks like it runs against a session that is not yet established. **Ask:** make the handler retry/await the session before reading the profile, and log the raw cause. |
| **F4** | ℹ️ observation | data | **`disclaimer_acknowledged` is stamped on only 1 of the 3 trades** of a bundle purchase (the first-created one, `0a86f094`; `true` there, `false` on the other two). Same pattern as the bundle-level fee (`buyer_transaction_fee_cents` 149 on one row only), so it is *probably* deliberate bundle-level stamping — but **not verified as such**; the writer was not read. Flagged as an observation, **not** a defect. |
| **F5** | ℹ️ observation | doc | The guide's N2 duplicate-key wording ("returns the prior result") does not match the EF's `409 DUPLICATE_OFFER` rejection. Durable behaviour is correct; score the guide against the body, not the phrasing. |
| **F6** | ℹ️ fact | harness | `qa:create-bundle-fixture` **fails with `CART_ACTIVE_LIMIT: user already has an active cart`** when the buyer already holds one — and **leaves its created `items` rows behind as orphans** (3 per failed attempt). Clear the cart first; the orphans are reusable as free disposable listings. |

### Retracted from the previous round
- **"Item Detail Seller Info block is absent on a healthy backend" → RETRACTED.** It renders; it was below the fold behind the sticky footer. The accompanying null-seller hypothesis is also retracted (the app's own log shows `seller_id` present).

---

## Environment & tooling observations

1. **`Gateway Timeout` degradation recurred mid-session** (the R102 signature). Seen three times on the app's own console: `[chat.getTotalUnreadMessageCount] Error counting unread for trade … Gateway Timeout` (×2) and a LogBox `[listing] getListingSummary error: Gateway Timeout` (`listing.ts:1531`). **Differentiated from round 1:** this was a **degraded RPC/gateway leg, not a backend outage** — direct SQL stayed **sub-second on every query** through the whole window, and `qa:ef-repro`'s EF calls (JWT exchange + POST) completed normally at the same time. Consequence: the `Trade Timeline` screen wedged on **"Loading trade…"**, which is an **environment artifact, not an app defect** (BLOCKED-class). Bounded per R102; no endpoint was retried more than twice.
2. **Dev-client bundle-load wedge reproduced** (the prior session's blocker). After `force-stop` + cold launch the client sat on **"Loading from 10.0.2.2:8082…"** indefinitely while that Metro was **idle (0.1 % CPU, 5h12m uptime)** — i.e. the request was never being served. **New recovery fact:** force-stopping and cold-launching again, then choosing the **other** dev-server row (`10.0.2.2:8081`), loaded the bundle successfully. Recorded as an environment blocker with its workaround.
3. **AX coordinates are 1:1 with screenshot pixels on this Android build — including with the IME up.** Two taps were lost this session to **visual y-estimates** read off the rendered image (both landed one element off: the wrong-password text went into the email field; "Review Each" missed by ~340 px). In **both** cases the tree was correct and the layout did **not** shift for the IME. Standing technique: derive tap coordinates from the **tree**, and treat a tree-vs-screenshot discrepancy as *my estimate being wrong*, not the tree being stale (§5.9 applies when the tree is **proven** stale — two identical re-lists across a known transition).
4. **Field clearing:** `adb shell input keycombination 113 29` (CTRL+A) + `adb shell input text '<value>'` reliably replaced a corrupted/valid-but-wrong value in **both** the email and the password field — and avoids the IME entirely (so no keyboard gate needed for those edits).
5. **Sheet/`GlobalAlertProvider` dialogs and `ui/Modal`-class dialogs are all AX-instrumentable on this build**: `login-failed-dialog-ok-button`, `global-alert-button-0/1`, `accept-trade-cancel-button`/`accept-trade-confirm-button`, `offer-accepted-ok-button`, `disclaimer-modal-checkbox`/`disclaimer-modal-close-button`, `disclaimer-modal-cancel-button`/`disclaimer-modal-accept-button`. No pixel-scan was needed anywhere this run.
6. **`qa:ax-tree` did not parse the chat-session-resource capture** (`0 match(es)`; it flattened only 21 elements), and the captured-file shape differs by list format (`format=json` ⇒ `identifier`/`coordinates` objects; default ⇒ text lines `@eN Button label="…" id="…" at=x,y size=WxH`). Targeted `grep` of the **text-format** capture was the reliable path — **note the format when saving it**, since a JSON-key grep silently returns nothing against a text capture (cost 3 calls this round).
7. **New seller/bundle instrumentation discovered (useful for future rounds):** `trade-bundle-<bundleId>-review-each` / `-accept-all` / `-decline-all`, `trade-offer-row-<tradeId>` and `trade-offer-row-<tradeId>-review`, `bundle-context-banner`, `accept-bundle-button`, `accept-trade-button`, `decline-trade-button`, `offer-countdown-pill`, `review-bundle-toggle`, `payout-breakdown`, `offer-accepted-ok-button`.
8. **Documented-by-design behaviour confirmed:** after a single accept the app navigates to **My Listings** (`ReviewOfferScreen` L265/299/332), and the Trade List bundle card offers `Review Each` / `Accept All` / `Decline All` without a count.
9. **Fixture id mapping:** `cart-item-open-<id>` / `cart-item-remove-<id>` use the **`cart_items.id`**, while `qa:create-bundle-fixture` reports the **`items.id`s** — they differ; do not cross-reference them by eye.

---

## Perceived load times (§5.7)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login (tap `landing-login-button`) | < 1 s | — |
| Login → Home (valid submit) | ~1–2 s | — |
| Landing → Login; Basket → Item Detail; Trades → My Trades | < 1 s each | — |
| Checkout → offer submitted (Send Offer → "Trade Initiated!") | ~1–2 s | — |
| Cold dev-client start → Dev Launcher | 17.9 s (first), 2.5 s (second) | dev-harness |
| Bundle load → loaded Home | **never completed on `:8082`**; succeeded on `:8081` | **environment artifact** (see Environment #2), not an app-behaviour finding |
| Trade Timeline load | **stalled indefinitely** during the `Gateway Timeout` window | **environment artifact** (see Environment #1) |

All measurements are **perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.**

---

## Verdict summary

| Block | Result |
|---|---|
| Phase 0 (clean boot + health) | ✅ client live; DB sub-second; fresh-bundle discriminator satisfied |
| **Phase A** | **3/3 PASS** — item 1 copy ✅, item 2 success path ✅ (failure path unit-test-only, toggle pending), item 3 copy ✅ |
| **Phase B** | F11 ✅ PASS (**prior finding RETRACTED**) · B(c) ✅ PASS (both buttons present + correctly disabled) · 1 new LOW layout finding |
| **Phase C** | F7 ✅ · F8 ✅ (2- and 3-item) · F9 ✅ (both roles) · UX1 ✅ · UX2 ✅ · UX3 ✅ · F10 ✅ · **F4 🟡 PARTIAL** · F6 ❌ not reached |
| **Phase D** | **N2-C01 ✅ PASS (live)** + C09-adjacent replay-semantics observation · C02/C03/C04/C05/C06/C09 ❌ not reached |
| **Phase E** | ❌ **NOT STARTED** — N remainder, T03/T12–T14, S, M, V/X/Y all owed |

**No FAIL verdicts were filed this round.** One MED throughput finding (F3, `qa-login-as`), one LOW layout finding (F2), two bounded observations, one retraction.

**Session stopped at:** end of Phase D's first leg (N2-C01), after the recurring `Gateway Timeout` degradation put a LogBox overlay over the Trades screen.

---

## What needs to be fixed next

1. **F3 (MED, agent-enabler) — `qa-login-as` persona login can fail with "User profile not found" for a fully-provisioned persona, and can leave the client wedged.** Await/retry the session before the profile read and log the raw cause; a failed persona switch currently costs a full round-trip plus a force-stop + cold start.
2. **F2 (LOW, layout) — sticky CTA footer occludes below-fold content.** Item Detail's Seller Info footer note renders 4 px tall under the band. Add scroll-content bottom padding ≥ the footer height (same class of fix applies to any screen with a pinned CTA).
3. **F4 (observation, needs a writer check) — `disclaimer_acknowledged` stamped on 1 of 3 bundle trades.** If the acknowledgement is meant to be per-trade, 2 of 3 trades lack it; if bundle-level by design, document it. Verify the writer before actioning.
4. **`cart_remove_failure` QA toggle (still owed from round 1).** Without it the X11-b rollback + inline-retry path stays unit-test-verified only, and the brief's own exclusion says so explicitly.

---

## Suggested next session

1. Re-run the Phase-0 boot check; if the client wedges on the bundle load, **switch to the other dev-server row in the Dev Launcher** before concluding the client is broken (new workaround).
2. **Phase E, in the brief's order** — it is the entire remaining scope: **Group N remainder (N05/N08/N11–N13)**, then build the **T03 low-SP persona** (test-buyer's 459 SP is far above the 8–15 per-item caps), then **S (S03/S06/S08–S13/S15/S16/S18/S19/S22–S24)**, **M (M05/M06/M14/M15/M19/M20)**, **V/X/Y (V03/V04/V08/V12–V14; X01/X02/X08; Y02/Y03/Y05–Y08)**.
3. **Finish Phase D's remaining limbs** on a disposable fixture — C02 (double `initiate-payout`), C03 (re-delivered `charge.refunded`), C04/C05 (SP release/debit retries), C06 (admin SP adjustment), C09 (duplicate-key replay). N2-C01's method (fixed `submission_nonce` + byte-identical replay + separate-statement DB read-back) generalises directly.
4. **F6** stays blocked until an offer-load-stall toggle exists.

---

## Suggested to improve agent rules

- **New rule candidate — "the bottom of a screen is not the bottom of the page; a sticky CTA footer makes below-fold sections look absent."** An AX tree reports only **on-screen** elements, and a pinned CTA band can fully occlude the last section of a scrollable screen. This round's Phase B retraction (a whole "the Seller Info block is deleted" finding, plus a null-seller hypothesis, both dead) is exactly this failure. **Before concluding any section is missing, scroll to the TRUE bottom and confirm the last element's position, and prefer a *data*+*source* corroboration (§6.1 two-source) over a single viewport read.** Extends §5.9 (screenshot as truth when the tree is stale) — here the tree was **not** stale, just **viewport-limited**.
- **Rule candidate 2 — "when the tree and a hand-read screenshot disagree on a coordinate, the tree wins unless the tree is *proven* stale."** Two taps were lost this session to visual y-estimates (~340 px off in one case) while the tree was 1:1 accurate **even with the IME up** on Android. This refines §5.19 Rule 1's Android addendum: the IME-blindness applies to *IME nodes*, **not** to content coordinates on this build — the content did not shift. Blind-retrying at a "nearby" offset is exactly what §5.1 forbids; the cheap fix is a tree read, not another estimate.
- **Rule candidate 3 — "record the AX-capture FORMAT with the file."** `format=json` and the default text format expose **different key shapes** (`identifier`/`coordinates` objects vs `@eN Button label="…" at=x,y size=WxH`). A JSON-key grep against a text capture returns **nothing** and reads as "the element isn't there" (3 calls lost). Extends the §5.1 AX-tree-resource guidance.

---

## 📋 QA Session Handoff

See the final chat message / appending block below (emitted verbatim per §8.4).
