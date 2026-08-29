/**
 * DT-54 pre-state check #2 (READ-ONLY): subscriptions for all QA buyers + Stripe PM
 * validity for the candidates (retrieve via test key — read-only).
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Missing SUPABASE_URL / SERVICE_ROLE'); process.exit(2); }

const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const BUYERS = {
  'test-buyer': '49243010-f458-4744-add1-a6c84ab95f1f',
  'test-buyer-2': 'a1234567-0000-0000-0000-000000000003',
  'test-buyer-3': 'a1234567-0000-0000-0000-000000000004',
  'test-free': 'a1234567-0000-0000-0000-000000000001',
};

async function main() {
  for (const [name, uid] of Object.entries(BUYERS)) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_payment_method_id, stripe_customer_id, status')
      .eq('user_id', uid)
      .maybeSingle();
    console.log(`\n${name} (${uid}):`, sub ? JSON.stringify(sub) : '(NO sub row)');
  }

  if (STRIPE_KEY) {
    const pmIds = [
      'pm_1To5Vb4I6kCJlvXoCUYo0CI3', // test-buyer MASTERCARD (memory)
      'pm_1U9l644I6kCJlvXoCCKRUJik', // test-buyer-3 MASTERCARD (memory)
    ];
    for (const pm of pmIds) {
      const res = await fetch(`https://api.stripe.com/v1/payment_methods/${pm}`, {
        headers: { Authorization: `Bearer ${STRIPE_KEY}` },
      });
      const j = await res.json();
      console.log(`\nStripe PM ${pm}: ${res.ok ? `OK card=${j.card?.brand} •••• ${j.card?.last4} customer=${j.customer}` : `ERR ${res.status} ${j.error?.message}`}`);
    }
  } else {
    console.log('\n(no ~/.dt11-stripe-key — skipping Stripe PM checks)');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
