/**
 * DEV-TASK-89 reconciliation APPLY (owner-approved 2026-09-02: "All 6 rows now").
 *
 * One-time staging reconciliation: the deployed webhook fix handles FUTURE
 * renewals, but 6 existing app-side subscriptions rows are frozen at their
 * original first-period end because their past renewals fired BEFORE
 * `invoice.payment_succeeded` was subscribed (Stripe never replays). This script
 * makes each row match Stripe reality TODAY:
 *   1. Period advance (forward-only): current_period_start/current_period_end +
 *      next_billing_date = the latest REAL paid invoice's line period end.
 *   2. billing_history inserts for genuinely-paid renewal invoices never recorded
 *      (upsert on charge_id, idempotent — matches the webhook's own shape).
 *
 * Only touches the 6 rows mapped from real Stripe subscriptions; skips any with
 * no app row. Safe to re-run (idempotent). No deletes, no status changes.
 * Run: node scripts/qa/dev-task-89-reconcile-apply.mjs [--dry-run]
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
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
function log(...a) { console.log('[dt89-apply]', ...a); }

async function main() {
  const subs = await stripeGet('/subscriptions?limit=100');
  const grouped = new Map(); // dbRowId -> plan

  for (const s of subs.data || []) {
    const custId = typeof s.customer === 'string' ? s.customer : null;
    let db = null;
    const q1 = await admin.from('subscriptions')
      .select('id, user_id, stripe_subscription_id, stripe_customer_id, current_period_end')
      .eq('stripe_subscription_id', s.id).maybeSingle();
    db = q1.data ?? null;
    if (!db && custId) {
      const q2 = await admin.from('subscriptions')
        .select('id, user_id, stripe_subscription_id, stripe_customer_id, current_period_end')
        .eq('stripe_customer_id', custId).maybeSingle();
      db = q2.data ?? null;
    }
    if (!db) continue;

    const invs = await stripeGet(`/invoices?subscription=${s.id}&status=paid&limit=50`).catch(() => ({ data: [] }));
    const paid = invs.data || [];
    const latest = paid[0]; // newest first
    const lineEnd = latest?.lines?.data?.[0]?.period?.end ? iso(latest.lines.data[0].period.end) : null;
    const lineStart = latest?.lines?.data?.[0]?.period?.start ? iso(latest.lines.data[0].period.start) : null;

    const cur = grouped.get(db.id) || { db, subs: [], invoices: [] };
    cur.subs.push(s.id);
    for (const inv of paid) cur.invoices.push(inv);
    grouped.set(db.id, cur);
  }

  if (DRY_RUN) { log(`DRY-RUN: would reconcile ${grouped.size} rows`); return; }

  let advanced = 0, billed = 0;
  for (const { db, subs, invoices } of grouped.values()) {
    // Dedupe invoices by id, newest-first
    const seen = new Set();
    const uniq = invoices.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    uniq.sort((a, b) => b.created - a.created);
    const latest = uniq[0];
    const lineEnd = latest?.lines?.data?.[0]?.period?.end ? iso(latest.lines.data[0].period.end) : null;
    const lineStart = latest?.lines?.data?.[0]?.period?.start ? iso(latest.lines.data[0].period.start) : null;
    const dbEndMs = db.current_period_end ? Date.parse(db.current_period_end) : NaN;

    // Existing billing charge_ids for this user
    const { data: existingBilling } = await admin.from('billing_history').select('charge_id').eq('user_id', db.user_id);
    const have = new Set((existingBilling || []).map((b) => b.charge_id));

    // 1. Period advance (forward-only)
    if (lineEnd && (!Number.isFinite(dbEndMs) || Date.parse(lineEnd) > dbEndMs)) {
      const payload = { current_period_end: lineEnd, next_billing_date: lineEnd, updated_at: new Date().toISOString() };
      if (lineStart) payload.current_period_start = lineStart;
      if (!DRY_RUN) {
        const { error } = await admin.from('subscriptions').update(payload).eq('id', db.id);
        if (error) { console.error(`  ❌ advance failed for ${db.id}: ${error.message}`); continue; }
      }
      log(`✅ row ${db.id} (user ${db.user_id}) period -> ${lineEnd} (subs ${subs.join(',')})`);
      advanced++;
    } else {
      log(`  row ${db.id} already current (${db.current_period_end}) — no advance`);
    }

    // 2. billing_history inserts (idempotent on charge_id)
    for (const inv of uniq) {
      const isZero = (inv.amount_paid ?? 0) === 0;
      // Skip the initial $0 trial invoice if it's not the only one and already handled by webhook
      if (isZero && inv.id !== latest?.id && (uniq.filter((i) => (i.amount_paid ?? 0) > 0).length > 0)) continue;
      const chargeId = (typeof inv.charge === 'string' && inv.charge) || (typeof inv.payment_intent === 'string' && inv.payment_intent) || inv.id;
      if (have.has(chargeId)) continue;
      if (isZero && (inv.amount_paid ?? 0) === 0 && !chargeId.startsWith('in_')) continue;
      const amount = inv.amount_paid ?? 0;
      const row = {
        user_id: db.user_id,
        subscription_id: db.id,
        charge_id: chargeId,
        stripe_invoice_id: inv.id,
        amount,
        currency: 'usd',
        status: 'succeeded',
        charged_at: inv.created ? new Date(inv.created * 1000).toISOString() : new Date().toISOString(),
        description: 'Kids Club+ subscription renewal',
      };
      if (!DRY_RUN) {
        const { error } = await admin.from('billing_history').upsert(row, { onConflict: 'charge_id', ignoreDuplicates: true });
        if (error) { console.error(`  ❌ billing insert failed ${chargeId}: ${error.message}`); continue; }
      }
      log(`  📄 billing +${chargeId} invoice=${inv.id} $${(amount / 100).toFixed(2)}`);
      billed++;
    }
  }
  log(`DONE: ${advanced} rows advanced, ${billed} billing rows upserted`);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
