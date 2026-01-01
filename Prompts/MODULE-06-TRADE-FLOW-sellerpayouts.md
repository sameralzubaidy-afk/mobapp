# MODULE 06 (EXT): SELLER PAYOUTS (Stripe + ACH + PayPal/Venmo)

**Total Tasks:** 12 (Phase 1: 8, Post‑MVP: 4)  
**Estimated Time:** Phase 1 ~24 hours, Post‑MVP ~14 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-06-TRADE-FLOW-V2 (Trades), MODULE-12 (Admin Panel), MODULE-14 (Notifications)  
**Last Updated:** December 24, 2025  
**Version:** 1.0

---

## Purpose

Close the payout loop after a trade completes by providing sellers multiple payout options:

- **Stripe Connect (Express)**
- **PayPal Payouts**
- **Venmo** (via PayPal Payouts)

**Fee policy:** Platform charges **$0 transaction fee**. Sellers pay **payout provider fees** (displayed transparently).

---

## Key Design Decisions

1. **Payout method choice is seller-controlled** (can change anytime; only one primary method).
2. **Payout is triggered on trade completion** (`completed`) and recorded in a payout ledger.
3. **If seller has no verified payout method**, payout is created in `requires_action` and seller is prompted.
4. **Idempotency is mandatory** for payout creation and provider calls.
5. **Provider webhooks update payout status** (`processing` → `completed`/`failed`).

---

## Phase Split

### Phase 1 (MVP)
- Payout method management (Stripe Express, PayPal, Venmo)
- Payout ledger + router
- Trade completion → payout trigger
- Webhook handlers (Stripe + PayPal)
- Seller earnings UI (minimal)
- Admin inspection UI (minimal)
- Core tests

### Post‑MVP
- Direct Bank Deposit (ACH) method (tokenized + verification)
- ACH payout processing + webhook/events
- Batching / scheduling improvements
- Robust retries and reconciliation tooling

---

## Non‑Goals (This Module)

- Buyer payment method UX (handled in trade flow)
- Escrow licensing / holding funds as a regulated custodian
- Multi-currency payouts
- Seller tax documentation UX beyond what providers supply

---

## Agent-Optimized Prompt Template (Claude Sonnet 4.5)

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read this entire module before generating code.
2. For each TASK, produce a 3–6 step plan and list missing dependencies.
3. Generate files exactly at the `filepath` locations.
4. Use environment variables for all secrets.
5. Use idempotency keys for all provider payout requests.
6. Add focused tests (Vitest) for payout routing, fee calculations, and idempotency.

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check`
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=payout`

ERROR HANDLING RULES:
- Never store raw bank routing/account numbers.
- Never store PayPal/Venmo credentials.
- If webhook verification cannot be implemented, stub with TODO and block production usage.
- All payout provider calls must be retriable and safe on duplicates.

KEY REQUIREMENTS:
- Platform transaction fee is $0.
- Seller pays payout provider fees (disclosed in UI and stored per payout).
- A payout record must exist for every completed cash trade.
- Webhooks must reconcile payout status.
```

---

## System Overview

### Concepts

- **Payout Method**: A seller-configured destination (Stripe Express account, PayPal email, Venmo handle/phone).
- **Payout Ledger**: Canonical record of every seller payout and its lifecycle.
- **Payout Router**: Determines which provider is used based on seller’s primary payout method.

### High-Level Flow

```text
Trade completed
  ↓
Create payout record (idempotent)
  ↓
If payout method missing/unverified → requires_action + notify seller
Else
  ↓
Call provider payout API (idempotent)
  ↓
Set payout status processing
  ↓
