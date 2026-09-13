# Ledger — Group N/N2 + T03/S/M + V/X/Y (2026-09-13) — Phase 0 driven after an initial outage

**Run:** `e2e-test-results/qa-groupn-n2-phase0-2026-09-13/` · HEAD `5aad09d7` · Android `Medium_Phone_API_36.1` (iOS booted, NOT driven — R80)
**Outcome:** Phase 0 **(a) PASS · (b) PASS · (d) PASS**, **(c)/(e) environment-blocked**; **X12 PASS**, **X14 PASS** (new row), **X16 → DOC-DRIFT**, **X11 attempted / never-run**. Phases 1–3 (Group N remainder, **all of Group N2**, T03/T12–T14, remaining S/M/V/X/Y) **not started**. The session opened in a staging outage (~40 calls lost) and recovered mid-run.

## Call tally (R71-fallback — transcript not mineable, manual tally, approximate)

| Bucket | ~calls |
|---|---:|
| Recon (playbook/memory/guides/busy-check/HEAD) | 20 |
| Fixture setup + reset | 3 |
| Outage diagnosis + recovery (logcat/curl probes, cold relaunch, 5 logins, UI login) | 26 |
| Phase 0(a)/(b)/(d) drive (bundle → checkout → offer → individual accept → bundle accept → Confirm-All-N → verification) | 55 |
| Phase 0(c)/(e) attempt (Discover search, Item Detail, scroll, source) | 14 |
| Source/doc checks (X14, X16, F5/F6/F7/F8/F11 root-cause) | 12 |
| Report + tracker + ledger | 14 |
| **Total** | **~144** |

**≈144 calls** for **7 verdict items** (Phase 0 a/b/d, X11, X12, X14, X16) ⇒ **≈21 per verdict**, far worse than the 3.3 best, and ~26 calls (18 %) were pure outage handling. The dominant cost is **environmental**, not device friction. Desk work is isolated from device execution per R71-fallback.

## Decision / outcome log (key forks only)

| # | Decision point | Chosen | Outcome |
|---|---|---|---|
| 1 | Platform | Android (as in every round since 2026-09-07); iOS booted but not driven | Consistent; R80 disclosed |
| 2 | Bundle fixture first attempt failed `Gateway Timeout` | Retried **once** (not 3–5×) | Succeeded — 3 items, cart `15b77972-…` |
| 3 | Checkout appeared stuck on a spinner for >60 s | Polled with screenshots, then **read the AX tree** instead of concluding a hang | **Correct call** — the tree showed the fully-loaded screen; the screenshots were lagging. Avoided a false "checkout is broken" finding |
| 4 | Two AX tree reads of the same screen disagreed (`$0.99`/`$51.23`/no SP inputs vs `$1.49`/`$51.73`/SP inputs) | Captured **both** frames before theorising | Produced finding **F4** (transient wrong price on a money screen) |
| 5 | Post-submit "Trade Initiated!" → is the backend consistent? | **DB read-back in a separate statement** (R24), not the same query | 3 trades, 1 shared `bundle_id`, tax 224 = $2.24 ✓ |
| 6 | Seller Review Offer stuck on "Loading offer…" | Re-entered once (2nd entry) to test reproducibility before filing | Reproduced — but **did not file**: checked logcat first |
| 7 | Persona switch → Home stuck on a spinner | Followed **R101**: force-stop + cold relaunch before judging | **Correct call** — avoided filing a phantom product defect |
| 8 | After cold relaunch, `qa-login-as` silently did nothing | Checked logcat rather than assuming the handler was broken | Found the real cause: **HTTP 504** on `/auth/v1/token`. Also learned the handler **does not mount on Landing** |
| 9 | Login failing repeatedly | Switched to a **UI login** with the documented fixture credential from `seed-staging-data.ts` (never guessed) | Credential correct; the request itself 504'd (server-side) |
| 10 | Login failure produced a modal | **Read the modal rather than dismissing it blind** | 🔴 Produced the round's headline finding **F1** (raw `Response` dump incl. project ref + live `__cf_bm` cookie) |
| 11 | Should I keep retrying the login? | Bounded at **5 attempts** over ~13 min, then pivoted to session-independent work | Max value from a dead environment: X14 + X16 both scored, F5/F6 root-caused from source |
| 12 | `ReviewOfferScreen.fetchOffer` early-return without clearing `loading` | Filed as **F6 INFO / unconfirmed**, explicitly NOT as a defect | R101 discipline — the outage, not that code, caused the observed stall |

