# FIX-Task-33 — Stripe Read Access + UI→DB→Provider Verification + TRD Stripe-Layer Audit

**Date:** 2026-09-14 · **Staging project:** `drntwgporzabmxdqykrp` · **HEAD:** `98e939b0` (FIX-Task-32)
**Deliverable 1 (enablement):** `qa:stripe-inspect` — a GET-only Stripe read tool + `STRIPE_QA_READONLY_KEY` contract.
**Deliverable 2 (standing rule):** §5.37 rules 6–7 + R100 extension + the `Money Verification Layers` handoff field.
**Deliverable 3 (SUB Android Round 1):** out of scope this session (owner runs it separately; inherits the rule).
**Deliverable 4 (TRD audit):** 11 named rows re-checked at layer 3 — **8/8 amount AGREEMENT, 2 NEW provider-only findings (F1 HIGH, F6 MED).**

---

## 1. What was built

| Artifact | Purpose |
|---|---|
| `p2p-kids-marketplace/scripts/qa/lib/stripe-read.mjs` | Key resolution + read-only guards + `stripeGet`/`stripeList` (GET-only, pinned `Stripe-Version: 2023-10-16`, Connect `Stripe-Account` support, actionable 403/401/404 messages) |
| `p2p-kids-marketplace/scripts/qa/stripe-inspect.mjs` | The CLI: `by-trade`, `by-user`, and 14 object subcommands (`pi`, `charge`, `refund`, `refunds`, `si`, `pm`, `customer`, `subscription`, `invoice`, `payout`, `payouts`, `transfer`, `events`, `disputes`) |
| `p2p-kids-marketplace/package.json` | `qa:stripe-inspect` script |
| `p2p-kids-marketplace/.env.local.example` | Documents `STRIPE_QA_READONLY_KEY` (SERVER-ONLY, not `EXPO_PUBLIC_`) |
| `.github/instructions/QA-Test-Agent.instructions.md` | §5.37 rules 6–7, R100 extension, §8.1/§8.2/§8.3/§8.4 field |
| `.github/agents/QA-Test-Agent.agent.md` | §4 dated pointer |

**Usage**

```
npm run qa:stripe-inspect -- by-trade <trade-uuid>            # the money gate
npm run --silent qa:stripe-inspect -- by-trade <uuid> > out.json   # clean evidence file
npm run qa:stripe-inspect -- by-user test-buyer
```

`by-trade` resolves every Stripe id from `trades` / `payments` / `tax_records` / `trade_refunds` /
`seller_payouts` / `seller_payout_methods` and emits a `checks` block:
`pi_amount_vs_db_total_charged`, `capture_state`, `refund_count`, `single_refund_outcome`, `payout_reality`.

---

## 2. Key contract verified this session

| Check | Result |
|---|---|
| Missing key → refuses with actionable remediation, exit 2 | ✅ PASS |
| No implicit fallback to `~/.dt11-stripe-key` | ✅ PASS (only reachable via explicit `--break-glass-secret-key`) |
| Live-mode key refused | ✅ (guard present, untested — no live key available) |
| GET-only by construction (`assertReadOnly`) | ✅ PASS |
| Real Stripe read succeeds | ✅ PASS (`/account` → `acct_1ShGft4I6kCJlvXo`, country US) |
| `key_scope` self-labelling on every artifact | ✅ PASS |

> ⚠️ **UNMET DELIVERABLE:** **no restricted read-only key exists in this environment.** Searched every
> env file (`p2p-kids-marketplace/.env`, `.env.staging`, `.env.local`, `p2p-kids-admin/.env.local`,
> `p2p-kids-web/.env.local`) and `$HOME`: the only Stripe credentials are `STRIPE_SECRET_KEY` (admin
> portal, full secret) and `~/.dt11-stripe-key` (full test-mode secret, 107 chars, `sk_test_`).
> The audit therefore ran **`--break-glass-secret-key`** and every artifact is labelled
> **`key_scope=SECRET_KEY_BREAK_GLASS`**. The reads are genuine Stripe reads (GET-only) and remain
> **valid evidence**, but they are **not** restricted-key evidence. Re-run §4's eight commands after
> the key lands to obtain `key_scope=RESTRICTED_READ_ONLY` artifacts.

