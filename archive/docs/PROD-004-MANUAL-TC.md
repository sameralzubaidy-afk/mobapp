# PROD-004 — Node Isolation at RLS Level — Manual Test Cases

**Spec:** `Prompts/MODULE-15.5-prod-readiness.md` (PROD-004)
**Migrations applied:** `phase5a_drop_anon_writes`, `phase5b_add_items_node_id`, `phase5c_node_isolation_rls`
**Project:** `drntwgporzabmxdqykrp` (prod, dev data only — no live users)

---

## Scope

Phase 5 implemented in three sub-phases:

- **5a** — Dropped anon INSERT/UPDATE on `items` & `profiles`; scoped `items_anon_select` to `status='available'`.
- **5b** — Added `items.node_id UUID` + backfill (231/1809 rows populated; 1578 remain NULL because their sellers have no `profiles.node_id`) + auto-populate trigger on INSERT.
- **5c** — Consolidated 13 items policies → 4 (1 service_role, 1 anon SELECT, 1 authenticated SELECT/INSERT/UPDATE each, 1 DELETE) and 7 trades policies → 5. Added `public.get_user_node_id(p_user_id UUID)` SECURITY DEFINER helper.

**Canonical authoritative column:** `profiles.node_id` (NOT `users.node_id`).

---

## Pre-Test Setup

Required test users in Supabase:
1. **User A** — Kids Club+, `profiles.node_id = NODE_X`
2. **User B** — Kids Club+, `profiles.node_id = NODE_Y` (different from A)
3. **User C** — Free, `profiles.node_id = NODE_X` (same as A)
4. **User D** — Admin (`profiles.role = 'admin'`), any node
5. **User E** — No node (`profiles.node_id IS NULL`)

Required listings:
- 5 items by User A in NODE_X (`status='available'`)
- 5 items by User B in NODE_Y (`status='available'`)
- 1 item by User E with no node

---

## TC-NODE-01: Cross-node items are INVISIBLE

**Steps:**
1. Login as User A (NODE_X).
2. Open Discovery / item feed.
3. Pull-to-refresh.

