# qa:payout-fixture runbook — SUB F/G/H payout-domain fixture (Dev Task 118)

Dedicated, disposable **seller** persona with CONTROLLED balance + method-state + trade/payout
fixtures for the payout/withdraw domain (SUB F/G/H groups), so QA can drive withdraw E2E and the
method-state cases **without risking a bogus transfer on inflated/shared data** (the QA Task 33
blocker). Builds on the R41 fixture conventions (`scripts/qa/lib/r41-common.mjs`).

| | |
|---|---|
| Persona | `qa-payout-seller@kidsmarketplace.test` / `TestPayout123!` |
| Auth user id | `a1234567-0000-0000-0000-0000000000f2` (fixed UUID) |
| Profile | completed; test-seller's node (`6bf728cf-…`); Kids Club+ **active** |
| Provision | `cd p2p-kids-marketplace && npm run qa:payout-fixture -- ensure` |
| Mobile login | `xcrun simctl openurl booted "p2pkidsmarketplace://qa-login-as?persona=qa-payout-seller"` |
| Cleanup | `npm run qa:payout-fixture -- reset` (keep persona) or `-- reset --full` (BP-70 delete user) |

> All writes go to STAGING via the service role (`p2p-kids-marketplace/.env` → `.env.staging`).
> `--dry-run` is fully read-only. The persona is DISPOSABLE — reset wipes its methods/payouts/
> fixture trades/items and re-reconciles the balance; it never touches other personas.

## Typical session

```bash
# 1. Provision / reconcile the persona (idempotent; re-signs the known password).
npm run qa:payout-fixture -- ensure

# 2. Method state (QA Task 34 method-group cases G04/G05/G09/G11/H04).
npm run qa:payout-fixture -- methods --scenario single-verified   # F01/H02/H03 base (one verified Stripe primary)
npm run qa:payout-fixture -- methods --scenario none              # H04 no-method NoMethodModal
npm run qa:payout-fixture -- methods --scenario single-unverified # G09-class unverified primary
npm run qa:payout-fixture -- methods --scenario two               # G04/G05/G11 (primary + verified secondary)
npm run qa:payout-fixture -- methods --scenario mixed             # Stripe primary + unverified PayPal secondary

# 3. Controlled available balance (H-series). Min-withdrawal floor on staging = 200c ($2.00).
npm run qa:payout-fixture -- balance --amount 500    # $5.00 → H03 positive withdraw / H07
npm run qa:payout-fixture -- balance --amount 150    # $1.50 → H06 below-min rejection (floor $2)
npm run qa:payout-fixture -- balance --amount 0      # H01 no-balance

# 4. Fresh completed trade → genuine payout row (F06). Auto-payout is ON with a 2-day buffer,
#    so the row is created status='pending' (release = completed_at + 2d).
npm run qa:payout-fixture -- stage-trade --amount 2000

# 5. REAL withdrawal (H03 positive) — drives production request_seller_payout as the persona
#    (persona JWT). Creates a real seller_payouts row (processing, trade_id NULL) + deducts
#    available. NO real outgoing transfer is minted (that is the safety QA needs).
npm run qa:payout-fixture -- withdraw --full          # withdraw the whole available balance

# 6. Read-only status.
npm run qa:payout-fixture -- status

# 7. Cleanup — remove this session's fixture rows (keep persona) or delete the persona.
npm run qa:payout-fixture -- reset
npm run qa:payout-fixture -- reset --full
```

## Reconcile test-seller's balance (DT-118 Item 2 companion)

`recompute_seller_balance` is now **service_role-only** (DT-118 migration
`20260905000003_dev_task_118_reconcile_seller_balance.sql`). Reset test-seller's inflated
`seller_balance` row to the real trade/payout-derived total:

```bash
npm run qa:payout-fixture -- reconcile --seller test-seller
# → available ~$140.40 / pending ~$442.60 / lifetime ~$583 / 25 trades (real data)
```

## Known boundaries (honest)

- **Method rows are DB-controlled, not real Stripe Connect accounts.** `request_seller_payout`
  checks DB `is_verified`/`is_primary` only and never mints an outgoing transfer — that is exactly
  the safety QA needs for H03/H06/H07. Real Stripe Connect **onboarding** E2E (G01) and observing a
  completed outgoing transfer remain a separate, real-account follow-up (the same boundary QA Task
  33 recorded).
- **stage-trade rows must be `reset` before the 2-day payout buffer elapses** so the fixture's
  pending payout rows are never auto-dispatched by `release-due-payouts` toward a synthetic account.
- The mobile Stripe sync (`sync-stripe-connect-status`) may mark a synthetic `stripe_account_id`
  unverified on-device; if a QA case needs the on-device method to stay "Verified & Active" for a
  full Stripe UI run, point the method at a real test Connect account (provision via
  `create-stripe-connect-account` as the persona) — flagged, not built by default.
