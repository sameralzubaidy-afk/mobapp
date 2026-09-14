/**
 * FIX-Task-33 (2026-09-14) — READ-ONLY Stripe access for the QA seat.
 *
 * WHY THIS EXISTS
 * The playbook rule R100 (§5.79) says a case assertion that NAMES an external
 * system's state is NOT satisfied by a DB column that merely reuses that
 * vocabulary (`payments.derived_state = 'captured'` is a trigger-written MIRROR,
 * not Stripe's state). §5.37 says side-effect verification must read the actual
 * Stripe object. Until now the QA seat could only *name* that missing leg, not
 * read it. This module is the sanctioned read path that closes the gap.
 *
 * KEY CONTRACT (deliberate, do not weaken)
 *   - The ONLY accepted key is `STRIPE_QA_READONLY_KEY` — a Stripe RESTRICTED
 *     test-mode key (`rk_test_...`) with read-only permissions. It is read from
 *     the gitignored `p2p-kids-marketplace/.env` (or the shell env).
 *   - There is NO implicit fallback to `~/.dt11-stripe-key` (the full test-mode
 *     SECRET key the fixture scripts use for writes). A silent fallback would
 *     make every "verified read-only" claim false.
 *   - `sk_*` (full secret) is REJECTED unless the caller explicitly opts in via
 *     `--break-glass-secret-key` / `STRIPE_QA_BREAK_GLASS=1`. That path works
 *     but SELF-LABELS every result `SECRET_KEY_BREAK_GLASS` so no evidence ever
 *     gets passed off as restricted-key evidence. See BREAK_GLASS below.
 *   - Any `*_live_*` key is refused outright — this tool must never touch live.
 *
 * GET-ONLY BY CONSTRUCTION
 * This module exposes `stripeGet` / `stripeList` and nothing else. There is no
 * code path that can POST/PUT/DELETE, so a read-only guarantee holds even if the
 * key is over-scoped. `assertReadOnly()` is the belt-and-braces guard.
 *
 * API VERSION
 * Pinned to `2023-10-16` — the exact `apiVersion` all 41 Stripe-calling Edge
 * Functions declare (verified 2026-09-14), so what this tool reads is shaped
 * the same way as what the app saw. In this version `payment_intent.latest_charge`
 * is the charge pointer (`charges` was removed), and `amount_capturable` is the
 * uncaptured-authorization figure. Do NOT let the header float — a newer default
 * version changes field shapes and would silently make an audit meaningless.
 *
 * Connect / connected accounts (SUB Groups F/G/H)
 * Seller payouts + transfers live on connected accounts, so reading them needs
 * BOTH connected-account read scope on the platform key AND the `Stripe-Account`
 * header. Pass `{ account: 'acct_...' }` — `explainStripeError()` turns the
 * common 403 shapes into an actionable "grant connected-account read scope"
 * message instead of a raw error blob.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..', '..', '..');

// dotenv v17 prints an "injecting env (...) -- tip: ..." banner on EVERY
// config() call — including ones made by shared helpers we deliberately do not
// modify (r41-common.loadEnv). That banner lands on stdout and would corrupt a
// piped evidence file, so suppress it process-wide before any config() runs.
// (Imports are evaluated before main(), and no shared helper calls config() at
// import time, so setting this here is early enough.)
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';

/** The exact apiVersion every Stripe-calling Edge Function declares. */
export const STRIPE_VERSION = '2023-10-16';

/** Where the fixture scripts' full secret key lives (break-glass only). */
export const SECRET_KEY_PATH = resolve(homedir(), '.dt11-stripe-key');

export const SCOPE_RESTRICTED = 'RESTRICTED_READ_ONLY';
export const SCOPE_BREAK_GLASS = 'SECRET_KEY_BREAK_GLASS';

/** Load the app env the other qa:* scripts use. dotenv does not override, so
 *  a shell-exported STRIPE_QA_READONLY_KEY always wins. */
export function loadEnvFiles() {
  for (const f of ['.env', '.env.staging', '.env.local']) {
    dotenv.config({ path: resolve(APP_ROOT, f), quiet: true });
  }
}

/** Classify a key by prefix WITHOUT ever echoing the key material. */
export function classifyKey(key) {
  const k = (key || '').trim();
  if (!k) return 'ABSENT';
  if (/^sk_live_|^rk_live_/.test(k)) return 'LIVE';
  if (/^rk_test_/.test(k)) return 'RESTRICTED_TEST';
  if (/^sk_test_/.test(k)) return 'SECRET_TEST';
  return 'UNKNOWN';
}

