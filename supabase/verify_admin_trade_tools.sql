-- Verification SQL for TRADE-V2-009

-- 1. Check if admin_audit_logs table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'admin_audit_logs'
);

-- 2. Test admin_get_trade_analytics RPC
SELECT admin_get_trade_analytics();

-- 3. Test admin_force_cancel_trade_db RPC (Dry Run - find a pending trade first)
-- SELECT admin_force_cancel_trade_db(
--   (SELECT id FROM trades WHERE status = 'pending' LIMIT 1),
--   (SELECT id FROM auth.users LIMIT 1),
--   'Verification test'
-- );

-- 4. Check audit logs
SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 5;
