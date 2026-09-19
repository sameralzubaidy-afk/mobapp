# Combined Dispatch Report — PR #24 Merge + J12 Re-Drive + AUTH Final Accounting

**Date:** 2026-09-18 · **Repo:** `sameralzubaidy-afk/mobapp` · **Staging project:** `drntwgporzabmxdqykrp`

This closes out infrastructure and produces the true, current state of AUTH before MSG starts.

---

## Part 1 — CI Green and PR #24 MERGED ✅

**PR #24 — "FIX-Task-63: make schema-drift detection automatic and blocking"**

| Check | Result |
|---|---|
| **Static migration checks** *(required)* | ✅ success — 1m32s |
| **Full migration gate (scratch rebuild + fidelity)** *(required)* | ✅ success — 4m16s |
| Lint | ✅ success — 4m56s |
| TypeScript | ✅ success — 3m23s |
| Tests | ✅ success — 5m20s |
| E2E — Cache Integration Tests | ✅ success — 3m17s |

**All six checks green. 0 cancelled, 0 failing, 0 pending.**

**Merge:** completed **2026-09-18T22:40:51Z** by `sameralzubaidy-afk` · merge commit **`48d50899f13166c9adaa2cd861fa6ebe74f6a75d`** · `main` advanced `3e140a51 → 48d50899`.

### Note — "the base branch policy prohibits the merge" was transient, not a real block

The first merge attempt was refused with *"the base branch policy prohibits the merge"* while `mergeStateStatus` read `BLOCKED` — **and the required checks were already green**. Root cause: a **second CI run had started at 22:30 on the same commit** (`pull_request` event, run `35401801602` / `35401801579`), re-marking the two required contexts `in_progress`. No PR-timeline event (label/edit/reopen) accounts for it. Waiting for that run to finish cleared `BLOCKED`, and the merge succeeded with no override flags (`--auto` / `--admin` were **not** used).

Branch protection was verified independently: required = **`Static migration checks`** + **`Full migration gate (scratch rebuild + fidelity)`**; no required reviews; `strict: false`; no rulesets.

### Post-merge sanity check against `main` ✅

Run in an isolated worktree at `48d50899` (so the shared working tree was untouched):

| Command | Result |
|---|---|
| `npm run migration-gate` | **PASS** — *"Static tier — 544 migration files … VERDICT: PASS — static checks green"* |
| `node scripts/migrations/ledger-audit.mjs` | **PASS** — `APPLIED_ONLY 0 UNEXPLAINED` · `APPLIED_UNCOMMITTED 0` · **`RESULT: no unexplained out-of-band changes`** |

Ledger detail: 544 repo files · `FILE_ONLY 305` (normal pre-deploy) · `APPLIED_ONLY 0 unexplained` · 34 explained by `ledger-exceptions.json` · 11 version-anchored (informational).

Content equivalence was also confirmed: **0 differing `.sql` files** between `main` and the branch (the only delta was untracked `tools/reports/*.log` artifacts).

> ⚠️ **Honest scope note:** the ledger audit read the **frozen FIX-Task-64 staging capture** (`supabase/migrations/tools/staging-fp/staging-ledger.json`, 284 rows, committed as part of the freeze) rather than a fresh live ledger read. That is the intended frozen-baseline input, but a *fresh* live re-read would need an approved Supabase MCP call. The frozen capture is what FIX-Task-64 froze for exactly this check.

**The migration gate is now actually protecting `main`.** ✅

---

## Part 2 — J12 Re-Drive on an UNSHARED Emulator ✅ PASS

### The isolation problem, and how it was solved

Only **one** AVD existed (`Medium_Phone_API_36.1`) and it was already booted **and shared with a concurrent Claude Code session** (PID 28199, started 15:31) — the exact condition that killed the app in the prior attempt. Rather than hope, a **second, private AVD was created**:

- Cloned the known-good `config.ini` → **`QA_J12_Isolated`** (own `~/.android/avd/QA_J12_Isolated.ini`).
- Booted on **port 5556** → serial **`emulator-5556`**, a distinct device from the shared `emulator-5554`.
- Installed the **same** debug APK the shared device runs (`app-debug.apk`, 2026-09-07; verified byte-identical build) and pointed it at Metro via `adb reverse tcp:8082`.
- **Everything was driven over `adb`** (`uiautomator dump` → exact `resource-id` bounds → `input tap` → `screencap`). The `mobile_*` JVMTI attach that killed the app before was never used.

This is worth keeping: on this machine, **`testID` surfaces as Android `resource-id` in `uiautomator dump`**, which gives exact element bounds and turns flaky pixel-guessing into deterministic taps.

