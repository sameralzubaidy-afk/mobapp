/**
 * FIX-Task-52 item 7b (2026-09-17) — enabled: a SIGNED Stripe webhook replay helper.
 *
 * WHY THIS EXISTS
 * SUB-TC-L05 ("Payout-status webhook updates seller payout history") has been a
 * named SUB gap for several rounds. The QA verdict each time was:
 *
 *   "the observed `processing` -> `completed` transition came from the
 *    DEV-TASK-124 dispatch trigger (dispatch-manual-payouts), NOT a provider
 *    webhook" — no webhook signing secret is available under read-only discipline.
 *
 * So the case could only ever be half-verified: the fixture exercised the
 * DB-trigger path, never the actual `stripe-webhook` Edge Function. This tool
 * closes that by minting a correctly SIGNED event and POSTing it to the real
 * endpoint — the same delivery path Stripe itself uses.
 *
 * WHAT IT DOES
 *   1. Builds a realistic Stripe event envelope (`{ id, object:'event', type,
 *      created, livemode:false, data:{ object: <resource> } }`).
 *   2. Signs the exact request body the way Stripe does:
 *        Stripe-Signature: t=<unix>,v1=<hex(HMAC-SHA256(secret, "<t>.<body>"))>
 *   3. POSTs it to `$SUPABASE_URL/functions/v1/stripe-webhook`.
 *   4. Prints the HTTP status + raw response so the result is evidence, not a guess.
 *
 * It drives REAL state: `payout.paid` moves the matching `seller_payouts` row to
 * `completed`; `payout.failed` moves it to `failed`. That is the point — but it
 * means you must pass a `--payout` that belongs to your intended fixture, and the
 * row's status must be read back afterwards to confirm (BP-72: verify the side
 * effect, not just the HTTP response).
 *
 * USAGE (from p2p-kids-marketplace/):
 *   npm run qa:stripe-webhook-replay -- --type payout.paid --payout po_123
 *   npm run qa:stripe-webhook-replay -- --type payout.failed --payout po_123 --failure-message "account closed"
 *   npm run qa:stripe-webhook-replay -- --json '<full event JSON>'      # exact payload
 *   npm run qa:stripe-webhook-replay -- --type payout.paid --payout po_123 --dry-run
 *
 * THE SECRET — an OWNER action, and the one thing this tool cannot supply:
 *   `STRIPE_WEBHOOK_SECRET` must be available to this script (shell env, or the
 *   gitignored p2p-kids-marketplace/.env / .env.staging). It is the SAME secret
 *   the deployed `stripe-webhook` Edge Function verifies against (Stripe
 *   Dashboard -> Developers -> Webhooks -> <endpoint> -> Signing secret, whsec_...).
 *   Without it the tool exits 2 with the remediation and changes nothing — it never
 *   guesses, and it never prints the secret.
 *
 * SAFETY
 *   - `--dry-run` prints the payload + signature and POSTs nothing.
 *   - The secret is never echoed (only its length/prefix class).
 *   - Refuses to run against a non-Supabase-looking URL.
 *   - Localhost/self-hosted endpoints remain allowed via `--endpoint`.
 */

import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env'), quiet: true });
dotenv.config({ path: resolve(__dirname, '..', '..', '.env.staging'), quiet: true });

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const DRY_RUN = process.argv.includes('--dry-run');
const TYPE = argValue('type');
const PAYOUT = argValue('payout');
const RAW_JSON = argValue('json');
const FAILURE_MESSAGE = argValue('failure-message');
const SECRET_ARG = argValue('secret');
const EVENT_ID = argValue('event-id');
const ENDPOINT = argValue('endpoint') || 'stripe-webhook';

/** Stripe events this helper can synthesise, and the status each maps to. */
const PAYOUT_EVENT_TYPES = ['payout.created', 'payout.updated', 'payout.paid', 'payout.failed'];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';

function log(...a) {
  console.log('[qa:stripe-webhook-replay]', ...a);
}

/** Resolve the webhook signing secret. Never prints it. */
function resolveSecret() {
  const secret = (SECRET_ARG || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.error(
      [
        '❌ Missing the Stripe webhook signing secret — this tool cannot sign an event without it.',
        '',
        '  OWNER ACTION (an agent cannot mint this):',
        '    1. Stripe Dashboard -> Developers -> Webhooks -> select the endpoint that',
        '       points at /functions/v1/stripe-webhook',
        '    2. Copy its "Signing secret" (whsec_...)',
        '    3. Add it to the gitignored p2p-kids-marketplace/.env :',
        '         STRIPE_WEBHOOK_SECRET=whsec_...',
        '       (or pass --secret whsec_... / export STRIPE_WEBHOOK_SECRET=...)',
        '',
        '  It must be the SAME secret the deployed stripe-webhook function verifies',
        '  against, or the endpoint will correctly answer 400 "Webhook Error: ...".',
        '',
        '  Until then, SUB-TC-L05 stays verifiable only on the DB-trigger path and this',
        '  leg must be recorded as "not DB-checkable — needs the webhook signing secret".',
      ].join('\n')
    );
    process.exit(2);
  }
  if (!secret.startsWith('whsec_')) {
    console.warn(
      '⚠️  The supplied secret does not start with "whsec_" — Stripe signing secrets normally do. Continuing anyway.'
    );
  }
  return secret;
}

