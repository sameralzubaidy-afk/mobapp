# FIX-Task-28 — Subscription-status lie + SP audit gap + disclaimer checkbox + tile skeleton + tooling + UX

**Date:** 2026-09-13
**Source:** QA Task — *Verify FIX-Task-27 Remainder + N2 + Phase E*
**Scope:** 1 MED priority bug · 1 MED audit gap · 1 MED tap-target · 1 LOW-MED skeleton · 2 LOW copy/warning · 1 tooling crash guard · 1 investigation · 4 UX enhancements
**Out of scope (re-confirmed, not re-litigated):** Amazon liability-disclaimer content.

---

## Tier 0 result

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` (from `p2p-kids-marketplace/`) | **PASS** |
| Lint (scoped) | `npx eslint <11 changed src files>` | **PASS** — 0 errors (22 pre-existing `no-console` warnings in these services) |
| Unit tests | `npm test` | **PASS** — 328 suites / 3,868 tests passed, **0 failed** (54 E2E-gated suites / 485 tests skipped — env variance) |
| Prettier | `npx prettier --write` on the 9 files with drift | Applied; drift per file was 4–20 lines (no wholesale reformat) |

Flake observed (not a regression): `CartScreen.test.tsx` failed once on
`cart-empty-icon` inside the full-suite run, then **passed on re-run in isolation**
(17/17) — consistent with the known-flaky empty-state assertion documented in that
file's own comment (`CartScreen.test.tsx:58`). Reported as a flake to watch.

---

## Item-by-item

### Item 1 — [PRIORITY] Home can no longer silently claim "free tier"

**Files:** `src/services/subscription.ts`, `src/hooks/useSubscription.ts`,
`src/screens/dashboard/UserDashboardScreen.tsx`, `src/contexts/AuthContext.tsx`,
`src/services/devTestingService.ts` + tests.

- `subscription.ts` — added `'unknown'` to `SubscriptionStatus`, `unverified?: boolean`
  on `SubscriptionSummary`, and `createUnverifiedSummary()`. **Every** failure path
  (transient RPC error, unusable payload, thrown error) now returns *unverified*
  instead of the free-tier summary. Only a confirmed empty result set still means
  "verified free". Entitlement gates stay fail-closed (`can_spend_sp/can_earn_sp = false`).
- `useSubscription.ts` — keeps a `lastVerifiedRef`; a failed read hands back the last
  **confirmed** summary, or `null` (explicit "we don't know"), and exposes
  `unverified`. The ref is cleared when the signed-in account changes, so account B can
  never inherit account A's plan.
- `UserDashboardScreen.tsx` — the SP strip now has three branches: verified member →
  member strip; **unverified and never confirmed → `sp-strip-unverified` ("We couldn't
  check your plan") + `sp-strip-retry`**; verified free → the existing upsell. The
  subscription badge renders **"Plan unavailable"** (never "Free Plan") and the
  "Upgrade to Kids Club+" card CTA is suppressed while unverified.
- `AuthContext.tsx` (same class, owner-approved) — a failed `get_subscription_summary` /
  wallet read no longer overwrites a known plan with `status:'free'` / `can_spend_sp:false` /
  `available_points: 0`; it preserves the last-known session values.
- **QA verification hook:** new session-local `subscription_read_failure` toggle
  (values `read_failure` | `none`) that throws a *real* transient `TypeError('Network request failed')`
  **inside** the service's try block, so the genuine transient branch runs.

**Why the blast radius stayed small:** because the hook degrades to `null`/last-known,
no other screen can newly see `status:'unknown'` — the class sweep confirmed the
consumers that branch on `=== 'free'` (`SubscriptionStatusCard`, `MySubscriptionScreen`,
`UpgradePlanScreen`, `ManageKidsClubScreen`) keep their pre-existing behaviour and add
no new wrong claim.

### Item 2 — SP audit trail on every real release path

**Files:** `supabase/migrations/20260913000001_fix_task_28_sp_release_audit.sql` (**new**),
`cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`.

- `rpc_release_pending_sp` and `fn_release_all_sp_on_complete` now journal an
  `sp_released` row via `fn_log_financial_audit`, keyed **`sp_release_<trade_id>`** —
  the same key `complete-trade` already used.
- **One shared key, deliberately:** `ON CONFLICT (idempotency_key) DO NOTHING` then
  yields exactly **one** `sp_released` row per trade whichever path arrives first, which
  is what keeps N2-C07's "each transition appears exactly once" true. Two distinct keys
  would have produced two rows and broken that assertion.
- N2-C04's expected result now names the real writer; C07 gained an actor-semantics note
  (a system-written row carries `actor_id = NULL`, which is expected, not a defect).

> **Status: APPLIED + VERIFIED on staging** (`drntwgporzabmxdqykrp`), 2026-09-13.
> Applied via `apply_migration` `fix_task_28_sp_release_audit`; verified by live read-back
> (never by the migration list — BP-81). See "Staging verification (Tier 1/2)" below.
> **Zero net data mutation:** the functional proof ran inside a `DO` block that raised at
> the end, so the specimen trade, its wallet movement, the audit row and the notification
> were all rolled back (confirmed: audit row persisted = 0, total `sp_released` rows still 8).

### Item 3 — Disclaimer checkbox responds to the whole row

`src/components/DisclaimerModal.tsx` — the checkbox row is now pinned
`width: '100%'` / `alignSelf: 'stretch'` / `minHeight: 48`, its square + label are
`pointerEvents="none"` so the row's `Pressable` owns the touch, and the row carries a
12pt `hitSlop`. Test added asserting the row geometry and the non-interactive children.

**Root cause, confirmed from evidence rather than guessed:** `qa:ocr --coords` on the
pre-fix screenshot shows the label `I have read and understand this disclaimer` at
**`{x:129,y:2124,w:711,h:35}`** — i.e. QA's inert tap at `(540,2138)` was squarely
inside the label, exactly as reported.

### Item 4 — Trade list tiles no longer show a false 0/0/0/0

`src/screens/trade/TradeListScreen.tsx` — tile values are withheld behind
`summaryTotalsReady` (`activeLoadStatus === 'loaded'`) and render an em dash, which
reads as "not known yet" instead of a real zero. The Needs Action hint renders a blank
placeholder until ready.

### Item 5 — Empty-URI image warning

`CartScreen.tsx`, `CartCheckoutScreen.tsx`, `BundleBuilderScreen.tsx` — the three
unguarded `<Image source={{ uri: … }}>` sites now omit the source entirely when the URI
is empty (`item.imageUrl ? { uri: item.imageUrl } : undefined`). All three thumbnail
styles already carry a neutral background, so the placeholder needs no new styles and no
new component. Discover rows already route through `ItemCard` → `ListingImage`, which
guards the empty case.

### Item 6 — `qa:ocr --coords` + the AX-dump guard

- `p2p-kids-marketplace/scripts/qa/lib/vision_ocr.swift` + `scripts/qa/ocr.mjs` — new
  `--coords` mode returning integer **top-left pixel** boxes in the original image's
  space (`--region` offsets added back). `--json` form: `[{ text, box: { x, y, w, h } }]`.
- `scripts/qa/vision-ocr.swift` (legacy helper) — same flag; documented in
  `scripts/qa/README.md`.
- **Guard:** the SIGSEGV is the mobile-mcp JVMTI attach, not app code, and the dump is an
  external MCP call with **no repo-side chokepoint** — so the guard is (a) a playbook rule
  and (b) a coordinate source that needs no AX dump. Added as **§5.84 / R107** in
  `.github/instructions/QA-Test-Agent.instructions.md`, with a dated pointer in
  `.github/agents/QA-Test-Agent.agent.md` and the `subscription_read_failure` toggle
  registered in the §5.67 deep-link table.

**Verified live** (dogfooding the new tool):
`npm run qa:ocr -- --img <checkout screenshot> --coords` → boxes rendered, and the
disclaimer label box matched the on-screen control.

### Items 8–11 — UX

| Item | Change |
|---|---|
| 8 | `ReviewOfferScreen.tsx` — new `OFFER_SLOW_HINT_MS = 8000` + `review-offer-slow-hint` ("Taking longer than usual...") with the error state's `Back to Offers` escape hatch. Deliberately **no auto-retry** (restarting at 8s would reset the 20s clock). Fake-timer test asserts it appears at 8s, not before, and that the hard bound has not fired. |
| 9 | `CartScreen.tsx` — the "This seller has N more items" banner lost its card treatment (fill, border, radius) and gained separation (`marginBottom: xl`), so only the green bundle CTA reads as a primary control. |
| 10 | `UserDashboardScreen.tsx` — the strip already navigated to SP Wallet; added `minHeight: 48`, `hitSlop={8}`, and replaced the meaningless AX label `"Sp strip"` with the balance + destination. |
| 11 | `CartCheckoutScreen.tsx` — **one** `points-remaining-banner` hoisted above the `ScrollView` (always visible), and the per-item `sp-remaining-*` repeats added by FIX-Task-19 item 8 deleted (their dead style removed). |

---

## Item 7 — Double-refund investigation: **needs DB reads (approval-gated)**

**Hypothesis from source (strong):** `trade-refund` is an *admin partial* refund per
component — its own header states it exists to "refund one component at a time — e.g.
refund the item price but keep the platform fee, or refund price + tax but keep the fee"
(`supabase/functions/trade-refund/index.ts:4-14`). Each call issues its own Stripe refund
and writes its own `trade_refunds` row through `rpc_record_payment_refund`, with the
idempotency key `refund_<trade_id>_<hash(price,fee,tax)>` (`:223`). **Two successful
refunds on one PaymentIntent is therefore an expected shape for a split-component refund
(price then tax/fee), not automatically a duplicate-refund bug.**

**Writers to attribute (traced):**
1. `rpc_record_payment_refund` — `supabase/migrations/317_payments_reconciliation_and_partial_refunds.sql:173-278`
2. `supabase/functions/trade-refund/index.ts` (admin partial refund)
3. `supabase/migrations/20260912000009_fix_task_24_payments_derived_state.sql:248`
4. `resolve-dispute` (force-cancel / dispute = full-PI refund) — the alternative explanation

**Queries to run for `f9d53797`, `e54f608a`, `f2899f12` (read-only):**

```sql
-- 1. What each refund actually refunded, and when
SELECT tr.trade_id, tr.stripe_refund_id, tr.refund_price_cents, tr.refund_fee_cents,
       tr.refund_tax_cents, tr.refunded_cents, tr.reason, tr.created_at
