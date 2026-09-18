# FIX-Task-56 — Report (both items COMPLETE — applied to staging and verified end-to-end)

**Date:** 2026-09-18
**Source:** FIX-Task-55, 2026-09-18. Both items owner-approved 2026-09-18.
**Type:** 1 approved fixture application + 1 approved product fix (auto-promote).

---

## Status

| # | Item | Status |
|---|---|---|
| 1 | Apply the `single-unverified-nonprimary` fixture scenario | ✅ **APPLIED to staging + VERIFIED live**, and the guard was re-driven on-device — SUB-TC-G11 item 5 now **PASS** |
| 2 | Auto-promote a seller's sole verified payout method to primary | ✅ **APPLIED TO STAGING + VERIFIED END-TO-END** — locally validated (7/7), then applied via MCP and confirmed by live invocation, a functional promotion, a negative control, the invariant check, and an on-device run (§2.6) |

---

## Item 1 — fixture applied and the long-owed guard leg closed

**Applied:** `npm run qa:payout-fixture -- methods --scenario single-unverified-nonprimary`
→ `✅ Methods replaced: scenario 'single-unverified-nonprimary' (1 row(s)) for a1234567-0000-0000-0000-0000000000f2`

**Live read-back** (`npm run qa:payout-fixture -- status`):

```
qa-payout-seller persona (qa-payout-seller@kidsmarketplace.test)
  auth user id: a1234567-0000-0000-0000-0000000000f2
  profile: node=550e8400-…-0001 completed=true phone_verified=true
  subscription: status=active
  balance: available=$50.00 pending=$0.00 lifetime=$50.00 trades=0
  methods: stripe_connect[primary=false verified=false]      ← the scenario, live
  payouts (1 most recent): $7.00/completed(manual)
```

`available=$50.00` matters: the withdraw guard checks the balance **first**, so without it the tap would hit the "No Balance" alert instead of the guard. The fixture is fully drivable.

### SUB-TC-G11 item 5 — re-driven on-device (iOS, iPhone 17 Pro Max), **PASS**

Entry path: `qa-login-as?persona=qa-payout-seller` → `p2pkidsmarketplace://payout-settings` (route verified against the `linking` config before firing — `AppNavigator.tsx` registers `PayoutSettings: 'payout-settings'`) → tap **Withdraw Now**.

Observed iOS accessibility tree:

| Element | testID | Result |
|---|---|---|
| Modal title | — | **"Verify Your Payout Method"** ✅ |
| Body | — | "To withdraw your earnings, finish setting up your payout method first." ✅ |
| Primary CTA | `no-method-add-btn` | **"Continue Onboarding"** (Clock icon) ✅ |
| Cancel | `no-method-cancel-btn` | present ✅ |
| "Add Payout Method" | — | **ABSENT** ✅ |
| "Payment Method Required" | — | **ABSENT** ✅ |

Both modal buttons surface individually in the iOS AX tree (BP-53). This is the assertion that has been owed since FIX-Task-53 — it could never be driven before because the old fixture set `is_primary = true`, which skipped the guard entirely.

Evidence: `screenshots/MOBILE-subtc-g11-item5-verify-payout-method.png`

---

## Item 2 — written and locally validated; staging apply blocked

**Migration:** `supabase/migrations/20260918000001_fix_task_56_auto_promote_sole_verified_payout_method.sql` (Mode B — idempotent/runnable).

### 2.4 Staging apply — the blocker and its resolution

**RESOLVED 2026-09-18.** Root cause was a **dead Personal Access Token** in the user-level MCP config, not the workspace one. Detail retained below for the next person who hits `Unauthorized` from the Supabase MCP.

The owner approved running the SQL. The sanctioned path (Supabase MCP — the *only* permitted route for SQL/DDL) returned, on both `list_projects` and `apply_migration`:

```
Unauthorized. Please provide a valid access token to the MCP server via the
--access-token flag or SUPABASE_ACCESS_TOKEN.
```

**Root cause (DEFINITIVE — the first theory below was WRONG and is retracted):**

- ❌ **RETRACTED theory:** `.vscode/mcp.json`'s `${input:Authorization}` placeholder. That input belongs to the **GitHub** MCP server, not Supabase — which is why supplying it and restarting changed nothing. The workspace config does not contain a Supabase server at all.
- ✅ **Actual cause:** the Supabase MCP server is declared in the **user-level** config (`~/Library/Application Support/Code/User/mcp.json`, server `com.supabase/mcp`, `type: stdio`, `npx -y @supabase/mcp-server-supabase@latest`). Its `env.SUPABASE_ACCESS_TOKEN` **is set** and well-formed (44 chars, `sbp_` prefix, no whitespace, not a placeholder) — but that token is **DEAD**:
  ```
  GET https://api.supabase.com/v1/projects -> HTTP 401
  ```
  (independent, read-only probe; the token value was never printed). So Supabase itself rejects it — expired or revoked.
- The running server process is **not stale**: pid 43434 started `Fri Sep 18 08:18:05`, **after** the config's mtime `08:07:19`, so it did launch with this token. It simply cannot authenticate with it.