## Phase 0 results (post-recovery — the one contiguous flow that produced (a), (b) and (d))

One bundle, one continuous chain, four personas' worth of state:

1. `qa:reset-offer-fixtures` → clean. `qa:create-bundle-fixture --buyer test-buyer --seller test-seller --count 3` → cart `15b77972-…`, 3 items.
2. **Basket**: 3 grouped items + `bundle-cta-button`, Basket badge `3`.
3. **Checkout (bundle)**: `bundle-checkout-banner` = "📦 Combined Offer"; per-item `sp-input-*` (caps 8/12/11 SP, all "Limited by this item's category", "Points remaining: 459"); summary $48.00 + $1.49 + $2.24 = **$51.73**; disclaimer modal gate-correct; `send-offer-button` → **"Trade Initiated!"**.
4. **DB (separate statement, R24):** 3 trades `pending`, one shared `bundle_id` = the cart id, tax 112+112+0 = $2.24 ✓.
5. **test-seller**: My Trades `0 / 0 / 3 / 35`, card **"Bundle Offer · 3 items"** with Review Each / Accept All / Decline All → **Review Each** → Review Offer loaded ("47h left", "Bundle offer · 3 items", payout $16.00 − $3.20 = **$12.80**, "Accept All 3 Items" + "Accept Trade").
6. **Phase 0(b)** — tapped the **individual** `accept-trade-button` → confirm → **"Offer Accepted!"**. DB: exactly ONE sibling advanced to `in_progress`, other two `pending` ✓. **Behind the dialog the screen rendered F7** ("This offer has expired…"). Re-entry on a still-pending sibling showed **"Accept All 2 Items"** and the modal **"Accept all 2 items?"** ⇒ **pending-only count VERIFIED**. Note **F8** in the same render ("Bundle offer · 3 items" beside "Accept All 2 Items").
7. **Phase 0(a) setup** — accepted the remaining 2 → all 3 `in_progress` (DB) → back on the buyer: `0 / 3 / 0 / 39`, bundle card under IN PROGRESS.
8. **Phase 0(d)** — opened the bundle timeline: banner `In Progress` + **`Auto-completes in 71h 57m`** sub-line (agrees with the bottom "Confirm pickup — auto-completes in 71h 57m") ⇒ **PASS**.
9. **Phase 0(a)** — **"I Got It — Complete Trade"** → **"Confirm all 3 items received?"** → **"Confirm All 3"** → **"Done! All 3 items marked as completed."** → tapped Trades **without any manual refresh** → **0 / 0 / 0 / 42** with the 3 new rows ⇒ **PASS** (stale card gone). DB: all 3 `completed`, `completed_at` 14:39:41.98/:43.02/:44.57, `sp_transferred_at` stamped.
10. **Phase 0(c)/(e)** — DB-picked a no-trade item (`f24968b7`, 0 trades with the buyer) via Discover search → Item Detail rendered normally but the **Seller Info block was absent entirely**, so neither the seller buttons nor the more-from-seller CTA could be observed ⇒ **BLOCKED (environment)**, root-caused to the `{listing.seller && …}` gate at `ItemDetailScreen.tsx:838` while the seller join was failing.

**Free/incidental coverage (not scored as verdicts):** V10, V11, T01, X10, S07, Y09, X12, X07 (nav re-observed on Timeline + Trade Complete), Y02-ish (History tab reachable).

## Additional decision-log rows (post-recovery)