/**
 * Resolve the read key + its evidence scope.
 * @returns {{ key: string, scope: string, source: string, keyType: string }}
 * Exits(2) with an actionable message when nothing usable is configured.
 */
export function getReadKey({ breakGlass = process.env.STRIPE_QA_BREAK_GLASS === '1' } = {}) {
  loadEnvFiles();

  const restricted = (process.env.STRIPE_QA_READONLY_KEY || '').trim();
  const restrictedType = classifyKey(restricted);

  if (restricted && restrictedType === 'LIVE') {
    console.error('REFUSED: STRIPE_QA_READONLY_KEY is a LIVE-mode key. This tool must never touch live mode.');
    process.exit(2);
  }
  if (restricted && restrictedType === 'RESTRICTED_TEST') {
    return { key: restricted, scope: SCOPE_RESTRICTED, source: 'STRIPE_QA_READONLY_KEY', keyType: restrictedType };
  }
  if (restricted && restrictedType === 'SECRET_TEST') {
    if (!breakGlass) {
      console.error(
        [
          'REFUSED: STRIPE_QA_READONLY_KEY holds a full SECRET key (sk_test_...), not a restricted read-only key.',
          '',
          '  Create a Stripe RESTRICTED, read-only, test-mode key (rk_test_...) and set:',
          '    STRIPE_QA_READONLY_KEY=rk_test_...        # in p2p-kids-marketplace/.env (gitignored)',
          '',
          '  Read-only permissions required (all READ — no write scopes, test mode only):',
          '    PaymentIntents, Charges, Refunds, SetupIntents, PaymentMethods, Customers,',
          '    Subscriptions, Invoices, Payouts, Transfers, Events, Disputes',
          '  Plus: connected-account read scope on the platform account (needed for seller',
          '        payouts/transfers on Connect accounts — SUB Groups F/G/H).',
          '',
          '  Break-glass (labelled, never treated as restricted evidence):',
          '    --break-glass-secret-key   (or STRIPE_QA_BREAK_GLASS=1)',
        ].join('\n'),
      );
      process.exit(2);
    }
    console.error(
      '\n!! BREAK-GLASS: using the full test-mode SECRET key (sk_test_...).\n' +
        '!! Results are labelled key_scope=SECRET_KEY_BREAK_GLASS and must NOT be\n' +
        '!! reported as restricted-key / read-only verification evidence.\n',
    );
    return { key: restricted, scope: SCOPE_BREAK_GLASS, source: 'STRIPE_QA_READONLY_KEY(secret)', keyType: restrictedType };
  }

  // Nothing usable in the env — break-glass may fall back to the fixture key.
  if (breakGlass) {
    let fallback = '';
    try {
      fallback = readFileSync(SECRET_KEY_PATH, 'utf8').trim();
    } catch {
      /* handled below */
    }
    const fallbackType = classifyKey(fallback);
    if (fallbackType === 'LIVE') {
      console.error('REFUSED: the fallback key is a LIVE-mode key.');
      process.exit(2);
    }
    if (fallbackType === 'RESTRICTED_TEST' || fallbackType === 'SECRET_TEST') {
      console.error(
        `\n!! BREAK-GLASS: STRIPE_QA_READONLY_KEY is not set; falling back to ${SECRET_KEY_PATH}.\n` +
          '!! Results are labelled key_scope=SECRET_KEY_BREAK_GLASS and must NOT be\n' +
          '!! reported as restricted-key / read-only verification evidence.\n',
      );
      return { key: fallback, scope: SCOPE_BREAK_GLASS, source: SECRET_KEY_PATH, keyType: fallbackType };
    }
  }

  console.error(
    [
      'Missing STRIPE_QA_READONLY_KEY — the QA read-only Stripe key is not configured.',
      '',
      '  Fix (owner action — an agent cannot mint a Stripe key):',
      '    1. Stripe Dashboard -> Developers -> API keys -> Create restricted key',
      '    2. Mode: TEST.  Permissions: READ-ONLY on',
      '         PaymentIntents, Charges, Refunds, SetupIntents, PaymentMethods, Customers,',
      '         Subscriptions, Invoices, Payouts, Transfers, Events, Disputes',
      '       Plus connected-account read scope on the platform account.',
      '    3. Add to the gitignored p2p-kids-marketplace/.env :',
      '         STRIPE_QA_READONLY_KEY=rk_test_...',
      '',
      '  Until then this tool cannot read Stripe state, and any case assertion that',
      '  names a Stripe state must be recorded "not DB-checkable - needs the provider".',
    ].join('\n'),
  );
  process.exit(2);
}

