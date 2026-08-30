/**
 * QA Task 9 — verify the saved-cart switch SAVED_CART_LIMIT_REACHED fix.
 * Calls rpc_cart_switch_to_saved as test-buyer with 3 saved + 1 active cart.
 * Expect: success=false + error.code='SAVED_CART_LIMIT_REACHED' +
 * error.message='You already have 3 saved carts. Delete one to save a new one.'
 * (friendly, NOT the raw "SAVED_CART_LIMIT_REACHED: user already has 3 saved carts").
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

// Target one of the 3 seeded saved carts (Puzzle Set cart).
const { data, error } = await sb.rpc('rpc_cart_switch_to_saved', {
  p_cart_id: '6d5c5cda-417e-4b53-96a0-691c3f94e4dd',
});
if (error) {
  console.log('=== PostgREST error (raw path — would be the bug) ===');
  console.log('error.message:', error.message);
  process.exit(0);
}
console.log('=== RPC structured response ===');
console.log(JSON.stringify(data, null, 2));
