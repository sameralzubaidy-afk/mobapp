/**
 * DT-58 cleanup — removes ALL disposable create-checkout-session fixtures.
 * Reads temp/dt58-checkout-fixtures.json (ledger) PLUS the hardcoded ORPHANED
 * before-run artifacts (two runs predated the ledger format). Idempotent.
 * Stripe: deactivate rogue prices (prices can't be deleted — only archived).
 * Supabase: delete child rows + profiles by user_id, then admin.deleteUser (BP-70).
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env') });
dotenv.config({ path: resolve(__dirname, '..', 'p2p-kids-marketplace', '.env.staging') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Missing env'); process.exit(2); }
const keyPath = join(homedir(), '.dt11-stripe-key');
const STRIPE_KEY = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null;
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' }) : null;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const fixturesPath = resolve(__dirname, 'dt58-checkout-fixtures.json');
let f = {};
if (existsSync(fixturesPath)) { try { f = JSON.parse(readFileSync(fixturesPath, 'utf8')); } catch { /* ignore */ } }

// Orphaned BEFORE-run artifacts (created before the ledger format existed):
const ORPHAN_USERS = ['1cf418c3-3f3f-46df-a880-21f08f625458', '34b5808a-fa62-49c6-85c1-17ad960673d3'];
const ORPHAN_PRICES = ['price_1UA7tu4I6kCJlvXo9szg9wQr', 'price_1UA8214I6kCJlvXovLRiouJK'];

const users = [...new Set([...(Array.isArray(f.users) ? f.users : [f.userId].filter(Boolean)), ...ORPHAN_USERS].filter(Boolean))];
const roguePrices = [...new Set([...(Array.isArray(f.roguePrices) ? f.roguePrices : [f.roguePriceId].filter(Boolean)), ...ORPHAN_PRICES].filter(Boolean))];
const sessions = Array.isArray(f.sessionIds) ? f.sessionIds : (f.sessionIds ?? []);
const log = (...a) => console.log('[dt58-checkout-cleanup]', ...a);
let removed = 0;

for (const priceId of roguePrices) {
  if (!priceId) continue;
  try { await stripe.prices.update(priceId, { active: false }); removed += 1; log('deactivated rogue price', priceId); }
  catch (e) { log('⚠️ deactivate rogue price:', e?.message ?? e); }
}
for (const uid of users) {
  if (!uid) continue;
  for (const t of ['subscriptions', 'sp_wallets', 'notification_preferences', 'profiles']) {
    const { error } = await admin.from(t).delete().eq('user_id', uid);
    if (error) log(`⚠️ delete ${t}:`, error.message); else removed += 1;
  }
  try { await admin.auth.admin.deleteUser(uid); removed += 1; }
  catch (e) { log('⚠️ deleteUser:', e?.message ?? e); }
}

log(`cleanup complete — ${removed} artifacts removed (users=${users.length}, roguePrices=${roguePrices.length}, ${sessions.length} ephemeral test sessions left to expire)`);