### Results — every limb PASS

**Limb 3 — oversize PNG via the real Android Photo Picker**
- Test file: **22.91 MB** PNG (2000×2000, ≥400px so it passes the dimension gate and fails only on size).
- Picked through `com.google.android.photopicker` (the real system picker), confirmed with **Done**.
- **The invalid photo is NOT silently added.** The screen showed:
  - per-slot red **`Couldn't upload`** badge (`photo-slot-failed-…`) while the photo **stays visible** in the strip (owner decision — not auto-removed);
  - a **branded modal** (green brand button, not a native blue `Alert`): **"Uploads failed"** → *"1 photo can't be uploaded / …: **Image must be smaller than 10MB** / Remove or replace it, then try again."*;
  - a persistent inline **`photo-upload-error-card`** after dismissing the modal, plus **remove** and **replace** affordances;
  - **`publish-button` `enabled="false"`**, and **tapping it produced ZERO log output** — a genuine no-op, not merely greyed.

**Limb 4 — GIF**
- 800×800 GIF, same real picker path → rejected with **"Only JPEG, PNG, WebP, and HEIC images are supported"**.
- With both bad photos present the error card correctly reads **"2 photos can't be uploaded … Remove or replace *them*, then try again."** — then correctly reverted to singular after one removal. Copy pluralisation is right in both directions.

**Limb 2 — 10-photo cap (the previously-partial limb)**
- Driven for real: **0 → (7/10) → (10/10)** using valid PNGs.
- At **10/10**: `add-photos-button` is **removed from the tree** (0 empty slots), and the screen renders an explicit **"Maximum 10 photos reached"**.
- Environment note: the picker's **bottom tile row sits under the picker's own bottom control bar**, so taps there toggle the selection counter back to 0 — a tooling hazard, worked around by seeding from the upper rows.

**Limb 3/4 publish-path (server-side) belt-and-braces**
- The UI gate blocks first, so the publish path is unreachable with an invalid photo — that is the intended design, not a gap.
- The publish-path guard itself was re-proven: `uploadListingImages` contract suite **9/9 PASS**, including *"rejects an unsupported file type derived from the URI BEFORE any upload"*, *"rejects an oversize file measured from disk when the caller has no metadata"*, and *"names the offending position and still uploads nothing when a LATER photo is invalid"*. Non-vacuity (RED/GREEN) was already proven in FIX-Task-61.
- Repo-side backstop: the `item-images` Storage bucket's `allowed_mime_types` (GIF removed) and 10 MB `file_size_limit` were confirmed live on staging earlier today by FIX-Task-61.

### Verdict

> **AUTH-TC-J12 = ✅ PASS** — post-fix, on-device, on an unshared emulator, with every limb genuinely driven.

**Evidence:** `e2e-test-results/fix-task-61-j12-redrive-2026-09-18/` — 4 screenshots (`J12-01`…`J12-04`) + 3 AX dumps (`ax-itemcreate-empty.xml`, `ax-oversize-rejected-state.xml`, `ax-10of10-cap.xml`).

---

## Part 3 — AUTH Final Accounting (all 138 cases)

### The tracker had two headlines that contradicted their own notes

Parsing the live tracker's AUTH table found **both** stale rows sitting next to notes that already recorded the newer truth:

| Row | Headline (stale) | Its own Notes said | Applied |
|---|---|---|---|
| `AUTH-TC-J02` | ✅ PASS (2026-08-24) | "⇒ 🟡 PARTIAL recommended (owner call)" | **🟡 PARTIAL** |
| `AUTH-TC-J12` | ✅ PASS (2026-08-24) | "❌ R3 2026-09-18 = FAIL on the type/size limbs" | **✅ PASS on a fresh post-fix basis** |

Both are now corrected in place, with the AUTH roll-up counts and a dated round-note reconciled.

### Final AUTH roll-up — 138 cases, reconciled

