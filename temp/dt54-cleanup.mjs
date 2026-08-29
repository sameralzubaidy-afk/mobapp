/**
 * DT-54 cleanup — removes ALL disposable fixture state from a verification run:
 *   - cancels Stripe PaymentIntents (test key)
 *   - deletes trade-scoped rows: tax_records / trade_events / payments / trade_refunds
 *     (by trade_id), financial_audit_log (entity_id + type='trade'), user_notifications
 *     (data->>trade_id), sp_ledger (related_transaction_id = trade id)
 *   - deletes the trades, then the fixture items (hard delete)
 *   - restores test-buyer's SP wallet to the pre-run snapshot (available/reserved/pending)
 * Reads temp/dt54-fixtures.json. Idempotent (missing rows are skipped).
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
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Missing env'); process.exit(2); }

const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;
const fixturesPath = join(__dirname, 'dt54-fixtures.json');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const log = (...a) => console.log('[dt54-cleanup]', ...a);
const DRY = process.argv.includes('--dry-run');

async function cancelPi(piId) {
  if (!STRIPE_KEY || !piId) return;
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) log(`  ✅ canceled PI ${piId} (status=${j.status})`);
  else log(`  ⚠️ PI ${piId} cancel: ${res.status} ${j.error?.message ?? ''}`);
}

async function deleteWhere(table, col, value) {
  const { error } = await admin.from(table).delete().eq(col, value);
  if (error) log(`  ⚠️ ${table} by ${col} delete: ${error.message}`);
}

async function main() {
  if (!existsSync(fixturesPath)) { console.error('No dt54-fixtures.json — nothing to clean.'); process.exit(2); }
  const fx = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  log(`fixtures: ${fx.trade_ids?.length ?? 0} trades, ${fx.item_ids?.length ?? 0} items`);
  if (DRY) { log('DRY-RUN — no mutations.'); return; }

  // 1. Cancel PIs + delete trade-scoped rows + trades
  for (const t of fx.trade_ids ?? []) {
    log(`cleaning trade ${t.id}`);
    await cancelPi(t.pi);
    await deleteWhere('tax_records', 'trade_id', t.id);
    await deleteWhere('trade_events', 'trade_id', t.id);
    await deleteWhere('payments', 'trade_id', t.id);
    await deleteWhere('trade_refunds', 'trade_id', t.id);
    await admin.from('financial_audit_log').delete().eq('entity_type', 'trade').eq('entity_id', t.id);
    await admin.from('user_notifications').delete().filter('data->>trade_id', 'eq', t.id);
    await deleteWhere('sp_ledger', 'related_transaction_id', t.id);
    await deleteWhere('sp_ledger', 'related_listing_id', t.listing_id);
    await deleteWhere('trades', 'id', t.id);
  }

  // 2. Delete fixture items (hard delete)
  for (const id of fx.item_ids ?? []) {
    // clear any cart_items first (fixture script didn't add any, but be safe)
    await deleteWhere('cart_items', 'listing_id', id);
    await deleteWhere('items', 'id', id);
  }

  // 3. Restore test-buyer SP wallet
  if (fx.wallet_before && fx.buyer_id) {
    const { data: cur } = await admin.from('sp_wallets').select('available_balance, reserved_sp, pending_balance').eq('user_id', fx.buyer_id).maybeSingle();
    log(`wallet before: ${JSON.stringify(fx.wallet_before)}  now: ${cur ? JSON.stringify(cur) : '(missing)'}`);
    const { error } = await admin.from('sp_wallets')
      .update({
        available_balance: fx.wallet_before.available_balance ?? 0,
        reserved_sp: fx.wallet_before.reserved_sp ?? 0,
        pending_balance: fx.wallet_before.pending_balance ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', fx.buyer_id);
    if (error) log(`⚠️ wallet restore: ${error.message}`);
    else log('✅ wallet restored to pre-run snapshot');
  }

  // 4. Verify
  const { data: remaining } = await admin.from('trades').select('id').in('listing_id', fx.item_ids ?? []);
  const { data: itemsLeft } = await admin.from('items').select('id').in('id', fx.item_ids ?? []);
  log(`remaining trades: ${remaining?.length ?? 0}, remaining items: ${itemsLeft?.length ?? 0}`);
  log('✅ DT-54 cleanup complete.');
}

main().catch((e) => { console.error('[dt54-cleanup] FATAL', e); process.exit(1); });
