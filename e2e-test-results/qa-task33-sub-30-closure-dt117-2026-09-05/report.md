# QA Run Report — SUB 30-closure (partial) + DT117 visual confirm + M03/M04 audit re-verify

**Run folder:** `e2e-test-results/qa-task33-sub-30-closure-dt117-2026-09-05/`
**Date:** 2026-09-05 · **Device:** iPhone 17 Pro Max sim `3F3293A3` (iOS 26.1) · **Build:** Dev Task 117
**Personas used:** test-free, qa.alice.1788646329130763 (disposable real sub `bb862192`), test-seller (`14be337c`), test-buyer, admin (samer)
**Surfaces:** mobile (simulator) + admin portal (`:3001`) + DB read-back

---

## Batch 0 — Dev Task 117 visual confirmation — 4/4 PASS

| Item | Verdict | Evidence / trace |
|---|---|---|
| **Item 7** free-user SP Wallet upsell card → JoinKidsClub | ✅ PASS | test-free → SP Wallet (`sp-wallet` deep link): 0-SP hero (`sp-wallet-balance-amount` = 0), `sp-wallet-join-kids-club-card` renders "Join Kids Club+ to start earning Swap Points" + "Kids Club+ members earn SP on every sale and referral."; tap → JoinKidsClub (Kids Club+ value-prop). Card style `#F0FBF5` bg + `#5DBB8E` border/icon (on-brand). No lock overlay / no WalletWarningBanner. This is the **rewritten SUB-TC-I06 assertion — resolves the DOC-DRIFT** (guide now matches live; I06 can be marked PASS). Shot: `SUB-I06-free-sp-wallet-upsell-card.png` |
| **Item 6** admin BadgeEditor Remove Icon | ✅ PASS | `/badges` → uploaded `favicon.png` to SP Spender - Bronze (`510cd0b9`, was icon-less) via the server upload route → **`badge-editor-icon-remove` (Remove Icon) button appeared** (only renders when `icon_url` set) → clicked (confirm override) → DB `icon_url` NULL + `badge-icons` storage object deleted + `badge_audit_logs` row `config_change` "Icon removed from admin portal" actor `1a546991`. Badge left icon-less (0 residue). **BONUS: badge-icon UPLOAD now works — QA32-P1 P02's upload-RLS MED defect is RESOLVED.** Shots: `ADM-item6-badge-editor-remove-icon-visible.png` |
| **Item 8** `/subscriptions/manage` grace UI + ⓘ cancel-reason detail + Reactivate clears reason | ✅ PASS | Admin-Cancelled disposable sub `bb862192` (active→grace) → row shows **human "Grace Period" label** + cancel_reason "Admin override" + **ⓘ `Manually cancelled by 1a546991-… on Sep 5, 2026 (Admin override)`** (sourced from the DT117 audit row). Admin Reactivate → row Active, cancel-reason "—", ⓘ gone; DB `cancel_reason` NULL. Shot: `ADM-item8-grace-row-cancel-detail.png` |
| **M03/M04 audit re-verify** (Cancel/Reactivate/Extend-Trial → real audit rows) | ✅ PASS | All three actions via the real admin client (browser UI, window.confirm/prompt overrides): Extend Trial on trial row `e0d1766e` (+7d → ends 9/14) → `admin_audit_logs` row `bdf30c52` `trial_extended`, actor `1a546991`; Cancel `bb862192` → `5a328de9` `subscription_manually_cancelled`; Reactivate → `0b0eae02` `subscription_reactivated`. **All rows have the real admin actor (NOT `system`, NOT null)** — correct action_type/entity_type/entity_id/payload. M04 mobile reflection: qa.alice Manage Kids Club+ showed **Active** after admin Reactivate. |

**LOW note (item 8):** the ⓘ actor renders as the raw admin UUID (`1a546991-…`) because `admin_audit_logs` stores only `actor_id` (no name/email join available to the manage page for this row) — the detail falls back `actor_id` when `actor_name/email` are absent. Functionally correct; cosmetic.

---

## Batch 1 — SUB-TC-D05 In-App Reactivate (retained disposable sub) — PASS + NEW MED wallet finding

