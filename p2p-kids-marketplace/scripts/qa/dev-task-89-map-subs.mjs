/**
 * DEV-TASK-89 read-only mapping probe (GET/read-only, no mutations).
 * Lists all subscriptions on the Stripe account and maps each to its staging DB
 * `subscriptions` row (by stripe_subscription_id OR stripe_customer_id), so we can:
 *   - see each sub's real Stripe period + latest paid invoice, and
 *   - know which subs have an app-side row that is stale/frozen (only those matter).
 * Reads test key from ~/.dt11-stripe-key + staging service role from .env (never echoed).
 * Run: node scripts/qa/dev-task-89-map-subs.mjs
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) {
  console.error('Missing env');
  process.exit(2);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe GET ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
function iso(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(Number(sec)) || Number(sec) <= 0) return '(null)';
  return new Date(Number(sec) * 1000).toISOString();
}

async function main() {
  const subs = await stripeGet('/subscriptions?limit=100');
  console.log(`=== ${(subs.data || []).length} Stripe subscriptions on account ===\n`);

  for (const s of subs.data || []) {
    const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null;
    const item = s.items?.data?.[0];

    // Latest paid invoice for this sub
    let latestPaidEnd = null;
    let latestPaidId = null;
    const invs = await stripeGet(`/invoices?subscription=${s.id}&status=paid&limit=5`).catch(() => ({ data: [] }));
    if (invs.data?.length) {
      const first = invs.data[0]; // newest first
      latestPaidId = first.id;
      latestPaidEnd = first.lines?.data?.[0]?.period?.end
        ? new Date(first.lines.data[0].period.end * 1000).toISOString()
        : null;
    }

    // Staging DB row?
    let db = null;
    const q1 = await admin.from('subscriptions').select('id, user_id, status, current_period_start, current_period_end, next_billing_date, monthly_price_cents, stripe_subscription_id, stripe_customer_id')
      .eq('stripe_subscription_id', s.id).maybeSingle();
    db = q1.data ?? null;
    if (!db && custId) {
      const q2 = await admin.from('subscriptions').select('id, user_id, status, current_period_start, current_period_end, next_billing_date, monthly_price_cents, stripe_subscription_id, stripe_customer_id')
        .eq('stripe_customer_id', custId).maybeSingle();
      db = q2.data ?? null;
    }

    console.log('──────────────────────────────────────────────');
    console.log(`SUBSCRIPTION ${s.id}`);
    console.log(`  status=${s.status} | created=${iso(s.created)} | customer=${custId}`);
    console.log(`  stripe current_period: ${iso(s.current_period_start)} -> ${iso(s.current_period_end)}`);
    console.log(`  price=${item?.price?.unit_amount ?? '?'} ${item?.price?.interval ?? ''} | anchor=${iso(s.billing_cycle_anchor)}`);
    console.log(`  LATEST PAID invoice=${latestPaidId ?? '(none)'} | line period end=${latestPaidEnd ?? '(n/a)'}`);
    if (db) {
      const now = Date.now();
      const dbEnd = db.current_period_end ? Date.parse(db.current_period_end) : NaN;
      const frozen = Number.isFinite(dbEnd) && dbEnd < now;
      console.log(`  DB row id=${db.id} | user_id=${db.user_id} | status=${db.status}`);
      console.log(`  DB current_period: ${db.current_period_start ?? '(null)'} -> ${db.current_period_end ?? '(null)'} | next_billing=${db.next_billing_date ?? '(null)'} | snapshot=${db.monthly_price_cents ?? '(n/a)'}`);
      console.log(`  DB STALE/FROZEN (end in past)? ${frozen ? '⚠️ YES' : 'no'} | Stripe-latest-end=${latestPaidEnd ?? '(n/a)'}`);
    } else {
      console.log('  DB row: NONE (no app-side subscriptions row — Stripe-only object, not visible to app)');
    }
  }
  console.log('\nDone (read-only)');
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
