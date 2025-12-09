/*
  rls_test.ts

  Small helper script to validate RLS policies using two real user sessions.

  Usage (local): set env vars then run with ts-node or compile.
    export SUPABASE_URL="https://<project>.supabase.co"
    export SUPABASE_ANON_KEY="<anon_key>"
    export BUYER_EMAIL="buyer@example.com"
    export BUYER_PASSWORD="secret1"
    export SELLER_EMAIL="seller@example.com"
    export SELLER_PASSWORD="secret2"

  Then run:
    npx ts-node ./supabase/scripts/rls_test.ts

  Notes:
  - This script expects email+password auth to be enabled in Supabase and that
    the provided accounts already exist. It signs in both users and then uses
    their sessions to exercise a few permissions (read/write) to verify RLS.
  - It only runs client-side checks via the public anon key + user sessions
    (does not require service_role).
*/

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in env');
  process.exit(1);
}

const buyerEmail = process.env.BUYER_EMAIL;
const buyerPassword = process.env.BUYER_PASSWORD;
const sellerEmail = process.env.SELLER_EMAIL;
const sellerPassword = process.env.SELLER_PASSWORD;

if (!buyerEmail || !buyerPassword || !sellerEmail || !sellerPassword) {
  console.error('Missing BUYER_EMAIL/BUYER_PASSWORD or SELLER_EMAIL/SELLER_PASSWORD');
  process.exit(1);
}

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, session: data.session };
}

async function run() {
  try {
    console.log('Signing in buyer...');
    const buyer = await signIn(buyerEmail!, buyerPassword!);
    console.log('Signing in seller...');
    const seller = await signIn(sellerEmail!, sellerPassword!);

    // attach auth
    const buyerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    buyerClient.auth.setAuth(buyer.session!.access_token!);

    const sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sellerClient.auth.setAuth(seller.session!.access_token!);

    // 1) Buyer tries to read another user's profile (should be restricted by RLS)
    console.log('\n1) Buyer tries to read all users (should be restricted)');
    const usersRes = await buyerClient.from('users').select('*').limit(5);
    console.log('buyer read users:', usersRes.error ? { error: usersRes.error.message } : { data: usersRes.data });

    // 2) Seller creates an item (allowed if seller_id == auth.uid())
    console.log('\n2) Seller creating an item (should succeed if seller_id = auth.uid())');
    const sellerId = seller.session!.user!.id;
    const insertRes = await sellerClient.from('items').insert([{ seller_id: sellerId, title: 'RLS test item ' + Date.now(), price_cents: 1000 }]).select();
    console.log('seller create item:', insertRes.error ? { error: insertRes.error.message } : { data: insertRes.data });

    // 3) Buyer tries to favorite the seller's item (should be allowed for buyer)
    const itemId = insertRes.data?.[0]?.id;
    if (itemId) {
      console.log('\n3) Buyer favoriting the item (should succeed)');
      const favRes = await buyerClient.from('favorites').insert([{ user_id: buyer.session!.user!.id, item_id: itemId }]).select();
      console.log('buyer favorite:', favRes.error ? { error: favRes.error.message } : { data: favRes.data });
    } else {
      console.warn('No itemId created; skip favorite test');
    }

    // 4) Buyer tries to update seller profile (should be denied by RLS)
    console.log('\n4) Buyer attempts to update seller profile (should fail)');
    const updateRes = await buyerClient.from('users').update({ bio: 'rls-check' }).eq('id', sellerId).select();
    console.log('buyer update seller profile:', updateRes.error ? { error: updateRes.error.message } : { data: updateRes.data });

    console.log('\nRLS test complete — review outputs to confirm behavior matches expectations.');
  } catch (err: any) {
    console.error('RLS check failed:', err.message || err);
    process.exit(1);
  }
}

run();
