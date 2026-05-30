# Manual Test Cases — PROD-001 (SP Wallet RLS) & PROD-002 (admin_config RLS)

Phase 3 of MODULE-15.5 Production Readiness. Verifies that:
- Anonymous (unauthenticated) clients can no longer read or write `sp_wallets`, `sp_ledger`, or `admin_config`.
- Authenticated user flows that depend on these tables continue to work.
- Edge Functions (service role) and the admin portal are unaffected.

> **Consolidation note:** A single master manual-TC file will be produced at the end of MODULE-15.5 (per user request). Until then, each phase keeps its own per-phase doc.

---

## Pre-conditions

- Migration `20260601000002_fix_sp_wallet_admin_config_rls.sql` applied to `drntwgporzabmxdqykrp`.
- A real authenticated test user with `EXPO_PUBLIC_SUPABASE_ANON_KEY` available.

---

## PROD-001 — sp_wallets / sp_ledger anon access removed

### TC-001-01 — No anon policies remain

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('sp_wallets','sp_ledger')
  AND roles::text LIKE '%anon%';
```
**Expected:** 0 rows.

### TC-001-02 — Remaining policies are the safe ones

```sql
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE tablename IN ('sp_wallets','sp_ledger')
ORDER BY tablename, policyname;
```
**Expected:**
- `sp_wallets`: `Service role can access all sp_wallets` (service_role), `Users can insert own wallet` (public/INSERT), `Users can view own wallet` (public/SELECT).
- `sp_ledger`: `Service role can access all sp_ledger` (service_role), `Users can view own ledger` (public/SELECT).

### TC-001-03 — Anonymous client cannot read sp_wallets

In a Node REPL or browser console with the anon key only (no JWT):
```js
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await supa.from('sp_wallets').select('*').limit(5);
console.log({ data, error });
```
**Expected:** `data = []` (RLS returns no rows; no error string thrown).

### TC-001-04 — Anonymous client cannot insert/update sp_wallets

```js
const { error: insertErr } = await supa.from('sp_wallets').insert({ user_id: '00000000-0000-0000-0000-000000000099', balance: 999 });
const { error: updateErr } = await supa.from('sp_wallets').update({ balance: 999 }).eq('user_id', '00000000-0000-0000-0000-000000000001');
console.log({ insertErr, updateErr });
```
**Expected:** Both errors include `new row violates row-level security policy` or empty affected rows.

### TC-001-05 — Authenticated user reads OWN wallet (not others')

After signing in as a known test user:
```js
const { data, error } = await authedSupa.from('sp_wallets').select('user_id, balance').limit(10);
```
**Expected:** Returns 0 or 1 row; the only row (if any) has `user_id === currentUserId`.

### TC-001-06 — Authenticated user reads OWN ledger entries

```js
const { data, error } = await authedSupa.from('sp_ledger').select('user_id, delta, reason').limit(10);
```
**Expected:** All rows have `user_id === currentUserId`.

### TC-001-07 — Mobile SP wallet screen still renders

In the running app, sign in as a subscriber and open the Wallet screen.
**Expected:** Available balance + pending balance display correctly; no PostgREST/RLS errors in the console.

### TC-001-08 — Admin portal SP wallet management still works

Open `p2p-kids-admin` SP wallet management page (uses service role).
**Expected:** All wallets listed, balance editing succeeds.

---

## PROD-002 — admin_config restricted to authenticated

### TC-002-01 — No anon-readable policies remain

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'admin_config' AND roles::text LIKE '%anon%';
```
**Expected:** 0 rows.

### TC-002-02 — Authenticated SELECT policy exists

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'admin_config' AND policyname = 'admin_config_authenticated_read';
```
**Expected:** 1 row, cmd = SELECT, roles = `{authenticated}`.

### TC-002-03 — Anonymous client cannot read admin_config

```js
const supa = createClient(URL, ANON_KEY);
const { data, error } = await supa.from('admin_config').select('*').limit(5);
console.log({ data, error });
```
**Expected:** `data = []`. (Pre-fix this returned the full config.)

### TC-002-04 — Authenticated client can read admin_config

After login:
```js
const { data, error } = await authedSupa.from('admin_config').select('key, value').limit(10);
```
**Expected:** Non-empty `data`; `error` is null.

### TC-002-05 — Mobile app trade/SP screens still load config

In the app, perform an action that triggers `getAdminConfig` (e.g., open a listing, start a trade flow). Watch the console.
**Expected:** No `Failed to fetch admin config` warnings; trade flow displays correct fee/SP values.

### TC-002-06 — Admin portal can still write admin_config

In admin portal, change a config value and save.
**Expected:** Save succeeds (service role bypasses RLS).

### TC-002-07 — Edge Functions still read admin_config

Trigger any edge function that reads admin_config (e.g., `setup-subscription-payment`, `transactions-update`, `grace-period-cron`).
**Expected:** Function logs show the config values were read normally.

---

## Rollback

If a regression appears in production, run:

```sql
-- EMERGENCY ONLY — restores anon access (re-introduces the vulnerability).
CREATE POLICY "sp_wallets_anon_select" ON public.sp_wallets FOR SELECT TO anon USING (true);
CREATE POLICY "sp_wallets_anon_insert" ON public.sp_wallets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "sp_wallets_anon_update" ON public.sp_wallets FOR UPDATE TO anon USING (true);
CREATE POLICY "sp_ledger_anon_select" ON public.sp_ledger FOR SELECT TO anon USING (true);
CREATE POLICY "sp_ledger_anon_insert" ON public.sp_ledger FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read admin config" ON public.admin_config FOR SELECT USING (true);
```
Then root-cause the regression and re-apply `20260601000002_fix_sp_wallet_admin_config_rls.sql`.