**The three steps that unblock it (owner-only — a secret, so it must not be routed through the agent):**
1. Mint a fresh Personal Access Token at https://supabase.com/dashboard/account/tokens.
2. Replace `SUPABASE_ACCESS_TOKEN` under `servers["com.supabase/mcp"].env` in `~/Library/Application Support/Code/User/mcp.json`.
3. **Reload the VS Code window** (Command Palette → *Developer: Reload Window*). An MCP server restart alone may not re-read the config; the running process does not poll it.

**Deliberately NOT done:** routing around the MCP via the Supabase CLI or `psql` against staging. The standing owner rule (2026-08-28) makes the MCP the only sanctioned path for SQL/DDL, and any alternative would require a staging database credential that must never be requested or handled here. A local PostgreSQL server *was* available and used instead — see below — which validates the SQL without touching staging.

**Ready-to-run once authenticated:** one `apply_migration` with `project_id = drntwgporzabmxdqykrp` (verified against `p2p-kids-marketplace/.env`) and the migration's contents.

### 2.5 LOCAL validation — the migration was actually executed, not just written

The migration was applied to a **throwaway local PostgreSQL database** (never staging): `00-setup.sql` builds the minimum surface (the three Supabase roles the grants name, `seller_payout_methods` **including the real unique partial index `seller_payout_methods_one_primary_idx`**, `debug_logs`), then the migration is applied, asserted, and **re-applied** to prove Mode B rerun safety.

Harness: `local-harness/00-setup.sql` · `local-harness/10-tests.sql` · results in `local-harness/RESULTS.txt`.

| Test | Expectation | Observed | Verdict |
|---|---|---|---|
| T1 | sole verified + no primary ⇒ promoted | `is_primary=t is_verified=t` | **PASS** |
| T2 | sole **UNVERIFIED** ⇒ **NOT** promoted | `is_primary=f` | **PASS** |
| T3 | existing primary + another verified ⇒ still exactly 1 primary, unchanged | `primary_count=1 chosen_still_primary=t` | **PASS** |
| T4 | **two** verified + no primary ⇒ NOT promoted (ambiguous) | `primary_count=0 promote_returned=NULL` | **PASS** |
| T5 | explicit unset ⇒ stays unset, not instantly re-promoted | `after_promote=t after_unset=f` | **PASS** |
| T6 | primary already present ⇒ helper is a no-op | `promote_returned=NULL` | **PASS** |
| T7 | legacy row repaired by the **backfill** on re-apply | `is_primary=t` | **PASS** |

**7 checks, 0 failures.** Plus, verified in the same run:

- the migration applied **twice with zero errors** → Mode B rerun safety is proven, not asserted;
- the trigger is attached and enabled (`tgenabled = O`);
- both functions are `SECURITY DEFINER` with `search_path=public` pinned;
- **live grants** (`aclexplode`-equivalent, read from `proacl`) show the rule function is owner + `service_role` only — **no `PUBLIC`/`anon`/`authenticated` entry**, i.e. the BP-79 re-assert worked;
- the `T7-seed` row records `is_primary=f` *before* the re-apply, proving the backfill (not the trigger) performed that promotion.

### Why the fix is DB-side, not in `sync-stripe-connect-status` or the screen

The brief suggested either the Edge Function or a load-time client check. Both are **insufficient**, and the reason is new information found while tracing the writers:

`rpc_create_payout_on_trade_complete` (`20260916000110_wire_payout_on_trade_complete.sql:63-90`) resolves the seller's method with

```sql
WHERE user_id = p_seller_id AND is_primary = TRUE AND is_verified = TRUE
```

and, when auto-payout is enabled and that lookup returns nothing, it **parks the payout as `requires_action`**:

```sql
ELSIF v_primary_method IS NULL THEN
  v_payout_status := 'requires_action';
```

So a seller who completes Stripe Connect onboarding and never taps the (undiscoverable) "set as primary" radio has **every payout stranded** — not just a confusing modal. A client-side or EF-side fix would make the *screen* say the seller is set up while the money kept stranding. The same `is_primary = TRUE` lookup is used by `initiate-payout`, `request_seller_payout`, and the minimum-withdrawal guard.

This also plausibly explains the historical "**17 payouts need a payout method**" pile reported in FIX-Task-37 item 9 — a single cause, exactly as that fix's summary line assumed.

### What the migration does

1. **`public.promote_sole_verified_payout_method(p_user_id UUID) RETURNS UUID`** — expresses the rule once: if the seller has **no primary** and **exactly one verified** method, promote it. Returns `NULL` when there is nothing to do (0 verified, or 2+ verified = the seller must choose). `SECURITY DEFINER`, `search_path = public`.
2. **`public.fn_auto_promote_sole_verified_payout_method()`** trigger function + **`trg_auto_promote_sole_verified_payout_method`** — `AFTER INSERT OR UPDATE OF is_verified`. `SECURITY DEFINER` so it works for user-JWT writes too. Wrapped in an exception trap that `RAISE WARNING`s and writes `debug_logs` (BP-4) rather than failing the caller's write — a raise here would break the very onboarding sync that just verified the seller.
3. **Backfill** for sellers already in the state (the trigger only covers writes from here on).
4. **Explicit grants** re-asserted after `CREATE OR REPLACE` (BP-79 — the `dt61_guard_revoke_fn_public` event trigger strips them): `service_role` only; `PUBLIC`/`anon`/`authenticated` revoked.
5. **Verification queries** V1–V4, including the invariant check (expect **zero** rows for "one verified, no primary").

