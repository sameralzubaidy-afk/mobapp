# QA Run — Group N + N2 + T03/S/M remainder + V/X/Y leftovers — **BLOCKED by staging outage**

**Run folder:** `e2e-test-results/qa-groupn-n2-phase0-2026-09-13/`
**Date:** 2026-09-13
**HEAD:** `5aad09d7` (working tree clean apart from this run folder)
**Platform driven:** Android `Medium_Phone_API_36.1` (emulator-5554), app `com.sameralzubaidi.p2pmarketplace`, Metro `:8081`
**iOS:** `iPhone 17 Pro Max` booted, **NOT driven** — iOS carries no verdict this round (R80 disclosure)
**Admin portal:** up on `:3001` — **not reached** (no session ever established)
**DB:** Supabase staging `drntwgporzabmxdqykrp` — intermittently unreachable (see F2)

---

## 0. Headline — Phase 0 (the priority) result

**FIX-Task-25's mobile fixes are REAL on-device: items (a), (b) and (d) all PASS. The two stale-screen bugs ARE fixed, the pending-only "Accept all N" count IS fixed, and the status-banner countdown IS rendered as a sub-line.**

Per-item, stated unambiguously as the brief demands:

| Item | Verdict | One-line proof |
|---|---|---|
| **(a)** Confirm-All-N → My Trades auto-refresh (was F1) | ✅ **PASS** | After Confirm-All-N the list self-updated to **0 / 0 / 0 / 42 Completed** with the 3 new rows, **with no `qa-refresh` and no pull-to-refresh**. The frozen "IN PROGRESS · N items" card is gone. |
| **(b)** Review Offer state reset (was F2) | ✅ **PASS** | Re-entry after accepting one sibling showed **"Accept All 2 Items"** (pending-only) and the modal read **"Accept all 2 items?"** — the accepted trade was no longer actionable. |
| **(c)** Item Detail seller buttons | 🟡 **BLOCKED (environment)** | The whole Seller Info block is gated on `{listing.seller && …}`; on-device it did not render while staging was returning `Gateway Timeout`. Not an app-behaviour verdict. |
| **(d)** Status-banner countdown sub-line | ✅ **PASS** | Banner renders **"In Progress / Auto-completes in 71h 57m"** as a sub-line inside the banner. |
| **(e)** More From This Seller → Basket | 🟡 **BLOCKED (environment)** | The CTA lives inside the same `listing.seller`-gated block as (c), which did not render. |

**So no (a)–(e) regression was found.** The round's headline *new* finding is instead **F7 — the Review Offer screen tells the seller a just-accepted offer has "expired"**, plus a HIGH copy/security defect on the login-failure path (F1) and a confirmed staging outage (F2) that cost roughly 40 calls before it cleared.

---

## 1. Environment blocker (F2) — why the run stopped

The staging project `drntwgporzabmxdqykrp` was **degraded for the whole session window**, in three independent, mutually-corroborating ways:

| # | Symptom | Evidence |
|---|---|---|
| 1 | `POST /auth/v1/token?grant_type=password` → **HTTP 504**, 5× consecutive over ~13 min | `[QaLoginAsDeepLink] Login-as test-seller failed: {"status":504,…}` (×4) + the in-app "Login Failed" dialog (`x-envoy-attempt-count: 4`) |
| 2 | **Postgres statement timeout** `57014` on the app's own cart query | dev LogBox `[cartService.getCartItems] {"code":"57014",…}` |
| 3 | **DB connection timeout** on direct SQL | `Connection terminated due to connection timeout` (×2, then recovered) |

