# QA Task 32 — Part 2 (SUB First Execution) — Scope Note (NOT EXECUTED this session)

Part 2 is a separate, large, first-execution body of work. Per the round brief's explicit split permission, it is **scheduled for its own dedicated session(s)** and was NOT compressed into the Part 1 ADM-closure session. This note captures the full scope + the fixture plan so the next session starts clean.

## Scope — 33 active SUB cases + ADM M03/M04 closure
Guide: `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
Reconciled active baseline (qa-task31b): **A05, D05, F01/F03/F04/F05/F06/F07/F08, G01/G04/G05/G06/G07/G08/G09/G10/G11, H01/H02/H03/H04/H06/H07, I06, K02, M01/M06/M07, N03/N04/N05/N06** (the "50 never-run" also includes 15 RETIRED + 2 N/A).
Plus **ADM M03/M04** (extend/cancel/reactivate → mobile Manage Kids Club+ reflection) per the standing R40 deferral.

## Fixture plan (build FIRST)
- Build ONE disposable **real subscription** (Stripe test-mode lifecycle: create-checkout-session → PaymentSheet test card → subscription row active; Stripe product `prod_VBjC4RZ6Q2gkqT` / price `price_1UBLkH4I6kCJlvXoq9xsDhuG` on acct_1ShGft4I6kCJlvXo, trial disabled).
- Apply the SAME disposable subscription to: SUB's subscription-lifecycle cases that need active/trial/grace states AND ADM M03/M04 (extend/cancel/reactivate + mobile reflection) — the round's one real synergy.
- Disposable-persona discipline (money movement): throwaway user + own Stripe customer/PI where the guide moves money; BP-70 cleanup; idempotency-key isolation (§5.36/§5.37).

## Disciplines to apply (mirror ADM rounds)
- DB read-back on EVERY money/config assertion (R54/§5.37 — e.g. subscriptions.status CHECK incl. grace_period/cancelled spellings, sp_wallets states).
- Mobile leg wherever the guide declares (or implies) mobile impact — **do NOT assume a SUB case is admin-only because it reads that way first pass; run SUB's own version of the ADM mobile-impact audit (R55/§5.57)**.
- §5.61 R58: audit every user-facing message surface for raw system content (SUB money/status strings are a known risk area — e.g. "Reason:" lines dumping backend codes).
- R59 fresh-fetch on backend changes; R60 batched dialog handling; §5.4 native PaymentSheet/Alert handling; R-16 fixture reset-first habits; R29 busy check on the shared simulator + admin session.

## Key reference memory
- `/memories/repo/qa-fixture-sub-sp-wallet-research-2026-09-03.md` (wallet/subscription fixture file map)
- `/memories/repo/subscription-price-fee-trial-authorities.md` (canonical $5.99/$1.49, trial OFF, Stripe ids)
- `/memories/repo/qa-test-accounts.md` (persona registry — qa-wallet persona exists: active Kids Club+ 100 SP; test-grace = grace)
- `/memories/repo/schema-cheat-sheet.md` (subscriptions.status CHECK values, sp_wallets CHECK)
- Dev-task-90/92/93/94/99 memories (subscription web checkout unblock, post-run fixes, billing-row grace config)
- `qa-task19/20/21/22-sub-*` run folders (prior SUB partial execution evidence, if any)