---

## 3. TRD layer-3 audit results

Evidence: `evidence/<name>.json` (machine-readable) + `<name>.stderr` (key-scope banner) per row.

| Case | Trade | Stripe PI status | cap | recv | PI amount | DB `total_charged_cents` | Verdict | Tax | Refunds (Stripe / DB) |
|---|---|---|---|---|---|---|---|---|---|
| B10 | (subscription) | — | — | — | — | — | ✅ pm attached to the RIGHT customer, SetupIntent `succeeded`/`off_session`, no charge — but see **F6** | — | — |
| O2-C02 | `25beb9dc` (exempt leg) | `requires_capture` | 800 | 0 | 800 | 800 | ✅ **AGREE** | **(no row — exempt)** | 0 / 0 |
| O2-C03 #1 | `096fc228` | `requires_capture` | 3145 | 0 | 3145 | 3145 | ✅ **AGREE** | voided | 0 / 0 |
| O2-C03 #2 | `cb1cbc39` | `requires_capture` | 3155 | 0 | 3155 | 3155 | ✅ **AGREE** (Δ10¢ at Stripe) | voided | 0 / 0 |
| O3-C01/C02 | `c2de3993` | `canceled` | 0 | 0 | 2289 | 2289 | ✅ **AGREE** | voided | 0 / 0 |
| O3-C02 | `9c901926` | **`requires_capture`** | **1926** | **0** | 1926 | 1926 | ✅ **AGREE** — guide's assertion **VERIFIED** | quoted | 0 / 0 |
| O3-C06 | `3265ec84` | `requires_capture` | 1510 | 0 | 1510 | 1510 | ✅ amount AGREE · 🔴 **capture/refund DISAGREE** | **`partially_refunded` (100¢)** | 0 / **0** |
| R07 | `50849c0b` | `canceled` | 0 | 0 | 3929 | 3929 | ✅ AGREE · refund-count Δ = **by design** | voided | **1** / 0 |
| R08 | `c2de3993` | — | — | — | — | — | ✅ **Stripe N/A** — 0 payouts, no Transfer | voided | 0 / 0 |
| R09 | `c2de3993` | `canceled` | 0 | 0 | 2289 | 2289 | ✅ AGREE — uncaptured void, nothing to refund | voided | 0 / 0 |
| R03/F2 | `67ba29fc` | **`requires_capture`** | **1789** | **0** | 1789 | 1789 | ✅ amount AGREE · 🔴 **hold NOT released** | voided 14:26Z | 0 / 0 |
| O2-C12 | `3265ec84` | see above | — | — | — | — | 🔴 **DB claims refunded; Stripe shows nothing captured** | `partially_refunded` | 0 / 0 |

**Amount agreement: 8/8 audited trades AGREE** (`PaymentIntent.amount` == `payments.total_charged_cents`).

---

## 4. Findings

### 🔴 F1 (HIGH, provider-only) — a stranded OPEN authorization survived the F2 remediation
`67ba29fc-cf01-4713-8e8b-21e3fc460701` — R03/F2's **own live proof case**, `offer_expired_competing`:
- PI `pi_3UFO9f4I6kCJlvXo0iCaV1UR`: **`requires_capture`, `amount_capturable=1789`, `amount_received=0`**
- charge `ch_3UFO9f4I6kCJlvXo0Rr9QV2W`: `captured=false`, `amount_refunded=0`
- tax record: `voided`, but `voided_at = 2026-09-14T14:26:27Z` — **~13.5h AFTER** the `cancelled_at` of `2026-09-14T00:53:56Z`
- `trade_refunds`: 0 rows · `payments.refunded_cents`: 0