Notes:
- The Supabase **edge is healthy** — an unauthenticated POST to the same token endpoint returned `401` in **0.12 s**; the DB probe returned normally once (`903` trades). The failure is in the **upstream auth/DB** leg, not the network or the app.
- The **fixture harness hit the same outage**: `npm run qa:create-bundle-fixture` failed `❌ Failed to create item 1: Gateway Timeout` on the first attempt and succeeded on retry.
- Consequence: the outage **delayed but ultimately did not block** Phase 0 — staging auth and the DB recovered mid-session (a UI login succeeded at ~10:34 and the DB answered normally thereafter), which is how (a), (b) and (d) were driven. It cost roughly 40 tool calls and permanently blocked the SQL-driven Group N2 path attempted inside the outage window.
- **Diagnostic lesson worth keeping:** the app's own log line (`[QaLoginAsDeepLink] Login-as test-seller failed: {"status":504,…,"url":"…/auth/v1/token?grant_type=password"}`) was the decisive evidence — it named the exact failing endpoint and proved the fault was server-side, not app-side. Check the client's own error before theorising about the app.

---

## 2. Phase 0 — FIX-Task-25 on-device verification (discharged for (a), (b), (d))

Fixture built before the outage degraded: cart `15b77972-2c14-44ef-a917-1b062da533b9`, bundle `92c0eb24-…`, 3 items (`0b13fda1…`, `5196045f…`, `5c9f5d4a…`), all owned by `test-seller`.

**Verified working on-device (pre-outage):** basket shows 3 grouped items + `bundle-cta-button`; bundle checkout renders `bundle-checkout-banner` = **"📦 Combined Offer"** + "You're making a single offer for all 3 items from this seller."; per-item `sp-input-*` with correct caps ("You can use up to 8/12/11 SP", "Limited by this item's category"); order summary $48.00 + $1.49 + $2.24 tax = **$51.73**; disclaimer modal AX-exposed and gate-correct (`disclaimer-modal-accept-button` **disabled** until the checkbox is ticked); offer submitted → **"Trade Initiated!"**; Trades badge = 3.
**DB read-back (R24, separate statement):** exactly **3** trades, all `pending`, all sharing `bundle_id = 15b77972-…` (the **cart id**, per the documented convention), `tax_amount_cents` 112 + 112 + 0 = **224** = the $2.24 the UI showed. ✅

**(a) — ✅ PASS.** Full driven chain: seller accepted all 3 siblings (one individually, then the remaining 2) → all 3 `in_progress` (DB) → buyer opened the bundle timeline → **"I Got It — Complete Trade"** → **"Confirm all 3 items received?"** (`confirm-all-trades-button` = "Confirm All 3") → **"Done! All 3 items marked as completed."** → tapped the Trades tab **without any manual refresh** → tiles read **0 Your Offers / 0 In Progress / 0 Needs Action / 42 Completed** and RECENTLY COMPLETED listed the 3 new rows with "Bought" badges. DB cross-check: all 3 `completed`, `completed_at` 14:39:41.98 / :43.02 / :44.57, `sp_transferred_at` stamped. **R13 caveat:** tapping the Trades tab focuses the already-mounted list, so a focus-triggered refetch cannot be fully excluded as an additional mechanism — but the F1 symptom (frozen card + stale counts needing a manual refresh) is gone.

**(b) — ✅ PASS.** Buyer submitted a 3-item bundle offer → seller opened **Review Each** → **"Bundle offer · 3 items"** banner + **"Accept All 3 Items"** + a separate **"Accept Trade"**. Tapped the **individual** accept → confirm modal → **"Offer Accepted! Payment authorized. Trade is now in progress."** → DB: exactly **one** sibling advanced (`2e7b3fb5` → `in_progress`), the other two stayed `pending` ✅. Returned to Review Each on a still-pending sibling: **"Accept All 2 Items"** and the modal **"Accept all 2 items?"** ✅ — the fix's pending-only count is live. The accepted trade was no longer actionable.