Webhook updates status completed/failed
```

---

## Data Model (V1)

### Payout Methods
- One user can have multiple payout methods.
- Exactly one method may be `is_primary = true`.
- Payout method must be `is_verified = true` before it can be primary.

### Payout Ledger Statuses
- `requires_action` (seller must set up/verify payout method)
- `pending` (created, not yet submitted)
- `processing` (submitted to provider)
- `completed` (provider confirmed)
- `failed` (provider failure; retry or action needed)

---

# PART 1 — PHASE 1 (MVP)

## Task Summary (Phase 1)

| Task ID | Description | Duration | Priority |
|--------:|-------------|----------|----------|
| PAY-001 | DB schema: payout methods + payout ledger | 3h | Critical |
| PAY-002 | Payout fee model + calculation helpers | 2h | High |
| PAY-003 | Seller payout setup UI (Stripe/PayPal/Venmo) | 4h | High |
| PAY-004 | Stripe Express onboarding (create account + link + webhook) | 4h | Critical |
| PAY-005 | PayPal/Venmo payout integration (Edge Function) | 5h | Critical |
| PAY-006 | Payout router + trade completion trigger | 3h | Critical |
| PAY-007 | Webhooks: Stripe + PayPal → update payout ledger | 2h | Critical |
| PAY-008 | Admin + Seller earnings views (minimal) | 1h | Medium |

---

## TASK PAY-001: Database Schema (Payout Methods + Payout Ledger)

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** Existing `users`, `trades` tables

### Description

Create tables to store:
- Seller payout methods (Stripe/PayPal/Venmo now; bank placeholders)
- Seller payout ledger records, linked to `trades`

### AI Prompt for Cursor

```sql
/*
TASK: Add payout methods and payout ledger tables

REQUIREMENTS:
1. seller_payout_methods table
2. seller_payouts table
3. Enforce single primary method per user
4. Link payouts to trades
5. Add minimal indexes for lookup and admin

==================================================
FILE: Migration
==================================================
*/

-- filepath: supabase/migrations/061_seller_payouts.sql

CREATE TABLE IF NOT EXISTS seller_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  method_type TEXT NOT NULL, -- 'stripe_connect', 'paypal', 'venmo', 'bank_ach'
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Stripe Connect (Express)
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- PayPal/Venmo
  paypal_email TEXT,
  venmo_handle TEXT,
  venmo_phone_e164 TEXT,

  -- Bank ACH (Post-MVP)
  bank_account_token TEXT,
  bank_account_last4 TEXT,
  bank_routing_last4 TEXT,
  bank_verification_status TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One primary payout method per user
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_methods_one_primary_idx
  ON seller_payout_methods(user_id)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS seller_payout_methods_user_id_idx
  ON seller_payout_methods(user_id);

CREATE TABLE IF NOT EXISTS seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  payout_method_id UUID REFERENCES seller_payout_methods(id) ON DELETE SET NULL,

  currency TEXT NOT NULL DEFAULT 'usd',

  gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  payout_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'pending',

  provider TEXT, -- 'stripe', 'paypal', 'ach'
  provider_reference_id TEXT,

  idempotency_key TEXT,

  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_payouts_user_id_idx
  ON seller_payouts(user_id);

CREATE INDEX IF NOT EXISTS seller_payouts_trade_id_idx
  ON seller_payouts(trade_id);

CREATE INDEX IF NOT EXISTS seller_payouts_status_idx
  ON seller_payouts(status);

CREATE UNIQUE INDEX IF NOT EXISTS seller_payouts_idempotency_key_idx
  ON seller_payouts(idempotency_key);

/*
ACCEPTANCE CRITERIA
- Tables created
- Enforced one primary payout method per user
- Payout records can be linked to a trade
*/
```

---

## TASK PAY-002: Payout Fee Model + Helpers

**Duration:** 2 hours  
**Priority:** High

### Description

Define a single source of truth for payout fees (seller-paid) and net calculation.

### Fee Policy (MVP)
- Stripe Connect (standard): `$0.25 + 0.25%`
- Stripe Connect (instant): `$0.50 + 0.5%` (optional toggle later)
- PayPal: `2%` (cap `$20`)
- Venmo: `2%` (cap `$20`)

### AI Prompt for Cursor

```ts
/*
TASK: Implement payout fee helpers

REQUIREMENTS:
1. getPayoutFeeCents(methodType, amountCents)
2. computeNetPayout(gross, platformFee, payoutFee)
3. make the fees dynamic and create a page for admin to view, update as needed. 
4. Unit tests

==================================================
FILE 1: Helpers
==================================================
*/