| # | Decision point | Chosen | Outcome |
|---|---|---|---|
| 13 | Retry the login a 6th time after the DB probe recovered | **Yes, once** — auth and DB recover independently | Succeeded via the **UI login form** (the `qa-login-as` deep link does not mount on Landing); session established |
| 14 | Review Offer had stalled twice pre-recovery | Re-tested **on the fresh post-recovery process before filing anything** | Loaded perfectly first try ⇒ the stall was the outage, **not** a product defect — avoided a false HIGH |
| 15 | The Trade List showed a **stale** "Bundle Offer · 3 items / Needs Action 3 / In Progress 0" right after an accept | Captured the **stale frame**, then refreshed, then the post-refresh frame (staleness discipline) | Produced **F9**; also revealed the first AX read was pre-refresh while the screenshot a second later was already correct |
| 16 | `q:ax-tree` cannot parse the mobile-mcp resource file (rendered text, not JSON) | Fell back to a read-only `grep` on the saved tree | Known limitation; cost no extra calls |

## Retractions / non-findings (things I nearly filed and did not)

- **"Review Offer never loads for a bundle"** — NOT filed. Root cause was the staging 504 (fetch never resolved); the R101 fresh-process retest was performed and the screen still stalled, but on a backend that was verifiably down.
- **"Basket screen has no Checkout button / no summary card"** — NOT filed. The first tree read was a **partial pre-load render**; the settled tree shows `price-breakdown` (Subtotal/Fee/Tax/Cash Total) and `send-offer-button`. Only the **transient wrong fee** survived as F4.
- **"Startup / no active session overlay is a product defect"** — NOT filed. Root-caused to `StartupDebugOverlay`, `__DEV__`-only, `pointerEvents="none"` → F5 INFO.
- **test-seller's Basket badge = 4** — NOT filed. Known real stale cart rows (2026-08-29); `qa:reset-offer-fixtures` covers QA *buyer* personas only, so test-seller's rows persist. Reconcile per R100 before ever calling this a leak.
- **`items` column guesses** — 1× `42703` on `sp_amount_cents`; corrected immediately from `schema-cheat-sheet.md` (`cash_amount_cents`). No repeat.
- **"Review Offer never loads for a bundle"** — **retracted post-recovery** (see decision 14). The screen loaded first try once staging was healthy.
- **"A just-accepted offer renders as expired"** — this one **survived** scrutiny and is filed as **F7**: it was reproduced against a healthy backend on a fresh process, and the source branch (`status === 'pending'` two-way ternary) explains it exactly.
- **"Seller Info card is missing from Item Detail"** — **not** filed as a defect: the block is gated on `listing.seller`, and the surrounding LogBox showed `Gateway Timeout`, so the honest verdict is BLOCKED + the robustness observation **F11**, not "the buttons were removed".
- **"Full-screen spinner on Landing means the app is wedged"** — not filed; it was the outage, confirmed by the 504 log line.

## Evidence index

