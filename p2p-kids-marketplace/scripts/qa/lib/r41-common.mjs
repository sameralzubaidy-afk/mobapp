/**
 * DEV-TASK-R41 (2026-09-03) — shared helpers for the combined fixture-build
 * session (SUB + MSG remaining fixture-gated cases).
 *
 * Centralizes the conventions the standalone QA scripts repeat so the R41
 * fixture scripts stay small:
 *   - .env / .env.staging loading
 *   - service-role Supabase client + Stripe test key read (~/.dt11-stripe-key)
 *   - the canonical standing-persona registry (id/email/password — mirrors
 *     scripts/qa/ef-repro.mjs PERSONAS + scripts/seed-staging-data.ts TEST_USERS)
 *   - persona → real user id resolution (fixed-UUID first, email fallback)
 *   - small helpers: GoTrue JWT exchange, Edge Function POST, arg parsing
 *
 * Read-only by design — none of these helpers mutate anything by themselves.
 * Env convention is identical to reset-offer-fixtures.mjs / admin-config-set.mjs:
 *   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from
 *   p2p-kids-marketplace/.env (or .env.staging), Stripe key from ~/.dt11-stripe-key.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env.staging') });
}

/** Standing personas (ids mirror ef-repro.mjs + seed TEST_USERS). */
export const PERSONAS = {
  'test-buyer': { id: '49243010-f458-4744-add1-a6c84ab95f1f', email: 'test-buyer@kidsmarketplace.test', password: 'TestBuyer123!' },
  'test-free': { id: 'a1234567-0000-0000-0000-000000000001', email: 'test-free@kidsmarketplace.test', password: 'TestFree123!' },
  'test-buyer-2': { id: 'a1234567-0000-0000-0000-000000000003', email: 'test-buyer-2@kidsmarketplace.test', password: 'TestBuyer2123!' },
  'test-buyer-3': { id: 'a1234567-0000-0000-0000-000000000004', email: 'test-buyer-3@kidsmarketplace.test', password: 'TestBuyer3123!' },
  'test-seller': { id: '14be337c-aad6-403f-bab2-ba1a7d80b666', email: 'test-seller@kidsmarketplace.test', password: 'TestSeller123!' },
  'test-seller-2': { id: 'a1234567-0000-0000-0000-000000000002', email: 'test-seller-2@kidsmarketplace.test', password: 'TestSeller2123!' },
  'test-seller-3': { id: 'a1234567-0000-0000-0000-000000000012', email: 'test-seller-3@kidsmarketplace.test', password: 'TestSeller3123!' },
  'test-grace': { id: 'a1234567-0000-0000-0000-000000000011', email: 'test-grace@kidsmarketplace.test', password: 'TestGrace123!' },
  'test-expired': { id: 'a1234567-0000-0000-0000-000000000013', email: 'test-expired@kidsmarketplace.test', password: 'TestExpired123!' },
  // DEV-TASK-120 (item 1): standing trial persona — qa:r41-trial ensure/reset.
  'test-trial': { id: 'a1234567-0000-0000-0000-000000000015', email: 'test-trial@kidsmarketplace.test', password: 'TestTrial123!' },
  'test-suspended': { id: 'a1234567-0000-0000-0000-00000000000f', email: 'test-suspended@kidsmarketplace.test', password: 'TestSuspended123!' },
  'qa-first-trade': { id: 'a1234567-0000-0000-0000-000000000014', email: 'qa-first-trade@kidsmarketplace.test', password: 'TestFirstTrade123!' },
  'test-admin': { id: 'e861a7a0-9764-4e2a-9f5e-2b5e1b9b6e6f', email: 'test-admin@kidsmarketplace.test', password: 'TestAdmin123!' },
};

/** The admin id used to record fixture config edits (BP-48): samer@samer.com. */
export const ADMIN_ID = '1a546991-5361-4b4e-b44b-eee9bf730757';

/** The canonical Kids Club+ monthly Stripe price (DT-90/QA Task 21). */
export const KIDS_CLUB_PRICE_ID = 'price_1UBLkH4I6kCJlvXoq9xsDhuG';

export function getClients() {
  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) {
    console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (check .env / .env.staging)');
    process.exit(2);
  }
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { url, anon, serviceRole, admin };
}

export function getStripeKey() {
  try {
    const key = readFileSync(resolve(homedir(), '.dt11-stripe-key'), 'utf8').trim();
    if (!key) throw new Error('empty');
    return key;
  } catch {
    console.error('❌ Stripe test key not found at ~/.dt11-stripe-key (needed for Stripe fixture legs)');
    process.exit(2);
  }
}

export function log(tag, ...a) {
  console.log(`[${tag}]`, ...a);
}

export function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}
/**
 * True when the CLI contains a flag for `name`. Accepts either the bare name
 * ('dry-run') or the already-dashed form ('--dry-run'): callers historically
 * pass the dashed form, so a naive `--${name}` prefix produced '----dry-run',
 * which never matched — --dry-run/--force/--keep/--remove/--with-auto-complete
 * were silently dead and dry runs actually created rows (DEV-TASK-112 item 3).
 */
export function hasFlag(name) {
  const normalized = name.replace(/^--/, '');
  return process.argv.includes(`--${normalized}`);
}

/**
 * Resolve a persona/user reference to a real auth user id.
 * Accepts: a persona short-name, an email, or a raw uuid (passed through).
 */
export async function resolveUserId(admin, ref) {
  if (!ref) return null;
  if (PERSONAS[ref]) return PERSONAS[ref].id;
  if (ref.includes('@')) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = (data?.users ?? []).find((u) => u.email?.toLowerCase() === ref.toLowerCase());
    if (!hit) throw new Error(`No auth user found for email '${ref}'`);
    return hit.id;
  }
  return ref; // assume raw uuid
}

export function personaOrThrow(ref) {
  const p = PERSONAS[ref];
  if (!p) {
    console.error(`❌ Unknown persona '${ref}'. Known: ${Object.keys(PERSONAS).join(', ')}`);
    process.exit(2);
  }
  return p;
}

/** GoTrue password grant → user access token (for Edge Function calls). */
export async function exchangeJwt(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GoTrue password grant -> ${res.status} ${JSON.stringify(json)}`);
  return json.access_token;
}

/** POST to an Edge Function with the app's exact headers (JWT + anon key). */
export async function postEdgeFunction(url, anonKey, slug, jwt, body) {
  const res = await fetch(`${url}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

export function dayMs(n = 1) {
  return n * 24 * 60 * 60 * 1000;
}
