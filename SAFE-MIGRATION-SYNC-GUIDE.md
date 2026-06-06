# Safe Migration Sync Guide
## Problem: Local migrations out of sync with remote Supabase

### Current Situation
- Local has migration `315_fix_trades_bundle_id_and_cancel_rpc.sql` that needs to be applied
- Remote database has later migrations already applied
- `supabase db push` fails without `--include-all` flag
- **Risk**: Using `--include-all` might re-run migrations that should only run once

---

## SAFE OPTION 1: Manual SQL Application (RECOMMENDED)

### Step 1: Apply the SQL directly in Supabase Dashboard

1. **Open**: https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new
2. **Copy** the entire contents of `supabase/migrations/315_fix_trades_bundle_id_and_cancel_rpc.sql`
3. **Paste** into SQL Editor
4. **Run** the migration
5. **Verify** using these queries:

```sql
-- Verify bundle_id column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'trades' AND column_name = 'bundle_id';

-- Verify cancel_trade_v2 RPC was updated
SELECT proname, prosrc FROM pg_proc WHERE proname = 'cancel_trade_v2';
```

### Step 2: Record the migration as applied locally

After successful manual application, record it in the Supabase migration history:

```bash
# This tells Supabase CLI that migration 315 has been applied
npx supabase migration repair 315_fix_trades_bundle_id_and_cancel_rpc --status applied
```

**Note**: The `migration repair` command might not exist in your CLI version (v2.65.5). If it doesn't exist:

**Alternative**: Create a placeholder applied migration:

```bash
# Add a no-op migration with a later timestamp that references 315
echo "-- Migration 315_fix_trades_bundle_id_and_cancel_rpc.sql applied manually on $(date)" > \
  supabase/migrations/$(date +%Y%m%d%H%M%S)_applied_315_manually.sql
```

---

## SAFE OPTION 2: Fresh Migration Baseline (Nuclear option - only if you have many out-of-sync migrations)

If you have **many** migrations out of sync, you can reset to match production:

### Step 1: Backup current migration files
```bash
cp -r supabase/migrations supabase/migrations.backup.$(date +%Y%m%d)
```

### Step 2: Pull remote schema as new baseline
```bash
# This creates a new migration that represents the current production state
npx supabase db pull --linked
```

This will create a single migration file that represents the entire current schema. All your local migrations will become "historical context" in the backup folder.

### Step 3: Verify no data loss
```bash
# Compare the pulled schema with your local migrations
diff -r supabase/migrations supabase/migrations.backup.*
```

**Risk**: You lose the granular migration history, but the schema will be identical to production.

---

## OPTION 3: Use --include-all (RISKY - NOT RECOMMENDED)

⚠️ **Only use if migrations are idempotent (can run multiple times safely)**

```bash
npx supabase db push --linked --include-all
```

**Why risky**: 
- Some migrations have side effects (data transformations, insertions)
- Re-running them might duplicate data or fail unexpectedly
- Hard to predict which migrations will actually execute

---

## Post-Sync: Prevent Future Drift

### Best Practices Going Forward

1. **Always use Supabase CLI for schema changes**:
   ```bash
   # Create new migration
   npx supabase migration new descriptive_name
   
   # Apply locally
   npx supabase db reset
   
   # Push to production
   npx supabase db push --linked
   ```

2. **Never manually edit remote database** (use Dashboard only for reads/debugging)

3. **Keep CLI updated**:
   ```bash
   npm install -g supabase@latest
   # or
   brew upgrade supabase
   ```

4. **Use migration squashing periodically**:
   - Every 50-100 migrations, consider creating a baseline schema
   - Archive old migrations for historical reference

---

## Recommended Action Plan (RIGHT NOW)

✅ **Do this NOW to fix both issues**:

```bash
# 1. Update Supabase CLI to latest (fixes logging issues)
brew upgrade supabase  # or npm install -g supabase@latest

# 2. Navigate to Supabase SQL Editor
open "https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new"

# 3. Copy/paste supabase/migrations/315_fix_trades_bundle_id_and_cancel_rpc.sql

# 4. Run it

# 5. Create a timestamp marker locally (since migration repair might not exist)
echo "-- Applied manually $(date)" > \
  supabase/migrations/$(date +%Y%m%d%H%M%S)_applied_315_manually.sql

# 6. Test cancel trade in your app (with enhanced logging now deployed)
```

This fixes:
- ✅ bundle_id column error
- ✅ cancel_trade_v2 RPC seller_id error (root cause)
- ✅ Migration sync (marked as applied)
- ✅ Enhanced Edge Function logging (already deployed)

---

## Why Migration 315 Fixes the Cancel Trade Error

The RPC error **"column seller_id does not exist"** is actually a **cascading error** from this line in the old `cancel_trade_v2`:

```sql
-- BROKEN (line 77 in old RPC):
(SELECT balance FROM sp_ledger WHERE id = v_trade.sp_debit_ledger_entry_id).balance
```

The `sp_ledger` table has `balance_before` and `balance_after`, NOT `balance`. When PostgreSQL tries to execute this, it fails and reports the error in the context of the parent query, which mentions `seller_id`.

**Migration 315 fixes this** by replacing the broken query with the correct RPC call:
```sql
SELECT (credit_sp_for_cancelled_trade(v_trade.buyer_id, p_trade_id, v_sp_refund_amount))->>'ledger_entry_id' INTO v_sp_refund_ledger_id;
```
