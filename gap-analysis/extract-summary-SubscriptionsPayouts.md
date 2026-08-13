# Candidate Extraction Summary — Subscriptions/Payouts/SP Wallet

**Phase 2.2d** | **29 files processed**

## Breakdown

| Domain | Files | Notes |
|---|---|---|
| Subscriptions | 17 | Trial, payment, cancel, grace, billing, webhooks |
| Payouts | 4 | Methods, Stripe, PayPal, fees |
| SP Wallet | 3 | Wallet UI, config, transaction history |
| Other (docs, p2p) | 5 | PROD fixes, SP logic |

## Key Findings

1. **SUB-009 and SUB-009-UPDATED are duplicates** — first 30 lines identical
2. **SUB-001 is DB schema only** — not manual tests
3. **MANUAL_TEST_PAY-002 is config checks** — not manual UI tests
4. **PROD-001-002 and PROD-003-005 are build/RLS verification** — not manual tests
5. **SP-002 and SP-003-004 from p2p-kids-admin** are SP logic tests — may have backend-only content
