# MSG-004 QUICK START ⚡

## Copy-Paste Commands for Testing

### 1️⃣ Run Migration (Supabase SQL Editor)
Open: https://supabase.com/dashboard → SQL Editor → New Query

```sql
-- Copy/paste entire content from:
-- supabase/migrations/081_message_expiration.sql
```

**Verify:**
```sql
SELECT key, value FROM admin_config WHERE key = 'message_expiration_days';
-- Expected: 1 row, value = '30'

SELECT proname FROM pg_proc WHERE proname = 'mark_expired_messages';
-- Expected: 1 row
```

---

### 2️⃣ Deploy Edge Function

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
npx supabase functions deploy cleanup-messages --project-ref <YOUR_PROJECT_REF>
```

**Test:**
```bash
curl -X POST https://<PROJECT>.supabase.co/functions/v1/cleanup-messages \
  -H "Authorization: Bearer <ANON_KEY>"
```

Expected response:
```json
{"success": true, "deleted_count": 0, "timestamp": "..."}
```

---

### 3️⃣ Run Unit Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Set env vars
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<your_anon_key>"

# Run tests
npm test -- src/__tests__/services/message-expiration.test.ts
```

Expected: **10 tests passed** ✅

---

### 4️⃣ Manual Test (SQL Editor)

**DRY RUN - See what would be deleted:**
```sql
SELECT COUNT(*) AS eligible_messages
FROM messages m
INNER JOIN trades t ON m.trade_id = t.id
WHERE m.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.completed_at < (NOW() - INTERVAL '30 days');
```

**Execute Function:**
```sql
SELECT mark_expired_messages();
-- Returns: count of deleted messages
```

**Verify Deletion:**
```sql
SELECT COUNT(*) FROM messages WHERE deleted_at IS NOT NULL;
-- Should increase after running function
```

---

### 5️⃣ Test Mobile App

1. Open app
2. Navigate to any completed trade chat
3. Verify messages display correctly
4. No deleted messages should appear

---

## 🔥 Quick Verification Checklist

- [ ] Migration ran without errors
- [ ] Admin config exists (`message_expiration_days = 30`)
- [ ] Function `mark_expired_messages()` exists
- [ ] Edge Function deployed successfully
- [ ] Unit tests pass (10/10)
- [ ] Function executes without error
- [ ] Deleted messages excluded from app
- [ ] Manual test guide reviewed

---

## 📞 Need Help?

**Issue:** Function doesn't exist  
**Fix:** Re-run migration in SQL Editor

**Issue:** Edge Function returns 500  
**Fix:** Check Supabase Dashboard → Edge Functions → Logs

**Issue:** Tests fail with missing env vars  
**Fix:** Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Issue:** No messages deleted (count = 0)  
**Fix:** Normal if no completed trades older than 30 days exist

---

## 📚 Full Documentation

- **Implementation:** `/MSG-004-IMPLEMENTATION-COMPLETE.md`
- **Manual Testing:** `/MSG-004-MANUAL-TESTING-GUIDE.md`
- **Migration:** `/supabase/migrations/081_message_expiration.sql`
- **Edge Function:** `/supabase/functions/cleanup-messages/index.ts`
- **Unit Tests:** `/p2p-kids-marketplace/src/__tests__/services/message-expiration.test.ts`
- **E2E Tests:** `/p2p-kids-marketplace/e2e/message-expiration.e2e.ts`

---

## ✅ STATUS: READY FOR PRODUCTION

All code complete, tests written, documentation provided.

**Next:** Run migration in Supabase SQL Editor ▶️