**Expected:**
- User A sees items in NODE_X (own + User C's).
- User A does NOT see User B's NODE_Y items.
- User A does NOT see User E's NULL-node items.

**Failure modes if broken:** `items_select_own_node` policy missing `node_id =` check, OR `get_user_node_id` returns NULL for the user.

---

## TC-NODE-02: Own items always visible (escape hatch)

**Steps:**
1. Login as User E (no node).
2. Create an item.
3. Open "My Listings".

**Expected:** User E sees their own item even though `node_id` is NULL for both user and item (matches `OR seller_id = auth.uid()` clause).

---

## TC-NODE-03: Anon (logged-out) browse only available items

**Steps:**
1. Logout. Use anon client to query items.

**Expected:**
- Only `status='available'` items returned.
- Items with `status IN ('sold','pending_review','draft','deleted')` are NOT returned.

---

## TC-NODE-04: Anon cannot INSERT or UPDATE items

**Steps:** Use anon client to attempt `INSERT INTO items` and `UPDATE items SET ...`.

**Expected:** Both fail with RLS error. `items_anon_insert` and `items_anon_update` policies have been dropped.

---

## TC-NODE-05: Anon cannot INSERT or UPDATE profiles

**Steps:** Use anon client to attempt INSERT/UPDATE on `profiles`.

**Expected:** Both fail with RLS error.

---

## TC-NODE-06: Cross-node trades are INVISIBLE

**Steps:**
1. Seed a trade where buyer=User A (NODE_X) and seller=User B (NODE_Y), with `trades.node_id = NODE_Y`.
2. Login as User A. Open "My Trades".

**Expected:**
- User A does NOT see this trade because `trades.node_id (NODE_Y) != User A's node (NODE_X)`.
- This is the intended isolation: cross-node trades require both parties to be in the same node at creation time.

**Note:** Existing trades with `node_id IS NULL` remain visible to participants (`node_id IS NULL OR node_id = ...` clause).

---

## TC-NODE-07: Admin sees all trades

**Steps:**
1. Login as User D (admin).
2. Open admin trades view (uses authenticated client, not service_role).

**Expected:** All trades visible regardless of node, via `trades_admin_select` policy.

---

## TC-NODE-08: Discovery feed not broken for valid users

**Critical regression check.**

**Steps:**
1. Login as User A.
2. Open Discovery tab.
3. Verify items load.

**Expected:** Items render (own node + own listings). No empty-state if NODE_X has listings.

**If empty:** check `profiles.node_id` for User A is set. Run:
```sql
SELECT user_id, node_id FROM profiles WHERE user_id = '<USER_A_UUID>';
```

---

## TC-NODE-09: Listing creation auto-populates node_id

**Steps:**
1. Login as User A (NODE_X).
2. Create a new listing without specifying node_id in client.
3. Query: `SELECT node_id FROM items WHERE id = '<NEW_ITEM_ID>';`

**Expected:** `node_id = NODE_X` (auto-populated by `trg_set_item_node_id` trigger from seller's profile).

---

## TC-NODE-10: Seller cannot insert item as another seller

**Steps:** Login as User A. Attempt to insert `INSERT INTO items (seller_id, ...) VALUES ('<USER_B_UUID>', ...)`.

**Expected:** RLS violation. `items_insert_own_seller` WITH CHECK requires `seller_id = auth.uid()`.

---

## TC-NODE-11: Service role (admin portal / edge functions) bypasses isolation

**Steps:** From admin portal (uses `SUPABASE_SERVICE_ROLE_KEY`), query items across all nodes.

**Expected:** All items returned. `items_service_role` policy `USING (true)` preserved.

---

## TC-NODE-12: `get_user_node_id` returns correct node

**Steps (SQL editor):**
```sql
SELECT public.get_user_node_id('<USER_A_UUID>'::uuid);
```

**Expected:** Returns `NODE_X` UUID. Returns NULL for users without a profile.

---

## Verification Queries (BP-10)

```sql
-- 1. Confirm anon policies on items/profiles are SELECT-only
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('items','profiles') AND 'anon' = ANY(roles);
-- Expected: only items_anon_select and profiles_anon_select remain.

-- 2. Confirm items policy stack is consolidated
SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='items' ORDER BY cmd, policyname;
-- Expected: items_service_role (ALL), Sellers can delete own items (DELETE),
-- items_insert_own_seller (INSERT), items_anon_select + items_select_own_node (SELECT),
-- items_update_own_seller (UPDATE)

-- 3. Confirm trades policy stack is consolidated
SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='trades' ORDER BY cmd, policyname;
-- Expected: trades_insert_own (INSERT), trades_admin_select + trades_select_own_node (SELECT),
-- trades_update_own (UPDATE) + any pre-existing service_role policy

-- 4. Confirm helper exists
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_user_node_id';
-- Expected: 1 row, prosecdef=true

-- 5. Backfill stats
SELECT COUNT(*) AS total, COUNT(node_id) AS with_node FROM public.items;
-- Current: 1809 total, 231 with node
```

---

## Rollback Plan

If issues arise:

```sql
-- Revert 5c
DROP POLICY IF EXISTS items_select_own_node ON public.items;
DROP POLICY IF EXISTS items_insert_own_seller ON public.items;
DROP POLICY IF EXISTS items_update_own_seller ON public.items;
DROP POLICY IF EXISTS trades_select_own_node ON public.trades;
DROP POLICY IF EXISTS trades_admin_select ON public.trades;
DROP POLICY IF EXISTS trades_insert_own ON public.trades;
DROP POLICY IF EXISTS trades_update_own ON public.trades;
DROP FUNCTION IF EXISTS public.get_user_node_id(UUID);
-- Then re-create permissive policies from migration backups or pg_policies snapshot taken before 5c.

-- Revert 5b (only if absolutely needed)
DROP TRIGGER IF EXISTS trg_set_item_node_id ON public.items;
DROP FUNCTION IF EXISTS public.set_item_node_id_from_seller();
DROP INDEX IF EXISTS idx_items_node_id;
ALTER TABLE public.items DROP COLUMN IF EXISTS node_id;

-- Revert 5a
CREATE POLICY items_anon_insert ON public.items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY items_anon_update ON public.items FOR UPDATE TO anon USING (true);
CREATE POLICY profiles_anon_insert ON public.profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY profiles_anon_update ON public.profiles FOR UPDATE TO anon USING (true);
-- (Do NOT re-add the unconstrained items_anon_select; keep the scoped version.)
```

---

## Findings Surfaced During Audit (Out-of-Scope for PROD-004)

The Phase 5a audit revealed additional critical anon-policy leaks on other tables:

| Table | Policies to fix |
|---|---|
| `subscriptions` | anon INSERT/SELECT/UPDATE all `true` — anyone can read/write subscriptions |
| `referrals` | anon INSERT/SELECT/UPDATE all `true` |
| `user_notifications` | anon INSERT/SELECT/UPDATE all `true` |

These were NOT touched in Phase 5 (out of scope per spec). Recommend a follow-on `PROD-004b` mini-phase to lock these down. Risk level: HIGH (subscriptions in particular).