FROM public.trade_refunds tr
WHERE tr.trade_id IN ('f9d53797','e54f608a','f2899f12')   -- replace with full UUIDs
ORDER BY tr.trade_id, tr.created_at;

-- 2. Does the split reconcile against what was charged (the discriminator)
SELECT p.trade_id, p.total_charged_cents, p.refunded_price_cents,
       p.refunded_fee_cents, p.refunded_tax_cents, p.refunded_cents
FROM public.payments p
WHERE p.trade_id IN ('f9d53797','e54f608a','f2899f12');

-- 3. Which writer produced them (audit trail, actor included)
SELECT entity_id, mutation_type, amount_cents, actor_id, idempotency_key, created_at
FROM public.financial_audit_log
WHERE entity_id IN ('f9d53797','e54f608a','f2899f12')
ORDER BY entity_id, created_at;
```

**Verdict rule:** if the two rows split price vs tax/fee and their sum equals
`total_charged_cents`, this is a legitimate two-call partial refund → **no code change**,
and the finding is closed as *ruled out* (a first-class result). If two rows refund the
*same* component with different Stripe ids and the sum exceeds what was charged, it is a
real duplicate → fix in the writer identified by query 3.

**Status: RESOLVED — NOT A DEFECT (ruled out with evidence).**

Ran against staging 2026-09-13. All three trades carry **two per-component admin partial
refunds**, which is the feature's designed behaviour — each call refunds one component
(price OR fee OR tax), issues its own Stripe refund, and writes its own `trade_refunds` row:

| Trade | Refund 1 (price/fee/tax) | Refund 2 | Refunded total vs charged | Reasons recorded |
|---|---|---|---|---|
| `e54f608a-1bea-4515-8553-fb385ffb9650` | 2200 / 0 / 0 | 0 / 0 / 154 | 2354 = 2200 cash + 154 tax ✅ | "QA K07 partial refund test: refund item price only, keep platform fee" · "QA K08 partial refund test: refund sales tax component only" |
| `f2899f12-7317-4ec3-9ddd-d8e51b3dd2c0` | 2500 / 0 / 0 | 0 / 0 / 175 | 2675 = 2500 + 175 ✅ | "QA K07 partial refund - price only, fee and tax kept" · "QA K08 - sales tax component only" |
| `f9d53797-8c45-4797-8eb8-4281911fd003` | 0 / 0 / 699 | 1000 / 0 / 0 | 1699 (partial price + tax) | "### TC-K08 · Admin partial refund — tax ledger partially refunded" (1 & 2) |

**Attribution:** all refund pairs were issued by actor `1a546991-5361-4b4e-b44b-eee9bf730757`
(admin) — the same actor on the `refund_issued` + `tax_refunded` audit rows for the two
recent trades. The payment ledger reconciles exactly (refunded = charged components), and
the two older trades' reason strings still name their originating test cases (K07/K08).
The third trade's `refund_audit_rows = 0` only because it predates the audit instrumentation
(2026-08-01).

**Verdict:** the "two successful refunds on one PaymentIntent" observation is a legitimate
two-call split-component refund, **not** a duplicate-refund bug. **No fix made** (correctly —
a change here would have broken a deliberate feature).

---

## Staging verification (Tier 1/2) — item 2

Project `drntwgporzabmxdqykrp`. All evidence from live reads/invocations, never the
migration list (BP-81).

**Before (the defect, measured):** both functions existed but neither wrote an audit row
(`has_audit = false` for each), and across **59** completed SP trades with a non-zero
`sp_earned_at_completion` there were only **8** `sp_released` audit rows — all from
`complete-trade` (the only writer). `ready_now = 0`, so nothing was awaiting release.

**Applied:** `apply_migration` → `fix_task_28_sp_release_audit` (Mode B, `CREATE OR REPLACE`
only, no data mutation). Result: `{"success":true}`.

**After — object-level read-back:**

| Check | Result |
|---|---|
| `rpc_release_pending_sp` body contains `fn_log_financial_audit` | ✅ true |
| `fn_release_all_sp_on_complete` body contains `fn_log_financial_audit` | ✅ true |
| `trigger_release_all_sp_on_complete` still attached | ✅ true (CREATE OR REPLACE preserved it) |
| `financial_audit_log_idempotency_key_key` unique index present | ✅ true |
| Live grants on `rpc_release_pending_sp(integer)` (`aclexplode`, BP-78) | ✅ `postgres`, `service_role` only — no `PUBLIC`/`anon`/`authenticated` |

**Functional proof (N2-C04 double-run).** No trade was legitimately awaiting release, so a
real run would have been a no-op; and re-arming an already-released trade for real would
have **double-credited** a seller's available balance. Instead the proof ran the real
function twice inside a `DO` block that raises at the end, so the whole statement (and the
specimen's mutations) rolled back:

```
PROOF(rolled_back) trade=080551cb-c5ec-44f4-86ca-2b530b73afe2 points=7
  wallet_pending_before=491
  run1_released=1  run2_released=0
  audit_rows_for_key=1  trade_released_flag=1  notif_rows=1
