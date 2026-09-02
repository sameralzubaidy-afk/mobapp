/**
 * DEV-TASK-83 (Z05) verification harness — step 1.
 * Buyer requests a WHOLE-BUNDLE cancellation via fn_request_cancel_trade
 * (the exact RPC the mobile `requestCancelTrade` service calls).
 *
 * Usage (from anywhere; env from p2p-kids-marketplace/.env[.staging]):
 *   node temp/dt83-request-cancel.mjs <tappedTradeId> [scope] [reason]
 *   scope defaults to 'all' (whole bundle), matching the app default.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const BUYER = {
  id: '49243010-f458-4744-add1-a6c84ab95f1f',
  email: 'test-buyer@kidsmarketplace.test',
  password: 'TestBuyer123!',
};

const TRADE_ID = process.argv[2];
const SCOPE = process.argv[3] || 'all';
const REASON = process.argv[4] || 'qa z05 whole-bundle cancel (DEV-TASK-83)';

if (!TRADE_ID) {
  console.error('❌ <tappedTradeId> is required.');
  process.exit(2);
}
if (!SUPABASE_URL || !ANON) {
  console.error('❌ Missing SUPABASE_URL / anon key (.env / .env.staging).');
  process.exit(2);
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: BUYER.email, password: BUYER.password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`GoTrue password grant -> ${res.status} ${JSON.stringify(json)}`);
  const jwt = json.access_token;
  console.log('[dt83] buyer JWT exchanged.');

  // Raw PostgREST RPC call with the app's exact headers (apikey + Bearer JWT),
  // mirroring ef-repro.mjs. Avoids supabase-js setSession ambiguity.
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_request_cancel_trade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      p_trade_id: TRADE_ID,
      p_user_id: BUYER.id,
      p_reason: REASON,
      p_scope: SCOPE,
    }),
  });
  const body = await rpcRes.json().catch(() => ({}));
  console.log(`[dt83] fn_request_cancel_trade -> HTTP ${rpcRes.status}`, JSON.stringify(body, null, 2));
}

main().catch((e) => {
  console.error('[dt83]', e.message);
  process.exit(1);
});
