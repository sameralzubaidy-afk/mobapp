# QA Task 31-M Round 3 — Run Plan (session notes)

Run folder: `e2e-test-results/qa-task31m-r3-adm-fg-dispute-q-2026-09-05/`
Date: 2026-09-05 · Build: Dev Task 112 · Guide: MODULE-ADMIN-PORTAL-MANUAL-TESTING.md
Device: iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` · Admin portal `:3001` (shared browser page 4f0be003) · Metro `:8081` · Staging `drntwgporzabmxdqykrp`

## Batches
- **A (quick):** ADM-TC-C12 formal re-verify (category Toys → DB-exact 1038-ish; seller-email → 274) + ADM-TC-L07 (freeze wallet → SP input genuinely ABSENT on offer screen w/ notice). Flip PARTIAL→PASS.
- **B:** F03/F05/F06/F08 changed-value enforcement vs LIVE in-progress trade via `qa:r41-in-progress-trade create --with-auto-complete` (hasFlag fixed DT112). DB-verify + reset.
- **C:** Dispute-resolution mobile reflection — stage `qa:r41-dispute open`, drive I03 (resolve complete), I04 (resolve refund), X06 (mark under review) from admin, confirm BOTH parties' mobile timelines reflect. DB-verify + reset.
- **D:** Q-group — confirm which Q-IDs got genuine mobile-verified commit legs in QA31-T v2 (answer: Q02 Hide + Q03 Keep only). Execute Q01/Q04/Q05/Q06 against a fresh `qa:r41-review create` fixture + mobile review-display reflection.
- **Cleanup:** all fixtures reverted/deleted + config restored, DB-verified.
- **Deliverable:** full §8.3 handoff + precise ADM before/after PASS/PARTIAL counts.

## Confirmed pre-flight facts
- `admin_search_listings_v2` is now the 7-arg signature WITH p_category + p_seller_email (DT112 fix live on staging). Counting = all items (any status) where lower(category.name)=lower(p_category) AND seller auth.users.email ILIKE %seller_email%.
- `get_user_sp_wallet_summary` returns wallet_state.
- TradeOfferScreen gates `sp-amount-input` on `canSpendSPNow` (wallet_state active/grace) — DT112 item 2/8 fix in source + unit test. L07 should now show SP input genuinely ABSENT when frozen.
- `hasFlag` double-dash bug FIXED in r41-common.mjs (DT112 item 3) → `--with-auto-complete` now works.
- Tracker before-state: C12 = 🟡 PARTIAL, L07 = 🟡 PARTIAL; F03/F05/F06/F08, Q01–Q06, I03/I04, X06 = ✅ PASS (admin+DB only, mobile leg OWED).

## Friction / facts log (R16)
- (populated as run proceeds)