// filepath: src/lib/payoutFees.ts

export type PayoutMethodType = 'stripe_connect' | 'paypal' | 'venmo' | 'bank_ach';

export function getPayoutFeeCents(method: PayoutMethodType, amountCents: number): number {
  if (amountCents <= 0) return 0;

  switch (method) {
    case 'stripe_connect': {
      // 0.25% + $0.25
      return Math.round(amountCents * 0.0025) + 25;
    }
    case 'paypal':
    case 'venmo': {
      // 2% capped at $20
      return Math.min(Math.round(amountCents * 0.02), 2000);
    }
    case 'bank_ach': {
      // Post-MVP; placeholder
      return 25;
    }
    default:
      return 0;
  }
}

export function computeNetPayoutCents(grossCents: number, platformFeeCents: number, payoutFeeCents: number): number {
  return Math.max(0, grossCents - platformFeeCents - payoutFeeCents);
}

/*
==================================================
FILE 2: Tests
==================================================
*/

// filepath: src/lib/payoutFees.test.ts

import { describe, it, expect } from 'vitest';
import { getPayoutFeeCents, computeNetPayoutCents } from './payoutFees';

describe('payoutFees', () => {
  it('stripe_connect fee is 0.25% + $0.25', () => {
    expect(getPayoutFeeCents('stripe_connect', 10000)).toBe(25 + 25); // $100 * 0.25% = $0.25
  });

  it('paypal fee is 2% capped at $20', () => {
    expect(getPayoutFeeCents('paypal', 5000)).toBe(100);
    expect(getPayoutFeeCents('paypal', 200000)).toBe(2000);
  });

  it('net payout never goes negative', () => {
    expect(computeNetPayoutCents(1000, 900, 200)).toBe(0);
  });
});
```

---

## TASK PAY-003: Seller Payout Setup UI (Stripe/PayPal/Venmo)

**Duration:** 4 hours  
**Priority:** High

### Description

Add a seller-facing screen to:
- Choose payout method type
- Enter PayPal email / Venmo handle (and verify)
- Start Stripe onboarding
- Mark one method as primary

### AI Prompt for Cursor

```ts
/*
TASK: Seller payout setup UI

REQUIREMENTS:
1. Screen: PayoutSettingsScreen
2. List existing methods
3. Add method flows:
   - PayPal email (simple verification = email confirmation link OR minimal "verify later" flag)
   - Venmo handle/phone (verify later)
   - Stripe onboarding button
4. Set primary method

FILEPATHS:
- src/screens/seller/PayoutSettingsScreen.tsx
- src/services/payoutMethods.ts

ACCEPTANCE:
- Seller can add a method and set primary
- Primary method requires is_verified
*/
```

---

## TASK PAY-004: Stripe Connect Express Onboarding

**Duration:** 4 hours  
**Priority:** Critical

### Description

Implement Stripe Express onboarding:
- Create connected account
- Create onboarding link
- Receive webhook updates for `account.updated`
- Mark method as verified when payouts are enabled

### AI Prompt for Cursor

```ts
/*
TASK: Stripe Connect Express onboarding

REQUIREMENTS:
1. Edge Function: create-stripe-connect-account
2. Edge Function: create-stripe-account-link
3. Webhook: stripe-webhooks (verify signature)
   - account.updated: update stripe_onboarding_complete, stripe_payouts_enabled

FILEPATHS:
- supabase/functions/create-stripe-connect-account/index.ts
- supabase/functions/create-stripe-account-link/index.ts
- supabase/functions/stripe-webhooks/index.ts

NOTES:
- Store STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in env
- Use Express accounts
*/
```

---

## TASK PAY-005: PayPal/Venmo Payouts Integration

**Duration:** 5 hours  
**Priority:** Critical

### Description

Create an Edge Function that submits PayPal Payouts for PayPal/Venmo payout methods and stores provider references.

### AI Prompt for Cursor

```ts
/*
TASK: PayPal/Venmo payouts

REQUIREMENTS:
1. Edge Function: process-paypal-payout
2. Input: payoutId
3. Look up seller_payouts + payout_method
4. Call PayPal Payouts API
5. Store batch/item ids in seller_payouts.provider_reference_id
6. Mark status processing
7. Webhook will reconcile final status

FILEPATHS:
- supabase/functions/process-paypal-payout/index.ts

SECRETS:
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYPAL_WEBHOOK_ID (for verification)

ACCEPTANCE:
- Idempotent: repeated calls do not duplicate payout
*/
```

---

## TASK PAY-006: Payout Router + Trade Completion Trigger

**Duration:** 3 hours  
**Priority:** Critical

### Description

On trade completion (manual or auto-complete), create a payout record and dispatch to provider.

### AI Prompt for Cursor

```ts
/*
TASK: Payout router + trade completion integration

REQUIREMENTS:
1. When trade status transitions to completed:
   - Create payout record if not exists (idempotency_key = `trade:<tradeId>:seller:<sellerId>`)
   - Determine primary payout method
   - If missing/unverified: set payout status requires_action, notify seller
   - Else route:
     - stripe_connect: record provider=stripe and rely on connect transfer flow OR mark completed if using destination charges
     - paypal/venmo: enqueue call to process-paypal-payout
2. Update payout amounts:
   - gross_amount = seller cash proceeds basis (trade.cash_amount minus platform fee model)
   - platform_fee = 0 for platform transaction fee policy OR trade fee field if it exists
   - payout_fee = seller-paid provider fee
   - net_amount = gross - platform_fee - payout_fee

FILEPATHS:
- src/services/payouts.ts
- supabase/functions/trigger-seller-payout/index.ts (optional)

NOTE:
- This module assumes platform transaction fee is $0; ensure the calculation aligns with current trade schema.
*/
```

---

## TASK PAY-007: Webhooks (Stripe + PayPal) → Reconcile Payout Ledger

**Duration:** 2 hours  
**Priority:** Critical

### Description

Implement webhook receivers to update `seller_payouts` status.

### AI Prompt for Cursor

```ts
/*
TASK: Webhook reconciliation

REQUIREMENTS:
1. Stripe webhook:
   - payout.created/updated/paid/failed (connected accounts)
   - Map to seller_payouts by metadata/provider_reference_id
2. PayPal webhook:
   - payout item succeeded/failed
   - Update seller_payouts status
3. All handlers must be signature-verified

FILEPATHS:
- supabase/functions/stripe-webhooks/index.ts
- supabase/functions/paypal-webhooks/index.ts
*/
```

---

## TASK PAY-008: Minimal Admin + Seller Earnings Views

**Duration:** 1 hour  
**Priority:** Medium

### Description

- Seller view: list payouts (last 20), status, net amount, method
- Admin view: searchable payouts by seller/trade/status

### AI Prompt for Cursor

```ts
/*
TASK: Minimal UI for payouts

REQUIREMENTS:
1. Seller screen: EarningsScreen
2. Admin screen: AdminPayoutsScreen (table/list)

FILEPATHS:
- src/screens/seller/EarningsScreen.tsx
- src/admin/components/PayoutsTable.tsx
*/
```

---

## TASK PAY-009 - make the required intergration to complete payout method validations. 

## TASK PAY-010 - I have to decide direct payout after completing or hold and then request payout. 

## TASK PAY-011 - Update the reqs docx with these changes. 
---

## Acceptance Criteria (Module)

- Seller can configure payout via Stripe Connect / PayPal / Venmo (MVP)
- Every completed cash trade produces a payout record or a `requires_action` placeholder
- Payout fee is computed and stored; seller pays it
- Webhooks update payout status reliably and securely
- Admin can inspect payouts and trigger manual retry

---

## Open Implementation Notes (Agent Must Validate)

- Confirm current trade schema fields for seller proceeds vs fees in `MODULE-06-TRADE-FLOW-V2.md`
- Confirm whether the platform uses destination charges (automatic routing) or separate transfers; align PAY-006 accordingly
- Confirm PayPal payout recipient identifiers for Venmo (handle vs phone) and required format
- Confirm webhook verification requirements for both Stripe and PayPal in your environment