**$17.89 remains held at Stripe.** The late void timestamp identifies the writer: **FIX-Task-32 item 4's
approved data repair**, which named this exact trade — it corrected the DB half and **cannot** cancel a
PaymentIntent (a DB-only repair performs no Stripe call). `check-authorization-expiry` scans
`status='pending'` only (F2's original analysis), so **nothing in the system will ever release it**.

**Why it matters:** it is invisible to every DB query — no column anywhere records "this authorization is
still open". Only a provider read can see it. This is precisely the class FIX-Task-33 was created to expose.
**Remediation:** an owner-approved one-line Stripe `paymentIntents.cancel` for the stranded PI(s).
**Consequence for the tracker:** R03's Expected-Result clause *"those buyers' holds restored"* is **still
UNMET at layer 3**, so **R03 correctly remains 🟡 PARTIAL** — the new evidence *strengthens* the existing
status rather than flipping it.

### 🟡 F2 (MED, class confirmation) — the uncaptured-money class, now proven at layer 3
`3265ec84-3a2a-4ace-a1b6-152cc3d2ac2b`:
- DB: `tax_status='partially_refunded'`, `refunded_tax_cents=100`, `captured_at=2026-09-13T00:07:03Z`
- Stripe: PI **`requires_capture`**, `amount_received=0`, **zero Refund objects**

The DB asserts money moved that never moved. Writer = a QA-driven `rpc_refund_tax_with_status` call
(harness-induced, so **not a production instance**), but the product guard *should* have refused a refund
against a never-captured PI → **supports FIX-Task-32 item 3** (branch on `stripeAction === 'cancelled_uncaptured'`;
consider making `rpc_record_payment_refund` refuse a never-captured PI as defence-in-depth).
Independently reinforces the owner's **void-not-collect** decision for O2-C12.

### 🟢 F3 (near-miss, ruled out) — R07's refund-count Δ is the documented uncaptured-authorization exception
`50849c0b`: Stripe shows refund `re_3UFNZT4I6kCJlvXo1KbKCyi8` (3929, `succeeded`) **and** the PI
`canceled`/`recv=0`, while `trade_refunds` is empty. **By design** — Stripe represents an
authorization-cancel as a refund object; the app deliberately books no `trade_refunds` row because nothing
was ever captured. Matches the pre-existing `0e33f356` precedent. Codified as **§5.37 rule 7** so it is not
re-filed. **No status change.**

### 🟢 F4 (ruled out) — two open holds are QA-harness residue, not a product defect
`096fc228` / `cb1cbc39` (the O2-C03 fixture pair) read `requires_capture` with tax `voided`.
Writer named by source read: `p2p-kids-marketplace/scripts/qa/reset-offer-fixtures.mjs` cancels by **raw
status UPDATE** (L222-224: `status:'cancelled'`, `cancelled_at`, `cancellation_reason:'buyer_cancelled'`)
plus `rpc_void_tax_for_trade` (`p_reason='qa_harness_cancelled'`, L103-105) and **never calls Stripe** — so
the harness voids the tax but strands the authorization it cannot release. **Not a bug**; a harness
improvement opportunity (cancel the PI alongside, or document the residue).

### 🟢 F5 (confirmed) — O2-C02's exempt leg is correct at Stripe
`25beb9dc`: PI 800 = item price only (**no tax added**) and **no `tax_records` row exists at all** — the
"fully tax-exempt line writes no tax record" behaviour holds at both layers, now including the real
authorization amount.

### 🔴 F6 (MED, NEW, provider-only) — the app's "saved card" and the card a renewal would charge have drifted apart
Discovered while completing B10's provider leg. Three facts, all read from Stripe + the DB:

| Source | Value |
|---|---|
| `subscriptions.stripe_payment_method_id` (DB, `updated_at` **2026-09-14T14:30:06Z**) | `pm_1UFatV4I6kCJlvXoJsDhX3ZQ` (the NEWER card) |
| Live subscription `sub_1To5Vg4I6kCJlvXoebIAvLZJ` (`status=active`) → `default_payment_method` | **`None` — the subscription has NO default PM at Stripe** |
| Customer `cus_Ungj4MptKp9CUg` → `invoice_settings.default_payment_method` | `pm_1UFNpm4I6kCJlvXop2yMXsky` (the OLDER card, set by B10's card-save) |

**The divergence:** with no subscription-level default PM, Stripe falls back to the **customer** default —
which is the **older** card, while the app's DB (and therefore the app UI) shows the **newer** one. So a
renewal may charge a card the user believes they replaced.

**Bounded, with the honest missing leg:** both are test cards, so severity is bounded to the drift itself.
**NOT yet verified:** whether `renew-subscription` / `create-subscription-payment` charge via the DB's
recorded PM or rely on Stripe's default-resolution (in which case the drift is live). That single EF read is
the next step and decides whether this is a real renewal risk or a cosmetic DB field. Filed as MED with that
leg named rather than over-claimed.

**Also worth recording (not a defect):** B10's original claim was "persistence DB-verified
`pm_1UFNpm4I6kCJlvXop2yMXsky`" — that was true on 2026-09-13, but the DB row has since moved to
`pm_1UFatV…` (14:30Z today), i.e. **a later card-replace ran after B10's record**. The B10 PM itself is
intact and **correctly attached** to the right customer (`cus_Ungj4MptKp9CUg` = the user's stored
`stripe_customer_id`), which is what B10 actually asked. So B10's *attachment* assertion is verified; only
the "which card is current" snapshot moved on. Do not read the empty `WHERE stripe_payment_method_id =
'pm_1UFNpm…'` result as a data-loss defect.

---

## 5. Owed legs / not done

1. **Restricted read-only key** — not created (owner action). Re-run §3/§4 for `RESTRICTED_READ_ONLY` evidence.
2. **Connected-account read scope** — not verified; no Connect-scoped key exists. `payouts`/`transfer`
   subcommands are built and pass `Stripe-Account`, but the 403 path is untested. If the platform key's
   Connect read scope is not granted, seller Payout/Transfer reads must be recorded
   `Stripe N/A — connected account not readable with current key`.
3. **O3-C06 layer 3 re-scope** — with a read-only key the duplicate is **not inducible** (and Stripe blocks
   it server-side). Recommendation: re-scope layer 3's assertion from "induce the duplicate" to
   **"prove exactly one Refund exists for the charge"** — which the read key *can* prove. Recorded here; not
   yet applied to the guide.
4. **Post-fix re-leak verification (highest-value next step)** — the writer fix is committed (`98e939b0`) but
   its effectiveness is unproven at layer 3. Drive one competing-offer cancellation post-deploy, then confirm
   the rival PI reads `canceled`/`amount_capturable=0`.
5. **O2-C12's 9 completed+`quoted` rows** — not individually audited at layer 3 (would need 9 PI reads);
   the owner's void decision plus F2's evidence already supports `voided` over `collected`.
6. **`live key refused` guard** — implemented, not exercised (no live key available).

---

## 6. Reproduction

```bash
cd p2p-kids-marketplace
# Restricted key (preferred, once provisioned):
STRIPE_QA_READONLY_KEY=rk_test_... npm run --silent qa:stripe-inspect -- by-trade 67ba29fc-cf01-4713-8e8b-21e3fc460701
# This session's break-glass equivalent (labelled evidence):
npm run --silent qa:stripe-inspect -- by-trade 67ba29fc-cf01-4713-8e8b-21e3fc460701 --break-glass-secret-key > out.json
```
Failure to include `key_scope` in any handoff claim is a new §5.37 rule-6 violation.
