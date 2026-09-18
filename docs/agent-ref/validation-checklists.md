# Validation checklists (Section 6)

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

6. Common pitfalls & validation checklist
Before implementing any feature, validate against these common issues:

6.1 Subscription gating validation
✅ SP features: Earning, spending, wallet access → Kids Club+ only
✅ Payment preferences: "Accept SP" / "Donate" → Kids Club+ only (Free users: Cash Only)
✅ Discovery priority: Subscribers get higher listing visibility
✅ Grace period logic: 90 days with frozen (not deleted) SP after cancellation
⚠️ Don't gate: Basic listing creation, search/browse, messaging, reviews

6.2 Swap Points calculation validation
✅ 50% cap: User can never pay more than 50% of item price with SP
✅ Pending period: Earned SP stays "pending" for 3 days (can be reverted on return)
✅ Platform fee: Buyer ALWAYS pays cash platform fee, even when using SP
✅ Seller choice: Respect seller's payment preference (Cash Only / Accept SP / Donate)
✅ No cash-out: SP can never be converted to fiat currency
✅ Expiration: SP expires after 90 days of inactivity (subscriber-only)
6.3 Database & RLS validation
✅ RLS policies: Every table with user data must have RLS enabled
✅ Node isolation: Users can only see listings/transactions in their node (or nodes they manage)
✅ Soft deletes: Use deleted_at for listings, transactions, messages (audit trail)
✅ Indexing: Add indexes on foreign keys, frequently queried columns (node_id, user_id, status, created_at)


6.4 Edge Function validation
✅ Auth verification: Every Edge Function must validate JWT and extract user_id
✅ Input validation: Validate all inputs with Zod or similar schema validator
✅ Error responses: Return structured errors: { error: { code: string, message: string, details?: any } }
✅ Transaction safety: Use Postgres transactions for multi-table operations (SP + transaction creation)
✅ Idempotency: Critical operations (payments, SP adjustments) should be idempotent
✅ **Column existence pre-check**: Before deploying any Edge Function that uses `.select('col_a, col_b, ...')`, verify EVERY column name exists on the target table using `information_schema.columns`. Missing columns cause silent 404 errors. Run:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = '<table>' AND column_name IN ('col_a', 'col_b');
   ```
6.5 Mobile app validation
✅ Loading states: Show loading indicators for all async operations
✅ Error handling: Display user-friendly error messages with retry options
✅ Offline support: Cache critical data (user profile, wallet balance, active listings)
✅ Deep linking: Support deep links for notifications (message, transaction status change)
✅ Feature flags: Check subscription status before showing premium features
6.6 Testing validation
✅ Unit tests: Test pure business logic (SP calculations, fee formulas)
✅ Integration tests: Test Edge Functions with mock Supabase client
✅ E2E tests: Test critical user flows (signup → list item → purchase with SP)
✅ Test data: Create seeded test users (free + subscriber, different nodes)
