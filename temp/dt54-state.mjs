/**
 * DT-54 pre-state check (READ-ONLY, service-role).
 * Prints: charge_one_fee_per_bundle, test-buyer saved PM/sub, pending offers with
 * test-seller, test-seller node, and the resolved buyer fee for the repro amounts.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const BUYER_ID = '49243010-f458-4744-add1-a6c84ab95f1f'; // test-buyer
const SELLER_ID = '14be337c-aad6-403f-bab2-ba1a7d80b666'; // test-seller

async function main() {
  // 1. charge_one_fee_per_bundle
  const { data: feeMode } = await admin
    .from('admin_config')
    .select('value, is_active, category')
    .eq('key', 'charge_one_fee_per_bundle')
    .maybeSingle();
  console.log('charge_one_fee_per_bundle:', feeMode ? JSON.stringify(feeMode) : '(row not found)');

  // 2. test-buyer subscription / saved card
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_payment_method_id, stripe_customer_id, status, subscription_tier')
    .eq('user_id', BUYER_ID)
    .maybeSingle();
  console.log('test-buyer sub:', sub ? JSON.stringify(sub) : '(none)');

  // 3. pending offers test-buyer -> test-seller
  const { data: pending } = await admin
    .from('trades')
    .select('id, listing_id, status')
    .eq('buyer_id', BUYER_ID)
    .eq('seller_id', SELLER_ID)
    .in('status', ['pending', 'payment_failed', 'in_progress']);
  console.log(`test-buyer pending offers w/ test-seller: ${pending?.length ?? 0}`);
  for (const t of pending ?? []) console.log('   ', t.id, t.listing_id, t.status);

  // 4. test-seller node
  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('user_id, node_id, phone_verified')
    .eq('user_id', SELLER_ID)
    .maybeSingle();
  console.log('test-seller profile:', sellerProfile ? JSON.stringify(sellerProfile) : '(none)');

  // 5. resolved buyer fees for the repro amounts (same RPC the EF uses)
  for (const cash of [2600, 7800, 2100]) {
    const { data, error } = await admin.rpc('fn_get_buyer_fee_for_checkout', {
      p_user_id: BUYER_ID,
      p_cash_portion_cents: cash,
    });
    const row = Array.isArray(data) ? data?.[0] : data;
    console.log(`fee for cashPortion=${cash}:`, error ? `ERR ${error.message}` : JSON.stringify(row));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