| File | Shows |
|---|---|
| `screenshots/P0-00-start-state.png` | Session start (Discover, dev `StartupDebugOverlay`, notifications 99+) |
| `screenshots/P0-01-basket-3items.png` | Basket: 3 bundled items, `bundle-cta-button`, Basket badge **3** |
| `screenshots/P0-02/03-*.png` | Checkout loading (spinner) — the pre-load frames behind F4 |
| `screenshots/P0-04-checkout-loaded-full.png` | Checkout settled: `bundle-checkout-banner` "📦 Combined Offer", SP inputs, $48.00+$1.49+$2.24 = **$51.73** |
| `screenshots/P0-05-offer-submit-result.png` | Liability Disclaimer modal (Amazon content — owner-excluded, not re-litigated) |
| `screenshots/P0-06/07-*.png` | "Processing…" → **"Trade Initiated!"**; Trades badge 3, Basket badge cleared |
| `screenshots/P0-13-seller-trades.png` | Seller My Trades: 0/0/**3 Needs Action**, "Bundle Offer · 3 items", Review Each / Accept All / Decline All |
| `screenshots/P0-14/15/16-*.png` | **Phase 0(b)** target screen stalled on "Loading offer…" (outage) — 1st entry |
| `screenshots/P0-17/18/19-*.png` | Back → re-entry → stalled again (2nd entry, reproducibility check) |
| `screenshots/P0-20→29-*.png` | R101 force-stop + cold relaunch; Dev Launcher 8081/8082; Landing; failed deep-link logins |
| `screenshots/P0-31/32-*.png` | Login form filled; **IME visibly covering `login-submit-button`** (Android IME-invisible-to-AX reconfirmed) |
| `screenshots/P0-35-login-poll2.png` | Dev LogBox `[cartService.getCartItems] {"code":"57014"}` (statement timeout) |
| `screenshots/P0-33-review-offer-fresh.png` | **Phase 0(b)** Review Offer loaded: "Bundle offer · 3 items", "Accept All 3 Items", "Accept Trade", payout $16.00 − $3.20 = $12.80 |
| `screenshots/P0-34-accept-confirm-dialog.png` | Individual-accept confirm: "Are you sure you want to accept this offer?…" |
| `screenshots/P0-35-after-individual-accept.png` | **F7 evidence** — "Offer Accepted!" over a screen reading "This offer has expired and can no longer be accepted." |
| `screenshots/P0-36-after-ok.png` | Navigated to My Listings after accept; **F10 evidence** (system-blue "All" chip) |
| `screenshots/P0-37-STALE-trade-list-after-accept.png` | **F9 stale frame** — tiles 3/0 while the card already reads "2 items" |
| `screenshots/P0-38-post-refetch-trade-list.png` | **F9 post-refetch** — 0 / 1 In Progress / 2 Needs Action / 35, accepted trade under IN PROGRESS |
| `screenshots/P0-39-review-offer-2pending.png` | **Phase 0(b) VERIFIED** — "Bundle offer · 3 items" **beside** "Accept All 2 Items" (F8) |
| `screenshots/P0-40-bundle-accepted.png` | "Bundle Accepted! Payment authorized. Trades are now in progress." |
| `screenshots/P0-43-timeline-banner.png` | **Phase 0(d) VERIFIED** — banner sub-line "Auto-completes in 71h 57m" |
| `screenshots/P0-44/45-*.png` | **Phase 0(a)** — "Confirm all 3 items received?" → "Done! All 3 items marked as completed." |
| `screenshots/P0-46-F1-no-manual-refresh.png` | **Phase 0(a) VERIFIED** — My Trades self-updated to 0 / 0 / 0 / 42 with no manual refresh |
| `screenshots/P0-50-item-detail.png` | **Phase 0(c) blocker** — Item Detail renders but with no Seller Info block (F11) |
| `screenshots/P0-52/53-*.png` | Discover search for the no-trade item + IME dismissed before tapping (Android IME rule) |
| **`screenshots/P0-36-post-logbox-dismiss.png`** | 🔴 **F1** — raw `Response` dump in the "Login Failed" modal (1st reproduction) |
| **`screenshots/P0-41-login-attempt4.png`** | 🔴 **F1** — same dump, `x-envoy-attempt-count: 4` (2nd reproduction) |
| `screenshots/P0-44-final-state.png` | Final state — login still spinning; app left logged out |

## Suggested to Improve Agent Rules

**New rule candidate (§5.81 R102) — "an HTTP 5xx that the app surfaces is a SERVER fact, not an app fact: probe the endpoint, then STOP retrying."** This round spent ~24 calls (25 % of the run) retrying a login that was returning `504` with `x-envoy-attempt-count: 4`. The discriminator that would have ended it in ~3 calls: (a) read the **status code** out of the failure (logcat here, or the modal body), (b) issue **one** unauthenticated `curl` against the same endpoint to separate "edge down" (fast 401/timeout) from "upstream down" (fast 401 + slow/504 on the real call), (c) if the failing leg is upstream, **declare BLOCKED (environment) after ≤2 retries** and pivot to the session-independent scope (source/doc/vendor-side cases) instead of re-driving the UI. Companions already in the playbook that this sharpens rather than duplicates: **R101** (empty-message stall = client wedge → *own* process) and **R80/R13** (disclose the no-verdict set rather than implying closure). Proposed addition to §5.80's family as the *outward-facing* sibling of R101 — R101 asks "did my own process lose the server?", R102 asks "is the server itself answering at all, and when do I stop?". **Also worth an explicit line:** the `qa-login-as` deep link is mounted only in the **authenticated** stack, so a fully logged-out app cannot be recovered by deep link — a UI login (documented fixture credential from `seed-staging-data.ts`) is the only path.