**Setup:** disposable real Stripe sub `qa.alice.1788646329130763` / `bb862192` (retained from QA Task 32). Added a saved card first (mobile Payment Methods → Stripe sheet → saved VISA 4242 → "Payment Method Saved"; DB `stripe_payment_method_id pm_1UCRto4`) — the in-app Re-subscribe is PM-gated. Shot: `SUB-M02-M03-disposable-saved-card.png`.

**Drive:** admin Cancel `bb862192` → DB `grace_period` (grace_ends 10-05). Mobile Manage Kids Club+ → **Status "Grace Period"** + "Grace Period Active / Your Swap Points are frozen. Re-subscribe before October 5, 2026…" → tapped **"Re-subscribe to Kids Club+"** → `renew-subscription` EF → alert **"Subscription Renewed / Subscription renewed successfully. Your Swap Points are now available."**

**DB verified:** `subscriptions` = **active**, `cancel_reason` NULL, `grace_ends_at` NULL, **new** Stripe sub `sub_1UCSzT4` (old `sub_1UCRtq4` cancelled), period → 2026-10-05. D05 core assertion (sub returns to Active + messaging confirms) **PASS**.

### 🔴 NEW MED finding (money/state — R11/R24 class)
After the successful in-app resubscribe, **`sp_wallets.state` = `grace_period`** (updated `23:27:20` = the renewal EF write; it was `active` at session start and the admin cancel/reactivate handlers do NOT touch `sp_wallets` — source-verified). The mobile SP Wallet for the (now-active) user still renders the **"Grace Period Active — …you won't earn new ones until you renew"** banner, directly contradicting the success alert "Your Swap Points are now available." The `renew-subscription` EF's step-9 unfreeze (`rpc_set_sp_wallet_state 'active'` — the RPC exists with matching args) did NOT take effect (deployed-vs-repo drift suspected; `function_edge_logs` queries errored this session). An active subscriber whose wallet is stuck in `grace_period` can't earn new SP and the wallet could later freeze. Shot: `SUB-D05-post-reactivate-wallet-still-grace.png`. **Dev follow-up required** (keep `bb862192` intact as the repro fixture).

---

## Batch 2 — SUB F/G/H Payout Domain (deferred 30's core) — executed drivable subset