**Not on `UPDATE OF is_primary` and not on `DELETE`** — so an explicit unset (`updatePayoutMethod({ is_primary: false })`) keeps working rather than being instantly undone. No recursion by construction: the promotion UPDATE sets only `is_primary`/`updated_at`.

**Unverified methods are never promoted** — asserted in the same pass, and independently confirmed by item 1's live read-back (`primary=false` on the unverified fixture).

### The test to run once applied

1. `npm run qa:payout-fixture -- methods --scenario single-verified-nonprimary` (new scenario, registered + dry-run verified) → read back → **expect `stripe_connect[primary=true verified=true]`** (self-correcting: the INSERT trips the trigger).
2. `npm run qa:payout-fixture -- methods --scenario single-unverified-nonprimary` → read back → **expect `primary=false`** (an unverified method must NOT be promoted).
3. On-device: with a primary now set, **Withdraw Now** must open the WithdrawModal — the "Add Payout Method" branch must no longer fire.

### 2.6 STAGING verification — applied and proven

Applied via `apply_migration` to `drntwgporzabmxdqykrp` (`{"success":true}`). Per **BP-81** the migration is NOT expected to appear in `list_migrations`, so it was verified by **live invocation / live catalog reads** instead:

**Catalog state (live read, post-apply):**

| Object | Result |
|---|---|
| `trg_auto_promote_sole_verified_payout_method` | attached, `tgenabled = O` ✅ |
| `promote_sole_verified_payout_method` | `security_definer=true`, `config=search_path=public` ✅ |
| `fn_auto_promote_sole_verified_payout_method` | `security_definer=true`, `config=search_path=public` ✅ |
| live ACL (both functions) | `postgres=X/postgres \| service_role=X/postgres` — **no `anon`, no `authenticated`, no `PUBLIC`** ✅ |

**Backfill:** before-state was **0 sellers** in the target state, so the backfill was a correct no-op on staging today — no data was modified. Notably this means the historical “17 payouts need a payout method” pile (FIX-Task-37 item 9) was **not** caused by this state; that pile's cause remains unclaimed and is worth a separate look.

**Functional proof (real staging writes through the fixture):**

| Step | Fixture wrote | Read-back after | Verdict |
|---|---|---|---|
| Positive | `is_primary=false, is_verified=true` | **`primary=true verified=true`** | ✅ trigger self-corrected it |
| Negative control | `is_primary=false, is_verified=false` | `primary=false verified=false` | ✅ unverified NEVER promoted |
| Invariant after | — | **0 violating sellers** | ✅ |

**On-device (iOS, iPhone 17 Pro Max), item 2's own deliverable:**

1. Re-applied `single-verified-nonprimary` ⇒ `stripe_connect[primary=true verified=true]`, balance `$50.00`.
2. Fresh mount of Payout Settings shows **`primary-chip-<id>`** present and the radio labelled **“Current primary method”**.
3. Tapped **Withdraw Now** ⇒ the **WithdrawModal** opened (“Withdraw Funds”, Available `$50.00`, fee `-$0.38`, You'll Receive `$49.62`, Payout Method `Stripe (acct_****mary)`) — **the NoMethodModal / “Add Payout Method” branch did NOT fire** ✅. Cancelled without submitting (no transfer minted).

Evidence: `screenshots/MOBILE-withdraw-modal-primary-recognised.png`

**⚠️ Trap found while verifying this leg — record it for QA and for the guide:** the FIRST attempt produced a **false negative**. After re-applying the fixture, the already-mounted Payout Settings screen **retained its stale `methods` state** (a deep link into an already-mounted route re-focuses it rather than remounting — the documented R96 class), so the guard still fired with the *incomplete* variant even though the DB already said `primary=true, verified=true, onboarding_complete=true`. Only a **cold app relaunch** produced a fresh mount and the correct result. Any future test of this screen must **cold-reload or pull-to-refresh** before asserting, or it will report a regression that does not exist.

### Tier-2 note

Change Classification **A** (migration) → Tier 2 required.

- "DB rebuild from migrations" — **blocked by a pre-existing repo defect** (FIX-Task-35: 111 legacy-numbered files sort before the base schema, so `supabase db reset` cannot pass). This needs an **owner decision** (scheduled as its own task, or explicitly accepted-degraded); per Blocked-Tier Discipline it is not silently re-deferred a further time.
- "DB lint" + "real invocation of every changed branch" — **PASS**. The migration was **executed** (7/7 local assertions, applied twice) and every branch was invoked for real: promotion, negative control, already-primary no-op, ambiguous two-verified no-op, explicit unset, and the backfill.
- The migration file is **Mode B (idempotent)**, so a future `db push` re-applying it is safe — which matters because BP-81 means `list_migrations` does not record the MCP-applied DDL.