| Group | Total | ✅ PASS | 🟡 PARTIAL | 🔴 OPEN | ⏭️ SKIPPED | 🗑️ REMOVED |
|---|---:|---:|---:|---:|---:|---:|
| A — Signup | 8 | 8 | 0 | 0 | 0 | 0 |
| B — Profile / phone | 12 | 12 | 0 | 0 | 0 | 0 |
| C — Social / Apple | 7 | 5 | 1 | 1 | 0 | 0 |
| D — Notifications | 3 | 3 | 0 | 0 | 0 | 0 |
| E — Phone verification | 5 | 5 | 0 | 0 | 0 | 0 |
| F — Nodes / ZIP | 6 | 6 | 0 | 0 | 0 | 0 |
| G — Subscription gate | 6 | 6 | 0 | 0 | 0 | 0 |
| H — Welcome / onboarding | 7 | 5 | 0 | 0 | 0 | **2** |
| I — Subscription choice | 3 | 0 | 0 | 0 | 0 | **3** |
| J — Listing creation | 15 | 14 | 1 | 0 | 0 | 0 |
| K — Bulk listing | 6 | 6 | 0 | 0 | 0 | 0 |
| L — Listing approval | 4 | 4 | 0 | 0 | 0 | 0 |
| M — Discovery | 10 | 10 | 0 | 0 | 0 | 0 |
| N — Search / filters | 4 | 4 | 0 | 0 | 0 | 0 |
| O — Filters / radius | 5 | 5 | 0 | 0 | 0 | 0 |
| P — Header / chrome / nav | 19 | 19 | 0 | 0 | 0 | 0 |
| Q — Help / education | 7 | 7 | 0 | 0 | 0 | 0 |
| S — Password recovery | 11 | 8 | 0 | 1 | 2 | 0 |
| **TOTAL** | **138** | **127** | **2** | **2** | **2** | **5** |

**127 + 2 + 2 + 2 + 5 = 138 ✓** — and this equals the §1 roll-up row and the section header after the edit. `NEVER RUN / Remaining = 0`.

### Every non-PASS case, named with its reason

| TC-ID | Status | Why — and who owns the next move |
|---|---|---|
| `AUTH-TC-C03` | 🔴 OPEN | **Environment-blocked (owner).** Apple provider is **not enabled in staging GoTrue** → raw `{"code":400,"...provider is not enabled"}`. FIX-Task-3 added a graceful pre-check, but the real Apple sign-in leg cannot complete until the provider is enabled. **Unchanged today.** |
| `AUTH-TC-C07` | 🟡 PARTIAL | **Owner step.** `can_set_password` RPC + `SetPasswordModal` wiring + on-device "Password ✓ set" branch are all verified; the remaining leg needs a **real Google identity attached** to the password-less `qa-social-only` fixture. **Unchanged today.** |
| `AUTH-TC-J02` | 🟡 PARTIAL | **Deliberate deferral (owner 2026-09-18).** Failure branch is driven and PASSES. The AI-**success** limbs (Apply All / per-field Use) have never been driven on any platform and are blocked by a live staging AI-provider **401 `Invalid or expired bearer token`**. **Not a defect** — parked on a provider-credential/budget decision. |
| `AUTH-TC-S01` | 🔴 OPEN | **Environment-blocked (owner).** Staging Supabase Auth SMTP is not configured (SendGrid dashboard step). **Unchanged today.** |
| `AUTH-TC-S03` | ⏭️ SKIPPED | **Deliberate skip.** Needs the `qa_reset_error_simulation` toggle armed by the dev team. **Unchanged.** |
| `AUTH-TC-S05` | ⏭️ SKIPPED | **Deliberate skip.** The specific 400 is not inducible on healthy staging. **Unchanged.** |
| `AUTH-TC-H04`, `H05`, `I01`, `I02`, `I03` | 🗑️ REMOVED | **Product decisions, not defects.** H04/H05 screens removed; I01–I03 removed by **`docs/DECISIONS.md` D-001** (web-first `JoinKidsClubScreen` is the intended design). |

All **other 127 cases hold at their last-verified status** — nothing in this session's work touched them.

### Blast-radius spot-check — did today's changes (FIX-59 / FIX-62 / FIX-64) alter any AUTH behaviour?

This was treated as a real risk, not a formality. **One of the three genuinely sat in AUTH's path.**

**🔴 FIX-59 — the one that mattered, and it was re-verified empirically.**

FIX-59 gated `verify_user_phone` behind an identity check and **DROPPed two `profiles` UPDATE policies**, including `Allow phone verification updates` (granted to **PUBLIC**). AUTH has a direct dependency here: `phoneService.verifyPhoneCode` — the shipped phone-verification write — does **not** use that RPC; it PATCHes `profiles` directly:

```js
await supabase.from('profiles')
  .update({ phone_verified: true, phone_verified_at: <now>, phone_verification_method: 'sms' })
  .eq('user_id', user.id);
```

The existing FIX-59 probe covers anon→other and authenticated→**other**, but its positive leg used the **RPC** — which is `SECURITY DEFINER` and therefore **bypasses RLS entirely**, so it could never falsify the policy question. A blocked PostgREST UPDATE also does **not** error (RLS silently returns 0 rows), so "no error" proves nothing either.