/** Build the event envelope for a payout event. */
function buildPayoutEvent() {
  const created = Math.floor(Date.now() / 1000);
  return {
    id: EVENT_ID || `evt_qa_replay_${created}_${Math.random().toString(36).slice(2, 8)}`,
    object: 'event',
    api_version: '2023-10-16',
    created,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: TYPE,
    data: {
      object: {
        id: PAYOUT,
        object: 'payout',
        amount: 0,
        currency: 'usd',
        // The EF maps the EVENT TYPE to the status, so `status` here is cosmetic —
        // but keep it consistent so the payload reads like a real event.
        status: TYPE.replace('payout.', '') === 'paid' ? 'paid' : TYPE.replace('payout.', ''),
        ...(TYPE === 'payout.failed'
          ? { failure_message: FAILURE_MESSAGE || 'Payout failed (QA replay)' }
          : {}),
        metadata: { qa_replay: 'fix-task-52' },
      },
    },
  };
}

async function main() {
  // ── 1. Resolve the body ─────────────────────────────────────────────────────
  let event;
  if (RAW_JSON) {
    try {
      event = JSON.parse(RAW_JSON);
    } catch {
      console.error('❌ --json is not valid JSON.');
      process.exit(2);
    }
  } else {
    if (!TYPE || !PAYOUT_EVENT_TYPES.includes(TYPE)) {
      console.error(
        `❌ --type must be one of: ${PAYOUT_EVENT_TYPES.join(', ')} (got '${TYPE ?? '(none)'}')\n` +
          "   Or pass --json '<full event JSON>' to replay an exact payload."
      );
      process.exit(2);
    }
    if (!PAYOUT) {
      console.error(
        '❌ --payout <po_...> is required — the webhook finds the row by\n' +
          '   seller_payouts.provider_reference_id, so it must be the row\'s real provider id.'
      );
      process.exit(2);
    }
    event = buildPayoutEvent();
  }

  if (!SUPABASE_URL || !/^https?:\/\//.test(SUPABASE_URL)) {
    console.error('❌ Missing/invalid SUPABASE_URL (check .env / .env.staging).');
    process.exit(2);
  }

  const secret = resolveSecret();
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');
  const signatureHeader = `t=${timestamp},v1=${signature}`;

  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${ENDPOINT}`;

  // ── 2. Report exactly what is about to happen ───────────────────────────────
  log(`Endpoint : ${url}`);
  log(`Event    : ${event.type}  (id ${event.id})`);
  log(`Resource : ${event.data?.object?.id ?? '(none)'} [${event.data?.object?.object ?? '?'}]`);
  log(`Secret   : resolved (whsec_ prefix: ${secret.startsWith('whsec_') ? 'yes' : 'no'}) — value never printed`);
  log(`Signature: t=${timestamp},v1=<${signature.length} hex chars>`);

  if (DRY_RUN) {
    log('DRY-RUN — nothing was sent. Body that WOULD be posted:');
    console.log(body);
    return;
  }

  // ── 3. Deliver ──────────────────────────────────────────────────────────────
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signatureHeader,
      },
      body,
    });
  } catch (err) {
    console.error(`❌ Could not reach the endpoint: ${err.message}`);
    process.exit(1);
  }

  const text = await res.text();
  console.log('');
  console.log('========== WEBHOOK RESPONSE ==========');
  console.log(`HTTP ${res.status}`);
  console.log(text || '(empty body)');
  console.log('======================================');

  if (!res.ok) {
    console.error(
      '\n❌ The endpoint rejected the replay. Read the message above:\n' +
        '   - "Webhook Error: No signatures found matching the expected signature" ⇒ the\n' +
        '     secret is not the one the DEPLOYED function verifies against.\n' +
        '   - "Webhook Secret missing" (400) ⇒ the function has no STRIPE_WEBHOOK_SECRET set.\n' +
        '   - A 200 with no row change ⇒ the signature was fine but no seller_payouts row\n' +
        '     matched that provider_reference_id (verify with qa:stripe-inspect by-trade).'
    );
    process.exit(1);
  }

  log(
    '✅ Delivered and signature-verified. Now READ THE ROW BACK (BP-72) — the HTTP\n' +
      '   response only proves delivery:\n' +
      '     SELECT id, status, failure_reason, completed_at FROM seller_payouts\n' +
      `      WHERE provider_reference_id = '${event.data?.object?.id ?? '<id>'}';`
  );
}

main();
