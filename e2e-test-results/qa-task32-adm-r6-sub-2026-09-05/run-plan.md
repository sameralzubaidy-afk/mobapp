# QA Task 32 — Part 1 (ADM R6 Final Closure) + Part 2 (SUB First Execution) — Run Plan

Run folder: `e2e-test-results/qa-task32-adm-r6-sub-2026-09-05/`
Device: iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` · Admin `:3001` (shared page) · Staging `drntwgporzabmxdqykrp`

## Part 1 — ADM Final Closure (QA Task 31-M Round 6)
- Batch A: E02/E05 via fresh-signup fixture (ZIP 90210 waitlist join → admin /waitlist E05 → admin /nodes E02 add+edit → fresh user resolves to new node)
- Batch B: C09 (Request Edits on a pending item → needs_edits → seller mobile ListingSafetyReview) + X05 (flagged item → Action Center inline approve → buyer mobile visible)
- Batch C: G04 policy publish via DT109 restore affordance (one-persona re-prompt blast)
- Batch D: P01/P02/P03 badges (list+toggle, edit+icon upload, manual award → mobile profile)
- Batch E: R03 education/FAQ publish → mobile Help
- Batch F: O04 ID verification request details (screenshot-deleted note)
- Batch G: X07 failed-payout retry (qa:failed-payout fixture)
- M03/M04: held for Part 2 (disposable subscription)

## Part 2 — SUB First Execution (QA Task 32)
- Build one disposable real subscription (Stripe test-mode) → M03/M04 (admin extend/cancel/reactivate → mobile Manage Kids Club+)
- 33 active SUB cases: A05, D05, F01/F03–F08, G01/G04–G11, H01–H04/H06/H07, I06, K02, M01/M06/M07, N03–N06

## Fixture-state baseline (2026-09-05, DB-verified)
- platform_policies: liability published (4f41639e); ToS published (94075bb9) + 3 drafts; privacy published
- badges 13 · user_badges 4298 · id_badge_requests: pending 24 / approved 21 / rejected 32
- faq 11 published · education_sections 4 published · education_examples 3 draft
- seller_payouts: 0 failed / 35 pending
- zip_waitlist 9 pending · nodes 6
- test-seller: 25 available (QA bundle/canned fixtures) · test-buyer: 30 pending items