### Fixture engineering findings (the brief's core blocker)
1. **`seller_balance` data-integrity issue (R54 class):** test-seller's `seller_balance` row = available **$15,603.00** / pending $393 / lifetime $15,996 / 790 "completed trades" — **does NOT reconcile** with the real underlying data (25 completed trades / $583 cash; 25 `seller_payouts` rows / $462 gross). Not seed-populated (seed has no `seller_balance` write). The app **trusts** `seller_balance` when non-zero → mobile shows the inflated figures. A seller's displayed withdrawable balance is materially wrong. (updated 2026-09-05 22:00 by an unknown process.)
2. **No natural method-state fixtures:** only 2 sellers have payout methods (test-seller + `seller2bob`), each a **single** primary+verified `stripe_connect`. No 2-method, no unverified-method, no no-method-with-balance seller → **G04/G05/G09/G11/H04 are fixture-gated**.
3. **No QA-buildable balance-state control:** `seller_balance`/`seller_payouts` are financial tables with no execution-only write path; a controllable small available balance (H-series), a fresh completed-trade→payout (F06), and the empty-history state (F05) require a **dev-provided QA fixture** (r41-style `qa:payout-fixture` that provisions a dedicated seller with controlled trades/payouts/methods + can reset test-seller's inflated `seller_balance`).
4. **Tooling friction:** Payout Settings ScrollView resists mobile-mcp swipes (~7pt over 8+ swipes, bounces to top) → the below-fold **Load More** control (which also has **no `testID`** — bare `TouchableOpacity`, §5.22) was unreachable → F08/G10 pagination tap not drivable this session.

### On-device verdicts (test-seller, Payout Settings)
| TC | Verdict | Evidence |
|---|---|---|
| **F01** hero Available/Pending/Lifetime + Withdraw Now | ✅ PASS | `$15,603.00` avail / `$393.00` pending / `$15,996.00` lifetime + `request-payout-btn`. Shot `SUB-F01-hero.png`. (figures from inflated `seller_balance` — finding above) |
| **F02** (already PASS) method section | ✅ reconfirm | Stripe • Verified & Active • `acct_****D914` + Add Another Method |
| **F03** payout history list | ✅ PASS (note) | 5 rows: amount + Pending status + date + `Fee: $X.XX`. Data has no completed/failed rows so icon variants not shown |
| **F04** earnings + per-payout net/fee | ✅ PASS (note) | hero 3 figures + per-row net + `Fee:` lines |
| **F08** history Load More | 🟡 PARTIAL | DB has 25 payouts (pagination precondition ✓); first-5 page renders; **Load More tap blocked** by scroll-resistance + no testID (tooling/locator gap) |
| **G07** Edit Details sheet | ✅ PASS | method kebab → Edit Details → alert "Editing payout method details is not yet available. Contact support for changes." (exact guide copy) |
| **G08** Cannot-Delete guard | ✅ PASS (nuance) | Delete on the single primary method → **"Cannot Delete Primary Method"** (primary guard fires first — source-verified `is_primary` check precedes the `methods.length<=1` check). The guide's separate "Cannot Delete Only Method" copy is **unreachable** when the only method is primary |
| **G10** history Load More | 🟡 PARTIAL | same as F08 |
| **H02** WithdrawModal summary | ✅ PASS | "Withdraw Funds": Available $15,603.00 / Payout Fee **-$39.26** (= $0.25 + 0.25%×15,603 ✓) / You'll Receive **$15,563.74** ✓ / Payout Method Stripe (`acct_****D914`) / no amount field. Cancel dismissed clean. Shot `SUB-H02-withdraw-modal.png` |

**Not driven (fixture/tooling-gated, with reasons):** F05 (no no-payout seller), F06 (needs fresh completed-trade→payout + `pending_sp_release_days` write on a controlled fixture), F07 (forced-offline load failure not cleanly drivable), G01 (real Stripe Connect onboarding), G04/G05/G09/G11/H04 (method-state fixtures — dev QA-fixture needed), G06 (its `requires_action` payout is deep in the 25-row list, scroll-blocked), H01 (test-seller has a balance), H03 (needs a controlled small balance; driving it on the inflated $15,603 would mint a bogus transfer), H06/H07 (need small-balance fixtures around a `minimum_withdrawal_amount_cents` floor).

---

## Batch 3 — K02, M01, M06, M07, N04-N06

| TC | Verdict | Note |
|---|---|---|
| **N04** ContinueKidsClub active variant | ✅ PASS | test-buyer → `continue-kids-club` deep link → "✅ Kids Club+ Active / Your subscription is already active and your premium benefits are available." + Go Back. Shot `SUB-N04-continue-active.png` |
| **N05** ContinueKidsClub loading state | ✅ source-confirmed | `loadingStatus` branch renders `LoadingSpinner` + "Loading..." (transient; not screenshot-captured) |
| **N06** ContinueKidsClub trial-ending badge | 🟡 BLOCKED (fixture) | needs a **≤7-day trial** persona with a mobile session; none exists on staging (trial rows are web fixtures; cd4b766b has 16 days). Needs a trial fixture or fast-clock |
| **K02** Transaction History empty + error/retry | 🟡 PARTIAL | empty state = test-free already PASS (E02 surface); error/retry leg needs a forced fetch failure (no clean QA toggle observed) |
| **M01** Payment Methods loading state | ✅ source-confirmed | transient "Loading payment methods..." spinner on mount; not separately screenshot-captured |
| **M06** Payment Methods Go Back | ✅ AX-verified | `pm-back-button` present on both empty + saved-card states (disposable); returns to Settings (not re-driven this session — persona-login cost) |
| **M07** backend attach/detach contract | 🟡 PARTIAL | **attach branch driven for real** on the disposable (add card → `create-payment-setup-intent`/`attach-payment-method` → "Payment Method Saved" alert — the NO_FAILED_PAYMENT variant; DB `stripe_payment_method_id` set). Detach/remove branch NOT driven (would remove test-buyer's shared card or need another disposable login) |

---

## Cleanup / App State Left Behind
- **Disposable sub `bb862192` (qa.alice.1788646329130763):** left **intact in ACTIVE state** (sub `sub_1UCSzT4`, saved card `pm_1UCRto4`, wallet stuck `grace_period`) — **intentionally retained as the repro fixture for the D05 wallet-unfreeze MED finding** (dev must investigate before the BP-70 delete: cancel Stripe sub `sub_1UCSzT4` + old `sub_1UCRtq4`, delete customer `cus_VCrdqxD3h22hQO`, `admin.deleteUser bb862192`, delete child rows).
- **e0d1766e** (sub003-e2e-isolated trial): trial extended +7d → ends 2026-09-14 (M03 audit-leg residue on a disposable QA trial row).
- **Badge `510cd0b9`:** icon uploaded then removed → back to icon-less (original state, 0 residue). `badge_audit_logs` upload+removal rows are legitimate audit.
- **Admin audit rows:** `trial_extended` bdf30c52, `subscription_manually_cancelled` 5a328de9, `subscription_reactivated` 0b0eae02 (all actor `1a546991`) — legitimate.
- test-seller / test-buyer / test-free left at their pre-run states (no shared-state mutations; no withdrawal was confirmed).
- Simulator left on Landing (logged out).

---

## Cross-cutting findings (ranked)
1. **MED — renew-subscription EF leaves SP wallet in `grace_period` after a successful in-app reactivation** (Batch 1) — the success alert says SP is available while the wallet banner still shows Grace Period Active for an active member. Root cause: deployed EF's R6 wallet-unfreeze step not effective (repo step 9 → `rpc_set_sp_wallet_state 'active'`; RPC verified present). Dev: compare deployed vs repo EF + confirm the unfreeze fires on success.
2. **MED — test-seller `seller_balance` row is wildly inflated** ($15,603 avail / 790 trades vs real 25 trades/$583, 25 payouts/$462) and the app trusts it → mobile shows a materially wrong withdrawable balance (R54). Dev: reconcile/reset the row (via `recompute_seller_balance` or a fixture reset).
3. **MED/UX — WithdrawModal "Payout Fee:" label is ambiguous** (owner fix record #3): it shows Stripe's processor fee ($0.25 + 0.25%) under the bare label "Payout Fee", which a user can mistake for a Pass It Up platform charge. Fix: name the method + clarify it is charged by the payout provider, not the platform (concrete rewrite above).
4. **MED/UX — Payout-history Load More is occluded by the floating nav bar** (owner fix record #2): it renders in the tab-pill band with no pill-clear inset, so it can't be tapped without scrolling content that barely scrolls → F08/G10 blocked + real users can't paginate easily. Fix: pill-height content inset + testID.
5. **LOW — `/subscriptions/manage` ⓘ actor renders as raw UUID** when the audit row has no actor name/email.
6. **LOW — Load More (payout history) has no testID** (instrumentation).

## Honest scope note — withdraw payouts were NOT driven E2E this round (positive confirm + negative scenarios)
Only the WithdrawModal summary (H02) was verified and then Cancelled. SUB-TC-H03 (Confirm Withdrawal → real payout row + Stripe transfer + balance refresh) and the negative withdraw scenarios (H01 no-balance, H04 no-method NoMethodModal, H06 min-withdrawal rejection, H07 min-disabled success) were **not** executed — they remain in the Remaining set, gated on a controlled-balance/method fixture (a QA can't safely confirm a withdrawal against test-seller's inflated $15,603 display). Driving withdraw E2E positive + negative on a proper fixture is a **committed next-session item** (see What-Needs-Fixing #3 + Suggested Next Session).

---

## Owner notes from this run (embedded) + fix records

**1. Withdraw-payouts E2E (positive + negative) — NOT tested this round (explicit, honest).**
Only the WithdrawModal **summary** (H02) was verified — the user opened it, the fee math was checked, and **Cancel** was used (no withdrawal created). The **positive confirm E2E (H03: Confirm Withdrawal → real `seller_payouts` pending row + Stripe transfer + balance refresh) and the negative scenarios (H01 no-balance alert, H04 no-verified-method NoMethodModal, H06 minimum-withdrawal rejection, H07 minimum-disabled success) were NOT driven.** Reason: they require a controlled small balance + method-state fixture, and confirming H03 against test-seller's inflated `seller_balance` ($15,603 displayed vs ~$140 real) would have minted a bogus $15,603 test transfer on a shared persona. **This is a committed follow-up** — withdraw E2E positive + negatives must be driven on a controlled-balance fixture (the `qa:payout-fixture` in What-Needs-Fixing) before the H-group can be closed. Recorded in the tracker as the remaining H01/H03/H04/H06/H07 rows.

**2. FIX RECORD — Load More overlaps the floating nav bar (UI/occlusion defect).**
Owner observation (confirmed in `SUB-F01-hero.png` / the Payout Settings screenshot): the PAYOUT HISTORY list runs to the bottom of the screen and the floating tab pill overlaps it; the **Load More** control renders as the ScrollView's last child (`PayoutSettingsScreen.tsx` `loadMoreButton`, `paddingVertical:16`, no pill-clear inset) directly in the tab-bar band (~y848–904), so it is **occluded by the nav bar** until the content is scrolled — and the screen's ScrollView resists scrolling, making Load More effectively unreachable by tap. This is the R31/R17 floating-pill-overlap class. **Fix:** add pill-height bottom inset to the Payout Settings ScrollView content (e.g. `paddingBottom` ≈ the floating-tab height, ~110–120pt) so Load More scrolls clear of the pill band; add a `testID` to Load More (already a separate locator-gap item). This is the concrete root cause behind F08/G10's PARTIAL.

**3. FIX RECORD — "Payout Fee:" label must say it is the payment-method/processor fee, not a platform fee (copy/trust clarity).**
Owner observation (confirmed in `SUB-H02-withdraw-modal.png` / the WithdrawModal screenshot): the modal shows **"Payout Fee: -$39.26"** with no clarification of what the fee is. Source: `PayoutSettingsScreen.tsx` L859 renders the bare label "Payout Fee:" for `calculatePayoutFee(method_type, available)` (`sellerBalance.ts` = Stripe **$0.25 + 0.25%**; PayPal/Venmo 2% capped $20). This is the **Stripe/payment-processor transfer fee** — the platform fee was already deducted from earnings before the available balance — so a parent/seller reading "Payout Fee" can reasonably mistake it for another Pass It Up platform charge. **Fix:** label the fee by method + clarify the processor (e.g. **"Stripe fee (payment method):"** with a sub-line "Charged by your payout provider — not by Pass It Up", or append the method to the existing label). Concrete rewrite suggestion: `Payout processing fee (Stripe): -$39.26` + footnote `This is the fee your payout provider (Stripe) charges to send the transfer; Pass It Up charges no withdrawal fee.`

**4. UX ENHANCEMENT RECORD — ContinueKidsClub "already active" state is a blank, dead-end screen (owner observation, `SUB-N04-continue-active.png`).**
An active member who reaches `ContinueKidsClub` (a registered deep link / reached from web-join or upsell surfaces) lands on a **near-empty white page**: one centered line ("Your subscription is already active and your premium benefits are available.") and a single green-outline **Go Back** — no app title/header, no benefits recap, no Manage link, no primary next action. It reads as an unfinished screen and gives the user no way forward except Back. **UX-enhancement idea (non-blocking, forward-looking):** enrich the active state to be a helpful "you're all set" landing — e.g. a compact benefits/value recap, a **Manage Kids Club+** action (deep link `manage-kids-club` → status/next-billing/auto-renew), and a proper title/header so a member who lands here (e.g. after a checkout or an upsell tap) has a clear next step instead of a dead end.

## How to verify
- Evidence screenshots in `screenshots/` (named `SUB-*`/`ADM-*` above).
- D05 wallet finding: log in as `qa.alice.1788646329130763` (password per dev-autofill registry), SP Wallet → Grace banner while Manage shows Active; or DB `SELECT state FROM sp_wallets WHERE user_id='bb862192-…'` (grace_period) vs `SELECT status FROM subscriptions WHERE user_id='bb862192-…'` (active).
- seller_balance inflation: `SELECT available_balance_cents FROM seller_balance WHERE user_id='14be337c-…'` (1,560,300) vs `SELECT count(*),sum(cash_amount_cents) FROM trades WHERE seller_id='14be337c-…' AND status='completed'` (25 / 58300).
- Audit rows: `SELECT actor_id,action_type,entity_id FROM admin_audit_logs WHERE entity_id IN ('bb862192-…','e0d1766e-…') ORDER BY created_at DESC`.

## §8.3 QA Session Handoff — see the final chat message (complete block emitted verbatim there).
