# Phase 3 — Proposed Canonical Changes (awaiting approval)

**Date:** 2026-08-12
These are the NOT-COVERED / COVERED-PARTIAL merges identified from the ~12 partially-absorbed + re-mapped files. Nothing below has been applied yet.

---

## A. Account/Dashboard/Help/Legal — Group J (Legal) additions

From `SAFETY-010/011/012`.

| New TC | Description | Source |
|---|---|---|
| TC-J06 | Signup implies TOS + Privacy agreement (no mandatory dialog) | SAFETY-010 |
| TC-J07 | Legal screen unavailable state (no published policy) | SAFETY-010/011 |
| TC-J08 | Legal screen load failure — error + Retry | SAFETY-010 |
| TC-J09 | Very long policy content renders + scrolls smoothly | SAFETY-010 |
| TC-J10 | Legal screens render consistently iOS + Android | SAFETY-011 |
| TC-J11 | Legal screen loads < 2s, no scroll lag | SAFETY-011 |
| TC-J12 | Liability Disclaimer unavailable state | SAFETY-012 |

**Amendments (fold detail into existing):**
- `TC-J03` — add: version number + effective date displayed; markdown formatting rendered
- `TC-J05` — add: draft versions never visible to end users
- `TC-A04` — add: back-stack returns work for every legal/help row

---

## B. TradeFlowV2 — Group I (Safety UX) additions

From `SAFETY-012` (trade-time liability disclaimer modal — a genuine cross-canonical gap).

| New TC | Description |
|---|---|
| TC-I06 | Liability disclaimer modal gates purchase — checkbox + "Accept & Continue" |
| TC-I07 | Disclaimer modal Cancel path — no trade created |
| TC-I08 | Disclaimer modal ✕ close behaves like Cancel |
| TC-I09 | Disclaimer checkbox resets on reopen |
| TC-I10 | Disclaimer modal loading state |
| TC-I11 | Disclaimer modal not shown for non-trade actions |

**Also:** add deferral marker to `TC-A03` (platform-SP cash reward is deferred, per DEFERRED file — currently missing the note that TC-A04 already has).

---

## C. Subscriptions/Payouts — Group B (Trial/Payment) additions

From `SUB-015-verification`.

| New TC | Description |
|---|---|
| TC-B09 | User cancels the Stripe payment sheet — no error, retry available |
| TC-B10 | Card declined — clear error + retry |
| TC-B11 | Re-subscribe reuses saved payment method (1-click) |
| TC-B12 | Network error during payment — retry succeeds |
| TC-B13 | Apple Pay / Google Pay payment |

**Amendments:**
- `TC-E01` — add: description "Kids Club+ Subscription" + green "Succeeded" badge
- `TC-E04` — add: trial end date, next billing date, auto-renew flag

---

## D. Admin Portal — Group L (SP Wallet) expansion

From `ADMIN-V2-003-SP-WALLET` (25 cases).

| Change | Detail |
|---|---|
| Enrich TC-L03 | economy metrics (7 tiles), search by UUID/email, not-found + invalid-UUID errors, ledger capped at 100 |
| Enrich TC-L04 | insufficient-balance block, empty-reason, zero-amount validations |
| Enrich TC-L05 | frozen/suspended backend enforcement + AuthContext can_spend_sp |
| NEW TC-L06 | SP Wallet entry points (home card, summary metrics, sidebar link) |
| NEW TC-L07 | SP Wallet state RPC `get_user_sp_wallet_summary` returns wallet_state |
| NEW TC-L08 | SP Wallet warning banners (frozen/suspended/grace) |

---

## E. Admin Portal — Group E (Waitlist) expansion

From `MANUAL-TEST-WAITLIST-PAGE` (10 cases).

| Change | Detail |
|---|---|
| Enrich TC-E05 | search by email + ZIP, combined filters, pagination, display-name fallback, empty state |
| NEW TC-E08 | Waitlist API authorization (401 without admin session) |

---

## F. Auth/Onboarding — NEW Group Q (Trading Education, End User)

From `EDU-003` (mobile cases). The canonical currently has NO education group.

| New TC | Description |
|---|---|
| TC-Q01 | Education Help screen — published sections only |
| TC-Q02 | Education Help screen — section by type |
| TC-Q03 | SP calculator — sell mode (no hardcoded rates) |
| TC-Q04 | SP calculator — buy mode (cash + fee + cap) |
| TC-Q05 | SP calculator — bonus categories + example SP |
| TC-Q06 | Education analytics — event tracking (no throw) |
| TC-Q07 | Education prompts — onboarding + in-app prompt state machine |

---

## G. Admin Portal — Group R (Education CMS) enrichment

From `EDU-003` (admin cases 011–013).

| Change | Detail |
|---|---|
| Enrich TC-R01 | publish via `publish_section` RPC (atomic), delete-example guard `EXAMPLE_IS_PUBLISHED`, analytics aggregation metrics |

---

## H. NOT merging (developer-only / out of scope)

| File | Reason |
|---|---|
| `EDU-002` (10 cases) | Compile-time/typecheck checks, not end-user manual tests |
| `MODULE-15.1.2-TradeFlowV2-DEFERRED` test bodies | Already absorbed; only missing a TC-A03 deferral marker (see B) |

---

## Summary counts

| Canonical | New TCs | Enriched TCs | Amendments |
|---|---|---|---|
| Account/Dashboard | 7 | 0 | 3 |
| TradeFlowV2 | 6 | 0 | 1 (deferral marker) |
| Subscriptions/Payouts | 5 | 0 | 2 |
| Admin Portal | 4 (L06-L08, E08) | 4 (L03/L04/L05/E05) | 1 (TC-R01) |
| Auth/Onboarding | 7 (Group Q) | 0 | 0 |
| **TOTAL** | **29 new** | **4 enriched** | **7 amendments** |