```

Read as: the processor released the trade on the first call and **did not double-credit** on
the second (`run2_released=0`); exactly **1** audit row exists for `sp_release_<trade_id>`
(N2-C04's previously-unsatisfiable assertion); the `sp_released` notification fired once.

**Rollback confirmed** (so staging is unchanged):

| Check | Expected | Actual |
|---|---|---|
| Specimen trade still has `sp_released_at` | 1 | ✅ 1 |
| Audit row for `sp_release_080551cb…` persisted | 0 | ✅ 0 |
| Total `sp_released` audit rows | 8 | ✅ 8 (unchanged) |

**Known gap (not done, flagged):** the ~51 historical released trades still have no
`sp_released` audit row — the fix journals them going *forward*. Back-filling historical
rows is a separate, deliberately-not-taken step (the audit log records transitions; inventing
retroactive transitions is a product decision, and it was not requested).

---

## Device verification

Attempted in-session on the Android emulator (`Medium_Phone_API_36.1`, app
`com.sameralzubaidi.p2pmarketplace`, Metro up on 8082). Baseline evidence captured at
`screenshots/A-home-subscriber-baseline.png`; the `qa-login-as?persona=test-buyer`
hand-off was still resolving its session when the pass was stopped, so the legs below
are recorded as **owed** with exact steps (BP-91).

### Owed device legs

| # | Leg | Steps | Expected |
|---|---|---|---|
| 1a | **Item 1 — no last-known** | Login `test-buyer` (subscriber) → cold relaunch → arm `qa-dev-toggle?key=subscription_read_failure&value=read_failure` → relaunch again | Home shows `sp-strip-unverified` ("We couldn't check your plan") + `sp-strip-retry`. **Must NOT show** "Unlock Swap Points / Upgrade →". Badge reads "Plan unavailable". |
| 1b | **Item 1 — last-known preserved** | Disarm → relaunch (member strip, "N SP / Earn More") → arm toggle → navigate to Profile and back to Home (focus refetch) | Member strip **stays**; no upsell, no downgrade. |
| 1c | **Item 1 — genuine free user** | Disarm → `qa-login-as?persona=test-free` | The "Unlock Swap Points / Upgrade →" upsell **still appears** (no over-correction). |
| 3 | **Item 3** | Checkout → open the liability disclaimer → tap the **label centre** (not the square) | Checkbox ticks; `disclaimer-modal-accept-button` enables. Pre-fix the label box was `{x:129,y:2124,w:711,h:35}`, so tap ≈ `(545,2141)`. |
| 4 | **Item 4** | Cold-start → My Trades | No 0/0/0/0 flash; tiles show `—` until counts resolve, then real numbers. |
| 5 | **Item 5** | Open Basket / Checkout / Bundle Builder with an image-less row; grep the JS log | No `source.uri should not be an empty string`. |
| 8 | **Item 8** | Arm `offer_load_stall` → open a pending offer as the seller | Bare spinner, then at ~8s "Taking longer than usual..." + Back to Offers; error state at 20s. **Do not AX-dump inside this window (R107).** |
| 9 | **Item 9** | Basket with a seller that has extra items | Banner reads as a plain text row; only the green CTA looks like a button. |
| 10 | **Item 10** | Home → tap the SP strip | Opens SP Wallet (already covered by 4 unit tests); confirm the enlarged target. |
| 11 | **Item 11** | Checkout with 3+ SP-eligible items; type into a lower item's SP field | One "Points remaining" pinned above the list, updating live; **no** per-item repetition. |
| 2 | ~~**Item 2**~~ | **DONE** — see "Staging verification (Tier 1/2)" above | ✅ applied + proven (rolled back, zero net mutation) |
| 7 | ~~**Item 7**~~ | **DONE** — see the item-7 verdict above | ✅ ruled out: legitimate split-component partial refunds |