**(c) — 🟡 BLOCKED (environment).** Target item chosen by DB precondition: `f24968b7-5dde-4648-aa2d-d3682183185a` ("QA First-Trade Fixture", $25.00, test-seller, **0 trades** with test-buyer). Item Detail rendered correctly (title, price, specifics, SP banner, price breakdown $25.00 + $1.49 + $1.75 tax = $28.24, Add / Request to Buy) but the **entire Seller Info section was absent**, so `contact-seller-button` / `view-seller-profile-button` could not be observed. Source root cause: `ItemDetailScreen.tsx:838` wraps the whole block in `{listing.seller && (…)}`, so a failed seller join removes the card **and** the disabled-state buttons **and** the "More from this seller" CTA — silently, with no error or skeleton. The session's LogBox was concurrently reporting `[cartService.getCartItems] {"message":"Gateway Timeout"}`. **The fix's code is present and correct in source** (`disabled={!hasActiveTrade}` + `testID` + `accessibilityState` at L914-937); only the on-device leg is missing.

**(d) — ✅ PASS.** Trade Timeline status banner renders `In Progress` with the live sub-line **`Auto-completes in 71h 57m`**, and the bottom card agrees ("Confirm pickup — auto-completes in 71h 57m"). Post-completion the banner correctly collapses to plain **"Completed"** with no countdown.

**(e) — 🟡 BLOCKED (environment).** Same gating as (c): the `more-from-seller` CTA (`sellerOtherMinPrice` / "From $X · add more to bundle into one trade") sits inside the `listing.seller`-gated block that never rendered this session.

**⚠️ Retraction on the earlier (b) suspicion:** during the outage I suspected `ReviewOfferScreen.fetchOffer`'s early `if (!session?.user?.id) return;` (which leaves `loading === true` forever) was stranding the screen. Once staging recovered the same screen loaded correctly on the first try, so **the outage was the cause**. The early-return hazard remains a genuine code smell (F6) but is **not** a proven defect — keep it as an observation.

---

## 3. Phase 0 — newly-identified cases (X11 / X12 / X14) + X16 regression

| TC | Verdict | Evidence |
|---|---|---|
| **TRD-TC-X14** — "Me" tab removal / no orphaned routes | ✅ **PASS** | Repo-wide search of `p2p-kids-marketplace/src/**` for `MeTab` / `tab-me` → **0 hits** (only incidental strings: "Show me how", "Verify Me Now", `HomeTabNavigator`, "Yes, Add me to the waitlist"). Live AX tree of the bottom nav exposes exactly `tab-home`, `tab-discover`, `tab-sell`, `tab-trades`, `tab-basket` — **no `tab-me`**, no `MeTab` route. |
| **TRD-TC-X11** — Cart badge decreases on item removal | 🟡 **NOT REACHED** | The 3-item cart state (badge `3`, matching 3 `cart-item-*` rows) was observed pre-checkout, but the cart was consumed by the bundle checkout before a removal could be driven, and re-seeding a cart afterwards was not reached. |
| **TRD-TC-X12** — Cart badge clears when emptied | ✅ **PASS** | Basket badge `3` (`tab-basket-badge` text "3") while the cart held 3 items; after the cart emptied at checkout the `tab-basket-badge` element is **absent** on every subsequent screen (Discover / Trades / Item Detail). Path note: the cart emptied via **checkout**, not via "Clear Cart" — the assertion (badge clears at 0 items) is satisfied, the specific clear-affordance path was not driven. |
| **TRD-TC-X16** — flow-registry entries updated | ❌ **FAIL (doc-drift / regression)** | Neither expected smoke item exists in `docs/flow-registry.md`: there is **no "smoke" list anywhere** in FLOW-00 (only *Description / Steps / Mobile screens / Functions-features / References*), the string `bottom nav renders identically on 100% of screens` is **absent**, and FLOW-07 contains **no persistent Cart tab badge** reference (only "a fixed bottom-sheet bundle CTA (clear of the pill nav)"). The tracker records X16 as PASS on **2026-08-31**; the registry was restructured on **2026-09-06** (`flow-registry-consolidation-2026-09-06`), which is the likely regression point. |

---

## 4. Phases 1–3 — NOT reached (explicit per-case accounting, R40)

