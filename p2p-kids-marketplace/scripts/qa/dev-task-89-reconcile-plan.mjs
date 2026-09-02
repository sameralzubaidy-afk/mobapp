/**
 * DEV-TASK-89 reconciliation PLAN (read-only dry-run by default).
 *
 * The webhook fix (Part 1 config + Part 2 code) is deployed and makes FUTURE
 * renewals advance correctly. But all 7 existing subscriptions on this Stripe
 * account have DB rows frozen at their original first-period end, because their
 * past renewals fired BEFORE `invoice.payment_succeeded` was subscribed and
 * Stripe never replays events. To close DT-88/DT-89 completely (make the app
 * reflect Stripe reality NOW), we propose a one-time reconciliation:
 *
 *   For each app-side subscriptions row, derive the correct current period from
 *   Stripe's LATEST PAID invoice line period (mirroring computePeriodAdvance),
 *   and insert the missing billing_history rows for the real paid renewals that
 *   were never recorded (upsert on charge_id, idempotent).
 *
 * This script ONLY prints the exact proposed updates (no DB writes). Use the
 * printed plan to get owner approval before applying (Phase 2).
 * Run: node scripts/qa/dev-task-89-reconcile-plan.mjs
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
if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) { console.error('Missing env'); process.exit(2); }
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe GET ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
function iso(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(Number(sec)) || Number(sec) <= 0) return null;
  return new Date(Number(sec) * 1000).toISOString();
}

async function main() {
  const subs = await stripeGet('/subscriptions?limit=100');
  console.log('DT-89 RECONCILIATION PLAN (dry-run — NO writes)\n');

  const plans = []; // per DB row
  for (const s of subs.data || []) {
    const custId = typeof s.customer === 'string' ? s.customer : null;
    const invs = await stripeGet(`/invoices?subscription=${s.id}&status=paid&limit=50`).catch(() => ({ data: [] }));
    const paid = invs.data || [];

    // DB row
    let db = null;
    const q1 = await admin.from('subscriptions').select('id, user_id, stripe_subscription_id, stripe_customer_id, current_period_end')
      .eq('stripe_subscription_id', s.id).maybeSingle();
    db = q1.data ?? null;
    if (!db && custId) {
      const q2 = await admin.from('subscriptions').select('id, user_id, stripe_subscription_id, stripe_customer_id, current_period_end')
        .eq('stripe_customer_id', custId).maybeSingle();
      db = q2.data ?? null;
    }
    if (!db) { console.log(`sub ${s.id}: NO app row (skipped)`); continue; }

    // Existing billing rows for this user
    const { data: existingBilling } = await admin.from('billing_history')
      .select('charge_id').eq('user_id', db.user_id);
    const have = new Set((existingBilling || []).map((b) => b.charge_id));

    const missing = [];
    for (const inv of paid) {
      const line = inv.lines?.data?.[0]?.period;
      const chargeId = (typeof inv.charge === 'string' && inv.charge) || (typeof inv.payment_intent === 'string' && inv.payment_intent) || inv.id;
      const isZero = (inv.amount_paid ?? 0) === 0;
      if (have.has(chargeId)) continue;
      // Record renewals (nonzero) + the initial $0 trial invoice is already present/omitted
      if (isZero && inv.id !== (paid[paid.length - 1]?.id)) continue; // skip historical $0 unless last
      missing.push({
        charge_id: chargeId,
        stripe_invoice_id: inv.id,
        amount: inv.amount_paid ?? 0,
        created: inv.created,
        period_end: line?.end ? iso(line.end) : null,
      });
    }

    const latest = paid[0]; // newest first
    const lineEnd = latest?.lines?.data?.[0]?.period?.end ? iso(latest.lines.data[0].period.end) : null;
    const lineStart = latest?.lines?.data?.[0]?.period?.start ? iso(latest.lines.data[0].period.start) : null;
    const dbEndMs = db.current_period_end ? Date.parse(db.current_period_end) : NaN;
    const needsAdvance = lineEnd && (!Number.isFinite(dbEndMs) || Date.parse(lineEnd) > dbEndMs);

    plans.push({
      dbRowId: db.id,
      user_id: db.user_id,
      sub: s.id,
      needsAdvance: !!needsAdvance,
      propose_start: lineStart,
      propose_end: lineEnd,
      latest_invoice: latest?.id ?? null,
      missing_billing: missing,
    });
  }

  // Group by db row (dedupe subs sharing one row) and dedupe billing by charge_id
  const byRow = new Map();
  for (const p of plans) {
    const k = p.dbRowId;
    const cur = byRow.get(k) || { ...p, subs: [], missing_billing: [], seen: new Set() };
    cur.subs.push(p.sub);
    for (const m of p.missing_billing || []) {
      if (cur.seen.has(m.charge_id)) continue;
      cur.seen.add(m.charge_id);
      cur.missing_billing.push(m);
    }
    // take the latest proposal end (max line_period_end across the grouped subs)
    if (!cur.propose_end || (p.propose_end && Date.parse(p.propose_end) > Date.parse(cur.propose_end))) {
      cur.propose_end = p.propose_end;
      cur.propose_start = p.propose_start;
      cur.latest_invoice = p.latest_invoice;
      cur.needsAdvance = p.needsAdvance;
    }
    byRow.set(k, cur);
  }

  let advanceCount = 0, billingCount = 0;
  for (const p of byRow.values()) {
    console.log('──────────────────────────────────────────────');
    console.log(`DB row ${p.dbRowId} | user ${p.user_id} | subs: ${p.subs.join(', ')}`);
    if (p.needsAdvance) {
      advanceCount++;
      console.log(`  PROPOSED period advance: current_period_start=${p.propose_start} current_period_end=${p.propose_end} next_billing_date=${p.propose_end}`);
    } else {
      console.log('  period already current (no advance needed)');
    }
    if (p.missing_billing?.length) {
      console.log(`  PROPOSED billing_history inserts (${p.missing_billing.length}):`);
      for (const m of p.missing_billing) {
        billingCount++;
        console.log(`    - charge_id=${m.charge_id} | invoice=${m.stripe_invoice_id} | amount=${(m.amount / 100).toFixed(2)} | line_period_end=${m.period_end}`);
      }
    } else {
      console.log('  billing_history: no missing rows (already recorded)');
    }
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`SUMMARY: ${byRow.size} app rows | ${advanceCount} need period advance | ${billingCount} missing billing rows to insert`);
  console.log('\nThis was a DRY-RUN — no DB writes. Present this plan for owner approval before applying (Phase 2).');
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
