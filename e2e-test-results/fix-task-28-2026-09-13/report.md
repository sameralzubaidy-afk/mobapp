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

> **Status: written, NOT applied.** Applying the migration to staging is approval-gated
> (Supabase MCP protocol / BP-80). Tier 1/2 for item 2 = **DEFERRED**.

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

**Status: NOT RUN** — Supabase MCP reads require Samer's per-call approval.

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
| 2 | **Item 2** | After the migration is approved+applied: fast-forward a completed trade's `pending_sp_release_at`, run `rpc_release_pending_sp(100)` **twice** | Exactly 1 audit row at `sp_release_<trade_id>`, seller credited once. |
| 7 | **Item 7** | Run the three read-only queries above | Attribution verdict. |