A realistic budget was spent recovering from the outage and then driving Phase 0 end-to-end (create fixture → bundle checkout → offer → individual accept → bundle accept → Confirm-All-N → verification), which is the owner's stated priority. Phases 1–3 were **not started**. Per R40 these are named individually rather than waved at:

**Phase 1a — Group N remainder (0 executed):** `TRD-TC-N05`, `TRD-TC-N08`, `TRD-TC-N11`, `TRD-TC-N12`, `TRD-TC-N13`.
**Phase 1b — Group N2, all 10 (0 executed):** `TRD-TC-N2-C01` … `TRD-TC-N2-C10`. This is the round's biggest miss — the block is explicitly server-side and the plan was to drive it over SQL; the outage hit the SQL probe (`Connection terminated due to connection timeout`) and the surviving window went to Phase 0.
**Phase 2 (0 executed):** `TRD-TC-T03` (still needs the low-SP persona: test-buyer's wallet is **459 SP** while every item's per-category cap is 8–12, so "Limited by your SP balance" cannot fire — confirmed live via `sp-remaining-*` = "Points remaining: 459" and `sp-max-hint-*` = "Limited by this item's category"), `TRD-TC-T12`, `T13`, `T14`; `TRD-TC-S03`, `S06`, `S08`, `S09`, `S10`, `S11`, `S12`, `S13`, `S15`, `S16`, `S18`, `S19`, `S22`, `S23`, `S24` (incl. the specifically-flagged **S08** single-item bundle-CTA-hidden transition — the cart did pass through a 1-item state at checkout but was consumed before the Basket's 1-item frame could be captured); `TRD-TC-M05`, `M06`, `M14`, `M15`, `M19`, `M20`.
**Phase 3 (0 executed):** `TRD-TC-V03`, `V04`, `V08`, `V12`, `V13`, `V14`; `TRD-TC-X01`, `X02`, `X08`; `TRD-TC-Y02`, `Y03`, `Y05`, `Y06`, `Y07`, `Y08`. (X11 partially observed, X12 PASS, X14 PASS, X16 FAIL — see §3.)

**Incidental coverage gained free this round (not scored as verdicts, but reusable):** V10 (bundle CTA reads "Make one offer for these 3 items" / "All items from this seller" — no "Bundle"), V11 (`bundle-checkout-banner` = "📦 Combined Offer"), T01 (SP input on Accept-SP items; the fixture had no cash-only item to contrast), X10 (badge `3` for 3 items), S07 (bundle CTA present at 2+ same-seller items), Y09 ("What to do next" card with the numbered 1/2 step list), and the trade-success copy.

Per R80 this is a **platform-specific no-verdict set**: every case listed above carries **no Android verdict** from this round — it must not be read as closure, and (unlike the prior round) none of them are "never run" rows either; they are re-verification rows still owing a leg.

## 4b. Group N2 — feasibility note for the next session

Group N2 is genuinely SQL/EF-drivable and should not need the UI. Concretely:
- `rpc_release_pending_sp`, `debit_sp_for_trade`, `credit_sp_for_cancelled_trade`, `fn_log_financial_audit` and the admin SP-adjustment RPC can all be called directly with the service role (`SELECT public.<fn>(…)`), which is how the C04/C05/C06/C09 legs were verified in the 2026-09-09 round.
- `TRD-TC-N2-C08` (RLS insert-only) is answerable from `pg_policies`/`information_schema` plus one role-scoped probe.
- `TRD-TC-N2-C10` (reconciliation) is a pure read-back and can reuse any completed+refunded trade.
- Only the EF-retry legs (`C01`/`C02`/`C03`/`C07`) need a JWT, which needs auth healthy.
- ⚠️ Re-check the function signatures **first** (`pg_proc` + `pg_get_function_arguments`) — the earlier attempt died on the outage before it could; several of these RPCs take positional args and a wrong call is a wasted round trip.

---

## 5. Findings

### F1 — 🔴 HIGH (copy + information disclosure): the login-failure dialog dumps a raw serialized `Response` object
**Surface:** `Login` → "Login Failed" modal (reproduced **2×**).
**Observed:** the entire dialog body is the raw object:
```
{"type":"default","status":504,"ok":false,"statusText":"","headers":{"map":{"alt-svc":"h3=\":443\"; ma=86400","cf-cache-status":"DYNAMIC","cf-ray":"a3a7a27abc4e9aaa-BOS","content-length":"24","content-type":"text/plain","date":"...","sb-gateway-version":"2","sb-project-ref":"drntwgporzabmxdqykrp","sb-request-id":"01a09b0a-...","server":"cloudflare","set-cookie":"__cf_bm=ZgK2M7lmZGJ27Y7WdW53Z.PQ3UpgcjIfsEU5eGdlkM-...; HttpOnly; SameSite=None; Secure; Path=/; Domain=supabase.co", ...},"url":"https://drntwgporzabmxdqykrp.supabase.co/auth/v1/token?grant_type=password","bodyUsed":false,"_bodyInit":{...},"_bodyBlob":{...}}
```
**Why it matters (three separate failures in one surface):**
1. **Copy (§6.3):** a parent sees a wall of developer JSON instead of "Something went wrong. Please try again." — the textbook raw-developer-string leak.
2. **Information disclosure:** it exposes the **staging project ref**, internal Supabase URLs, Cloudflare ray/request IDs — and a **live `__cf_bm` session cookie value**, rendered into the UI (and reachable via any screenshot/screen-share).
3. **Contract:** the error path appears to stringify the whole `Response`/fetch error rather than mapping `error.message` to friendly copy — the same class flagged for `r.error.message` leaks in §6.3.
**Proposed fix:** in the login error path, never render the raw error object; map to friendly copy (e.g. *"We couldn't sign you in right now. Please check your connection and try again."*) and log the technical detail to `errorReporter` only. Strip `set-cookie`/headers from anything surfaced.
**Evidence:** `screenshots/P0-36-post-logbox-dismiss.png`, `screenshots/P0-41-login-attempt4.png`.

### F2 — 🔴 HIGH (environment, not product): staging platform outage
See §1. Blocks all execution. Recommend the owner re-run this scope once staging auth + DB are stable.

### F3 — 🟡 LOW (doc-drift): nav testID list in TRD-TC-X01
The guide's expected testIDs are `tab-home, tab-discover, tab-sell, tab-trades, **tab-trade-basket**`. The shipped, live AX tree exposes **`tab-basket`**. The *label* assertion ("Basket") is correct; only the testID in the guide is stale.

### F4 — 🟡 LOW–MED (transient wrong price render on Checkout)
The bundle Checkout screen rendered **`Safety & Platform Fee $0.99` / `Cash Total $51.23`** (and hid the tax amount) on its first paint, then settled to **`$1.49` / `$2.24 tax` / `$51.73`** once config loaded. A buyer briefly sees a **wrong cash total** on a money screen. Needs a dev decision on whether those are placeholder defaults or a genuinely different fee basis. Evidence: the two AX-tree captures + `P0-02/P0-03` (loading) → `P0-04` (settled).

### F5 — 🟢 INFO (dev-only, NOT a defect): persistent "Startup / no active session" HUD
A dark box labelled **"Startup"** with the sub-line **"no active session"** overlays the header on every screen. Root-caused: `src/components/StartupDebugOverlay.tsx`, mounted **only under `__DEV__`** in `App.tsx:17`, `pointerEvents="none"`. The sub-line is stale because the component reads `getStartupStep()` once per render and the warm `qa-login-as` switch never re-runs the startup path. **Dev-build diagnostic noise — not a product finding, and it does not intercept taps.**

### F6 — ⚪ INFO (code observation, unconfirmed): `ReviewOfferScreen.fetchOffer` early return never clears `loading`
`ReviewOfferScreen.tsx` `fetchOffer()` opens with `if (!session?.user?.id) return;` **before** any `setLoading(false)`; the `finally { setLoading(false) }` is only reachable after that guard. A focus-effect firing before the session is ready therefore strands the screen on "Loading offer…" forever. **Not proven to have caused this round's stall** (the outage did — see the retraction in §2) — flagged for a dev look, not filed as a defect.

### F7 — 🔴 MED–HIGH (copy + correctness): an offer the seller *just accepted* is labelled "expired"
**Surface:** `Review Offer`, immediately after a successful individual accept (reproduced once, captured behind the success modal).
**Observed:** behind the "Offer Accepted! Payment authorized. Trade is now in progress." dialog, the action area is replaced by:

> **"This offer has expired and can no longer be accepted."** + a "Back to Offers" button

**Why it matters:** the trade was `pending` two seconds earlier and is now `in_progress` **because this same seller accepted it**. Telling them their own just-accepted offer "has expired and can no longer be accepted" is factually wrong on a money/state surface, and actively confusing ("did my accept fail?").
**Root cause (source-verified):** `ReviewOfferScreen.tsx:658` gates the action block on `{offer.status === 'pending' ? (…accept/decline…) : (<expiredActionsContainer>)}` — a **two-way** branch whose else-arm assumes the only other state is expiry. Every other status (`in_progress`, `completed`, `cancelled`, `disputed`) falls into the same "expired" copy.
**Proposed fix:** make the else-arm status-aware — e.g. `in_progress` → *"You accepted this offer — the trade is now in progress."*, `completed` → *"This trade is complete."*, `cancelled` → keep the expiry copy only when `cancellation_reason === 'Offer expired'` (the screen already does exactly that correctly at L428). Resume the correct copy per status rather than one generic line.
**Evidence:** `screenshots/P0-35-after-individual-accept.png`.

### F8 — 🟡 LOW–MED (internal inconsistency): the bundle banner over-counts once a sibling is accepted
**Surface:** `Review Offer`, same screen, same render.
**Observed:** the green banner reads **"Bundle offer · 3 items"** while the primary CTA directly beneath it reads **"Accept All 2 Items"** (and the confirm modal "Accept all 2 items?"). Two counters, one screen, two different numbers.
**Root cause:** banner uses `bundleSiblings.length + 1` (`ReviewOfferScreen.tsx:446`) and the siblings query (L171-193) selects **all** trades sharing the `bundle_id` with **no status filter** — so accepted siblings stay in the count. FIX-Task-25 fixed the *button* count to pending-only (L776/782) but not the banner.
**Proposed fix:** derive the banner count from the same pending-only selector the button uses, or relabel the banner to make its scope explicit ("Bundle of 3 items · 1 already accepted").
**Evidence:** `screenshots/P0-33-review-offer-fresh.png` ("3 items" + "Accept All 3 Items") vs `screenshots/P0-39-review-offer-2pending.png` ("3 items" + "Accept All 2 Items").

### F9 — 🟡 LOW (refresh ordering): My Trades summary tiles lag the list after an external state change
**Surface:** `My Trades` on return from `Review Offer` after accepting one sibling.
**Observed:** the AX read immediately after the tab tap showed the fully stale list ("Bundle Offer · 3 items", **Needs Action 3 / In Progress 0**). A screenshot ~1 s later showed the card **already corrected to 2 items** while the tiles **still read 3 / 0** — i.e. a single frame in which the card and the tiles disagree. A pull-to-refresh then reconciled everything to the correct **0 / 1 / 2 / 35**.
**Why it matters:** two adjacent widgets sourced from the same data render contradictory numbers for a visible interval; the user must pull-to-refresh to be sure. Distinct from F1 (which is now fixed) — this is the *tiles* lagging, not the list being frozen.
**Evidence:** `screenshots/P0-37-STALE-trade-list-after-accept.png` (tiles 3/0, card "2 items") → `screenshots/P0-38-post-refetch-trade-list.png` (0/1/2/35).

### F10 — 🟢 LOW (design-system deviation): selected filter chip renders in system blue
On **My Listings**, the selected "All" filter chip is a **filled system-blue pill with white text**, while the app's documented palette reserves the primary filled treatment for brand green `#5DBB8E` and its unselected chips render neutral/gray. It is the only blue element on an otherwise green-and-neutral screen, so it reads as a leftover default style rather than an intentional accent.
**Proposed fix:** use the documented selected-chip token (brand green fill + white label, or the neutral "selected" treatment used by the TradeList Active/History tabs) for consistency.
**Evidence:** `screenshots/P0-36-after-ok.png`.

### F11 — 🟡 LOW–MED (robustness): a failed seller join silently deletes the whole Seller Info block
`ItemDetailScreen.tsx:838` gates the entire Seller Info section on `{listing.seller && (…)}`. When the seller join does not resolve (observed while staging returned `Gateway Timeout`), the app renders **no card, no error, no skeleton** — the buyer simply loses "Contact Seller", "View Profile", the masked seller identity **and** the "More from this seller" discovery CTA, with nothing to indicate anything failed. Recommend an explicit inline retry/error state for that sub-request (and/or degrading to a non-clickable "Seller unavailable" placeholder) rather than dropping the affordances silently.
**Evidence:** `screenshots/P0-50-item-detail.png` + the absence of `contact-seller-button` / `view-seller-profile-button` in that screen's AX tree.

---

## 6. UX review (three layers, on what was actually rendered)

**Structural / affordance**
- Bundle CTA, checkout banner, per-item SP inputs and the order summary are all clearly laid out and legible; no overlap or truncation observed on Basket / Checkout / TradeList / ReviewOffer.
- `ReviewOffer` has **no timeout or retry affordance** on its loading state — a hung fetch leaves the user on a bare spinner indefinitely with no way forward but Back. Worth adding a bounded timeout + retry (aggravated by the outage, but a real robustness gap).
- Login has **no inline "we couldn't reach the server" state**; the failure surfaces only as the modal dump in F1.

**Wording / copy clarity**
- 🔴 **DEVIATION — Login Failed dialog:** raw JSON object as the entire body (F1). Rewrite: title **"Login Failed"**, body **"We couldn't sign you in right now. Please check your connection and try again."**
- ✅ CONFIRMED — Checkout: "You're making a single offer for all 3 items from this seller." / "Make one offer for these 3 items" / "All items from this seller" — plain, consistent "one offer" framing, no "Bundle" leakage (**V10/V11 wording correct**).
- ✅ CONFIRMED — SP limit hints read "You can use up to 8 SP" + "Limited by this item's category" (the DEV-TASK-72 unified wording).
- ✅ CONFIRMED — "Trade Initiated!" success + "Consider using SP on your next purchase to save more." is **correct here** (the order used 0 SP; the prior round's F3 was about a 16-SP order).
- ✅ CONFIRMED — Landing: "Local community · Parent-approved · Earn rewards" + Terms/Privacy line.

**Design-system compliance**
- ✅ CONFIRMED — primary CTAs on Landing / Login / Checkout / Basket are the filled green pill; the login-failure modal uses the styled in-app modal (not an OS-blue alert) with a green OK pill; the disabled Log-In state renders grey (`#E8E8E8`-family) as expected.
- ✅ CONFIRMED — the sticky bundle CTA and tab bar do not overlap; the nav is the 5-item persistent pill bar (Home / Discover / Sell FAB / Trades / Basket).
- ⚠️ **Not assessable:** header/back-button geometry — the dev `StartupDebugOverlay` (F5) occludes the centred title band in screenshots. Back controls were verifiable only via the AX tree (`back-button`, `login-back-button`, both ≥44 px with labels).

---

## 7. Locator gaps & friction

- **No new locator gaps** on the surfaces visited; every control needed was AX-exposed with a `testID` (including the disclaimer modal, the SP inputs, and the bundle CTA).
- **Doc drift:** `tab-trade-basket` → `tab-basket` (F3).
- Friction: `qa:ax-tree` cannot parse the mobile-mcp session-resource file (rendered text, not JSON) — known; used a read-only `grep` instead.
- Friction: dev **LogBox overlay** appeared mid-login (`57014`) and covers the bottom band; dismissed. (Recurring class — already documented.)
- Friction: Android **IME invisible to the AX tree** reconfirmed — after typing the password, a screenshot was required to prove the keyboard was up and that it covered `login-submit-button`; BACK dismissed it *while the IME was showing* (correct order).
- The `qa-login-as` deep link **does not fire on the Landing screen** (handler is mounted in the authenticated stack only) — so a fully logged-out app cannot be recovered by deep link and needs a UI login. Worth a playbook note.

---

## 8. App state left behind

- **Logged in as `test-buyer`** on Discover / Item Detail ("QA First-Trade Fixture"). 459 SP. Header badges: notifications `99+`, chat `1`.
- **Bundle `15b77972-2c14-44ef-a917-1b062da533b9` is now fully COMPLETED.** All three siblings (`a392663e`, `976766c4`, `2e7b3fb5`) are `completed`, `completed_at` 14:39:41.98 / :43.02 / :44.57, `sp_transferred_at` stamped — **3 real Stripe captures were taken** (same class of state as the 2026-09-11 round). The three fixture listings (`0b13fda1…`, `5196045f…`, `5c9f5d4a…`) are now `sold`.
- **test-seller** moved to 42 completed trades; those 3 items left its inventory.
- **Test-seller's Basket badge shows `4` with an empty visual cart** — this is the **known stale-cart fixture** (real `cart_items` rows from 2026-08-29; `qa:reset-offer-fixtures` only covers the QA *buyer* personas). Per R100 this is a real DB count, **not** a leak — do not re-file it.
- Carry-over fixtures remain (`f24968b7` "QA First-Trade Fixture" $25 still available and clean; the "1–4 of 4" set partly sold).
- Possibly one orphan item from the first, timed-out `qa:create-bundle-fixture` attempt — worth a glance next run.
- **No `admin_config` writes, no admin-portal writes, no stubs registered**, no source/test/seed edits.
- Metro `:8081` + `:8082` and admin `:3001` left running.

---

## 9. What needs to happen next

1. **Dev (F7, MED-HIGH):** make `ReviewOfferScreen`'s else-branch status-aware so an accepted / in-progress / completed trade is never described as "expired" (`ReviewOfferScreen.tsx:658`).
2. **Dev (F1, HIGH):** stop rendering the raw `Response`/error object in the login-failure path; map to friendly copy and keep the technical detail in `errorReporter` only. Purge header/cookie material from anything user-visible.
3. **Dev (F6, low):** make `ReviewOfferScreen.fetchOffer` clear `loading` on its early return (and consider a fetch timeout + retry), so a slow/missing session can never strand the screen.
4. **Dev (F4, low–med):** confirm the Checkout pre-load fee default — the buyer must never see a wrong cash total, even briefly.
5. **Dev (F8, LOW-MED):** use one pending-only count for both the bundle banner and the Accept-All button (`ReviewOfferScreen.tsx:446` vs L776/782).
6. **Dev (F9, LOW):** make the My Trades summary tiles and the list resolve from the same refresh so they can never disagree within one frame.
7. **Dev (F11, LOW-MED):** give Item Detail's Seller Info sub-request an explicit error/retry state instead of silently removing the card and its CTAs when `listing.seller` is unresolved.
8. **Design (F10, low):** replace the system-blue selected chip on My Listings with the documented selected-chip token.
9. **Docs (F3 + X16):** fix the stale `tab-trade-basket` testID in TRD-TC-X01; resolve TRD-TC-X16 by either restoring the FLOW-00/FLOW-07 smoke items or retiring it as no-longer-applicable.
10. **Owner:** re-run the un-executed scope now that staging is responsive. Order: finish Phase 0 (c)/(e), then Group N2 (§4b, SQL-drivable), then Phase 1a, Phase 2, Phase 3.