/** Belt-and-braces: nothing but GET may reach the wire. */
export function assertReadOnly(method) {
  const m = String(method || '').toUpperCase();
  if (m !== 'GET') {
    throw new Error(`stripe-read is GET-only; refused ${m}. A read-only verification tool must never mutate.`);
  }
  return m;
}

/**
 * GET https://api.stripe.com/v1<path> using the read key.
 * @param {object} ctx   result of getReadKey()
 * @param {string} path  e.g. '/payment_intents/pi_123'
 * @param {{ params?: object, account?: string }} [opts]
 */
export async function stripeGet(ctx, path, { params, account } = {}) {
  assertReadOnly('GET');
  let url = `https://api.stripe.com/v1${path}`;
  if (params && Object.keys(params).length) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    if (Object.keys(clean).length) url += '?' + new URLSearchParams(clean).toString();
  }
  const headers = { Authorization: `Bearer ${ctx.key}`, 'Stripe-Version': STRIPE_VERSION };
  if (account) headers['Stripe-Account'] = account;

  const res = await fetch(url, { method: 'GET', headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(explainStripeError('GET', path, res.status, json, account));
  return json;
}

/** Follow `has_more` up to `limit` records (default 100, hard cap 100 per page). */
export async function stripeList(ctx, path, { params, account, limit = 100 } = {}) {
  const out = [];
  let startingAfter;
  for (;;) {
    const page = await stripeGet(ctx, path, {
      params: { ...params, limit: String(Math.min(100, limit - out.length)), starting_after: startingAfter },
      account,
    });
    out.push(...(page.data || []));
    if (!page.has_more || out.length >= limit) break;
    startingAfter = page.data?.[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return out.slice(0, limit);
}

/** Turn Stripe's terse errors into an actionable QA message. */
export function explainStripeError(method, path, status, body, account) {
  const err = body?.error || {};
  const code = err.code || '';
  const msg = err.message || JSON.stringify(body).slice(0, 300);

  if (account && (status === 403 || code === 'platform_account_required')) {
    return (
      `Stripe ${method} ${path} [account=${account}] -> ${status} ${code || 'FORBIDDEN'}\n` +
      `  ${msg}\n` +
      '  LIKELY CAUSE: the restricted key lacks CONNECTED-ACCOUNT read scope.\n' +
      '  FIX: grant connected-account read on the platform restricted key (owner action),\n' +
      '       or mint a per-Connect-account restricted read-only key.\n' +
      '  RECORD AS: "Payout layer N/A - connected account not readable with current key".'
    );
  }
  if (status === 403 || code === 'restricted_api_key') {
    return (
      `Stripe ${method} ${path} -> ${status} ${code || 'FORBIDDEN'}\n` +
      `  ${msg}\n` +
      `  NOTE: 403 on a restricted key = read scope NOT granted for this resource.\n` +
      '        Add the resource to the key\'s read permissions (owner action).'
    );
  }
  if (status === 401) {
    return `Stripe ${method} ${path} -> 401 ${code}\n  ${msg}\n  NOTE: key missing/invalid/revoked.`;
  }
  if (status === 404) {
    return `Stripe ${method} ${path} -> 404 ${code || 'resource_missing'}\n  ${msg}\n  NOTE: the stored id does not exist in THIS Stripe account (test vs live, or deleted).`;
  }
  return `Stripe ${method} ${path} -> ${status} ${JSON.stringify(body).slice(0, 400)}`;
}

/* ---------------- small formatters (QA evidence readability) ---------------- */

export function usd(cents) {
  if (cents === null || cents === undefined || cents === '') return '(null)';
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

export function iso(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '(null)';
  return new Date(n * 1000).toISOString();
}

export function isoOrNull(ts) {
  return ts || '(null)';
}

/**
 * A compact, stable projection of a PaymentIntent — the object most of the TRD
 * money assertions name. `amount_capturable` is the live "uncaptured hold"
 * figure; `amount_received` is the real captured money. Both are Stripe's, not a
 * mirror column's.
 */
export function piFacts(pi) {
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    amount_capturable: pi.amount_capturable,
    amount_received: pi.amount_received,
    captured: pi.captured,
    latest_charge: pi.latest_charge ?? null,
    customer: pi.customer ?? null,
    currency: pi.currency,
    created: iso(pi.created),
    canceled_at: pi.canceled_at ? iso(pi.canceled_at) : null,
    livemode: pi.livemode,
    metadata: pi.metadata || {},
  };
}

/** Defensive field picker: never throw on a schema-surprise column. */
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && k in obj) out[k] = obj[k];
  return out;
}
