/**
 * QA Task 9 — DT-63 M13 server-side verification (read-only).
 * Calls rpc_cart_validate_for_checkout as test-buyer to confirm the server
 * cart_total_cents excludes the realtime-unavailable item (matches client $80).
 * Read-only RPC — no writes.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
  process.exit(1);
}

const sb = createClient(url, anonKey);

const { data: authData, error: authError } = await sb.auth.signInWithPassword({
  email: 'test-buyer@kidsmarketplace.test',
  password: 'TestBuyer123!',
});
if (authError || !authData.session) {
  console.error('Login failed:', authError?.message ?? 'no session');
  process.exit(1);
}
console.log('logged in as test-buyer');

const { data, error } = await sb.rpc('rpc_cart_validate_for_checkout');
if (error) {
  console.error('RPC error:', error.message);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