A new probe was written for exactly this and run against live staging:
**`scripts/qa/fix-task-59-auth-self-update-probe.mjs`** — write a value, **read it back on a separate round-trip** (the only discriminating test), using the anon key + a documented fixture persona, touching only `phone_verification_method` / `phone_verified_at` and restoring both.

```
✓ LEG 2a  authenticated → DIRECT PATCH of OWN profiles row (non-gating column)
          rows=1 · read back="manual" · changed=true
✓ LEG 2b  app-EXACT payload → phone_verified + phone_verified_at
          rows=1 · verified_at read back == value sent · equals-sent=true
✓ LEG 3   authenticated → DIRECT PATCH of ANOTHER profiles row   rows=0 (blocked)
restore: method -> "sms", verified_at -> "2026-08-21T16:55:58.577+00:00" (verified=true)
=== 3/3 legs passed ===
```

> **Conclusion: FIX-59 did NOT break AUTH's phone-verification write.** The gating column is genuinely written for the signed-in owner, while cross-user writes remain blocked — so the security tightening holds *and* no legitimate access was lost. `test-seller` was restored to its exact baseline. The migration's claim is now confirmed **at the layer that can falsify it**, not accepted from the migration chain. *(Earlier rounds of the phone flow, e.g. J10's gate, depend on this same write — so this re-verification covers them too.)*

**🟢 FIX-62 — no AUTH surface.** Six migrations: payout requeue/gating, plus anon-function lockdown and anon-policy alignment. The anon changes remove **unauthenticated** access to `profiles` / `referrals` / `subscriptions` / `user_notifications` / `items` / `sp_wallets` / `sp_ledger` and re-assert signed-in reads. Crucially: AUTH's one **pre-login anonymous dependency** — `fn_get_admin_config_values`, read by Forgot Password for the QA simulation toggles — is **explicitly NOT touched**; and signup creates its `profiles` row via the **RLS-exempt `handle_new_user()` trigger**, so no anon policy is needed. The one behaviour change (`badges` UPDATE → admin-only) is an admin surface AUTH never exercises.

**🟢 FIX-64 — no AUTH surface.** CI tooling + the frozen staging capture; **0 migrations**.

**Net: no AUTH case regressed.**

### Closing statement

> **AUTH is genuinely ready to be considered closed for this phase — with two caveats that are not defects.**
>
> All **138** cases are accounted for: **127 ✅ PASS**, **2 🟡 PARTIAL**, **2 🔴 OPEN**, **2 ⏭️ SKIPPED**, **5 🗑️ REMOVED**, and **0 never-run**. Every non-PASS case has a named reason, and **none of them is a code defect awaiting a fix** — they are one deliberate product deferral (J02), one deliberate QA skip pair (S03/S05), two documented product removals (H04/H05 + I01–I03), and three owner/environment actions (C03 Apple provider, C07 Google-identity fixture attach, S01 SMTP).
>
> **The one thing that could have silently invalidated large parts of AUTH was today's FIX-59**, and it was re-verified on live staging rather than assumed — it is clean.
>
> **So the only things standing between AUTH and a fully-closed board are three owner actions**, none of which requires engineering work:
> 1. Enable **Apple** as a provider in staging GoTrue → releases `AUTH-TC-C03`.
> 2. Configure **staging SMTP** (SendGrid) → releases `AUTH-TC-S01`.
> 3. Decide on the **staging AI provider credential/budget** → un-parks `AUTH-TC-J02`.
>
> (`AUTH-TC-C07` additionally needs a real Google account attached to the `qa-social-only` fixture — an operator step, not code.)

---

## Changes made this session

| File | Change |
|---|---|
| `e2e-test-results/fix-task-61-j12-redrive-2026-09-18/evidence/` | **NEW** — 4 J12 screenshots + 3 AX dumps |
| `p2p-kids-marketplace/scripts/qa/fix-task-59-auth-self-update-probe.mjs` | **NEW** — probe covering the one leg the FIX-59 lockdown probe missed (authenticated → own `profiles` row) |
| `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` | `AUTH-TC-J02` PASS→PARTIAL; `AUTH-TC-J12` refreshed to the post-fix PASS (+ Android column); AUTH roll-up `128/1` → `127/2`; dated AUTH-closing round note added |

**Tracker integrity re-checked after editing:** re-parsed AUTH = **138 rows, sum 138**; `npm run verify:guides` reports **no AUTH contradictions** (its 3 hard findings are all pre-existing TRD/SUB rows).

**Hygiene note (pre-existing, not fixed):** `AUTH-TC-C07`'s Status cell carries an encoding artefact (`� PARTIAL` instead of `🟡 PARTIAL`). It predates this session and did not affect the parse, but it is worth a one-character fix in a future tracker pass.
