/**
 * FIX-Task-33 (2026-09-14) — `qa:stripe-inspect`: the QA seat's READ-ONLY Stripe
 * evidence tool. This is the sanctioned read path that closes R100's
 * "not DB-checkable - needs the provider" gap.
 *
 * It exists so a money case can be closed at layer 3 (Provider) instead of
 * stopping at a DB column that merely reuses Stripe's vocabulary
 * (`payments.derived_state` is a trigger-written MIRROR — see R100/§5.79).
 *
 * GET-ONLY. Key contract in ./lib/stripe-read.mjs (restricted `rk_test_` via
 * STRIPE_QA_READONLY_KEY; no implicit secret-key fallback; live mode refused).
 *
 * USAGE (from p2p-kids-marketplace)
 *   npm run qa:stripe-inspect -- account
 *   npm run qa:stripe-inspect -- by-trade <trade-uuid>          <-- the money gate
 *   npm run qa:stripe-inspect -- by-user test-buyer
 *   npm run qa:stripe-inspect -- pi pi_123 | --trade <uuid>
 *   npm run qa:stripe-inspect -- charge ch_123
 *   npm run qa:stripe-inspect -- refund re_123
 *   npm run qa:stripe-inspect -- refunds --charge ch_123 | --pi pi_123 | --trade <uuid>
 *   npm run qa:stripe-inspect -- si seti_123 | --pm pm_123
 *   npm run qa:stripe-inspect -- pm pm_123
 *   npm run qa:stripe-inspect -- pm-list --customer cus_123        <-- FIX-Task-39 item 4
 *   npm run qa:stripe-inspect -- pm-list --user qa-wallet         <-- or a persona
 *   npm run qa:stripe-inspect -- customer cus_123 | --user test-buyer
 *   npm run qa:stripe-inspect -- subscription sub_123 | --user test-buyer
 *   npm run qa:stripe-inspect -- invoice in_123
 *   npm run qa:stripe-inspect -- payout po_123 [--account acct_123]
 *   npm run qa:stripe-inspect -- payouts [--account acct_123] [--status paid]
 *   npm run qa:stripe-inspect -- transfer tr_123 [--as-connected]
 *   npm run qa:stripe-inspect -- events --pi pi_123 [--type a,b] [--limit 50]
 *   npm run qa:stripe-inspect -- disputes [--charge ch_123]
 *
 *   flags: --json   --limit N   --account acct_...   --as-connected   --break-glass-secret-key
 *
 * TRANSFERS vs PAYOUTS (FIX-Task-52 item 2, 2026-09-17 — read this before
 * scoping either one):
 *   - A `payout` / `payouts` read IS connected-account scoped — payouts are
 *     objects ON the seller's Connect account. Pass `--account acct_...`.
 *   - A `transfer` created BY THE PLATFORM with `destination: acct_...` is a
 *     PLATFORM-level object. Sending `Stripe-Account` makes Stripe look for a
 *     transfer OWNED BY that connected account, which 404s for every
 *     platform-initiated transfer — a 404 that reads exactly like a real
 *     DB<->Stripe divergence. So `transfer` deliberately IGNORES `--account`
 *     by default (it says so) and only scopes when `--as-connected` is passed.
 *
 * Every result carries `key_scope` so recorded evidence self-declares whether it
 * came from the restricted read-only key or the labelled break-glass secret key.
 */
import { getClients, resolveUserId } from './lib/r41-common.mjs';
import {
  getReadKey,
  stripeGet,
  stripeList,
  piFacts,
  usd,
  iso,
  pick,
  SCOPE_RESTRICTED,
} from './lib/stripe-read.mjs';

/* ------------------------------- argv parsing ------------------------------- */
const argv = process.argv.slice(2);
const SUB = (argv[0] && !argv[0].startsWith('--') ? argv[0] : '').toLowerCase();
const ID = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined;

const flagValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const AS_JSON = hasFlag('json');
const LIMIT = Number(flagValue('limit') || 100);
const ACCOUNT = flagValue('account');
// FIX-Task-52 item 2: opt-in only, for a transfer the CONNECTED account owns.
const AS_CONNECTED = hasFlag('as-connected');
const TRADE = flagValue('trade');
const CHARGE = flagValue('charge');
const PI = flagValue('pi');
const PM = flagValue('pm');
const CUSTOMER = flagValue('customer');
const USER = flagValue('user') || flagValue('persona');
const STATUS = flagValue('status');
const TYPES = flagValue('types') || flagValue('type');

/** Fake/DB-only fixture account ids that must never be sent to Stripe. */
const FAKE_ACCT_PREFIXES = ['acct_dt118_', 'acct_dt124_', 'acct_fixture_'];
const isRealAcct = (id) => Boolean(id) && id.startsWith('acct_') && !FAKE_ACCT_PREFIXES.some((p) => id.startsWith(p));

/* --------------------------------- helpers --------------------------------- */
function emit(label, data, scope) {
  if (AS_JSON) {
    console.log(JSON.stringify({ key_scope: scope, label, ...data }, null, 2));
    return;
  }
  console.log(`\n=== ${label} ===`);
  const flat = (o, indent = '  ') => {
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      let val;
      // Print small arrays IN FULL — collapsing them to "[1]" hides exactly the
      // evidence a money check needs (e.g. the SetupIntent's status/usage).
      if (Array.isArray(v)) val = v.length <= 3 ? JSON.stringify(v) : `[${v.length} items]`;
      else if (v && typeof v === 'object') val = JSON.stringify(v);
      else val = v;
      console.log(`${indent}${k}: ${val}`);
    }
  };
  flat(data);
}

function agree(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return 'NOT_COMPARABLE';
  return Number(a) === Number(b) ? 'AGREE' : 'DISAGREE';
}

/** Resolve a PaymentIntent id from either an explicit id or a trade row. */
async function resolvePiId(explicit) {
  if (explicit) return explicit;
  if (!TRADE) return undefined;
  const { admin } = getClients();
  const t = (await admin.from('trades').select('id, stripe_payment_intent_id').eq('id', TRADE).maybeSingle()).data;
  if (!t) {
    console.error(`No trade found for id ${TRADE}`);
    process.exit(2);
  }
  return t.stripe_payment_intent_id;
}

/** Stripe ids already stored for a trade, straight from the DB. */
async function tradeStripeRefs(admin, tradeId) {
  const trade = (await admin.from('trades').select('*').eq('id', tradeId).maybeSingle()).data;
  if (!trade) return null;
  const payments = ((await admin.from('payments').select('*').eq('trade_id', tradeId)).data) || [];
  const taxRecords = ((await admin.from('tax_records').select('*').eq('trade_id', tradeId)).data) || [];
  const refunds = ((await admin.from('trade_refunds').select('*').eq('trade_id', tradeId)).data) || [];
  const payouts = ((await admin.from('seller_payouts').select('*').eq('trade_id', tradeId)).data) || [];

  // Seller's real Connect account (needed to read transfers/payouts on it).
  let connectAccountId;
  const methods = ((await admin.from('seller_payout_methods').select('stripe_account_id, method_type, is_primary').eq('user_id', trade.seller_id)).data) || [];
  for (const m of methods) {
    if (m.method_type === 'stripe_connect' && isRealAcct(m.stripe_account_id)) {
      connectAccountId = m.stripe_account_id;
      if (m.is_primary) break;
    }
  }
  return { trade, payments, taxRecords, refunds, payouts, connectAccountId };
}

/** Layer-3 verdict for a payment: real Stripe charge/refund state for a trade. */
async function providerPaymentFacts(ctx, piId, { account } = {}) {
  if (!piId) return { present: false, note: 'no stripe_payment_intent_id on the trade' };
  const pi = await stripeGet(ctx, `/payment_intents/${piId}`, { account });
  const facts = piFacts(pi);
  let charge = null;
  let refunds = [];
  if (pi.latest_charge) {
    charge = await stripeGet(ctx, `/charges/${pi.latest_charge}`, { account });
    refunds = await stripeList(ctx, '/refunds', { params: { charge: pi.latest_charge }, account, limit: 20 });
  }
  return {
    present: true,
    pi: facts,
    charge: charge
      ? {
          id: charge.id,
          paid: charge.paid,
          status: charge.status,
          amount: charge.amount,
          amount_refunded: charge.amount_refunded,
          refunded: charge.refunded,
          captured: charge.captured,
          created: iso(charge.created),
        }
      : null,
    refunds: refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      reason: r.reason,
      created: iso(r.created),
      currency: r.currency,
    })),
    refund_count: refunds.length,
  };
}

/* --------------------------------- commands -------------------------------- */
const COMMANDS = {
  async account(ctx) {
    const acct = await stripeGet(ctx, '/account');
    // NB: the Account object carries no `livemode` field — the KEY's mode is the
    // mode signal, and a live key is refused outright in lib/stripe-read.mjs.
    emit('platform account', {
      id: acct.id,
      mode: 'test',
      country: acct.country,
      default_currency: acct.default_currency,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
    }, ctx.scope);
  },

  async pi(ctx) {
    const id = await resolvePiId(ID);
    if (!id) throw new Error('Provide a PaymentIntent id, or --trade <uuid>.');
    emit(`payment_intent ${id}`, piFacts(await stripeGet(ctx, `/payment_intents/${id}`, { account: ACCOUNT })), ctx.scope);
  },

  async charge(ctx) {
    if (!ID) throw new Error('Provide a charge id (ch_...).');
    const ch = await stripeGet(ctx, `/charges/${ID}`, { account: ACCOUNT });
    emit(`charge ${ID}`, pick(ch, ['id', 'status', 'paid', 'captured', 'amount', 'amount_refunded', 'refunded', 'disputed', 'customer', 'payment_intent', 'created', 'refunded', 'failure_message']), ctx.scope);
  },

  async refund(ctx) {
    if (!ID) throw new Error('Provide a refund id (re_...).');
    emit(`refund ${ID}`, await stripeGet(ctx, `/refunds/${ID}`, { account: ACCOUNT }), ctx.scope);
  },

  async refunds(ctx) {
    let chargeId = CHARGE;
    const piId = await resolvePiId(PI);
    if (!chargeId && piId) {
      const pi = await stripeGet(ctx, `/payment_intents/${piId}`, { account: ACCOUNT });
      chargeId = pi.latest_charge || undefined;
    }
    if (!chargeId) throw new Error('Provide --charge <ch_...>, --pi <pi_...>, or --trade <uuid>.');
    const rows = await stripeList(ctx, '/refunds', { params: { charge: chargeId }, account: ACCOUNT, limit: LIMIT });
    emit(`refunds for ${chargeId}`, { charge: chargeId, count: rows.length, refunds: rows.map((r) => pick(r, ['id', 'amount', 'status', 'reason', 'created', 'currency'])) }, ctx.scope);
  },

  async si(ctx) {
    if (ID) {
      emit(`setup_intent ${ID}`, await stripeGet(ctx, `/setup_intents/${ID}`, { account: ACCOUNT }), ctx.scope);
      return;
    }
    if (!PM) throw new Error('Provide a SetupIntent id (seti_...) or --pm <pm_...>.');
    const rows = await stripeList(ctx, '/setup_intents', { params: { payment_method: PM }, account: ACCOUNT, limit: LIMIT });
    emit(`setup_intents for ${PM}`, {
      count: rows.length,
      setup_intents: rows.map((s) => pick(s, ['id', 'status', 'usage', 'payment_method', 'customer', 'created', 'latest_attempt'])),
      note: 'usage=off_session + status=succeeded and NO payment_intent = the guide\'s "no immediate charge".',
    }, ctx.scope);
  },

  async pm(ctx) {
    if (!ID) throw new Error('Provide a payment method id (pm_...).');
    const pm = await stripeGet(ctx, `/payment_methods/${ID}`, { account: ACCOUNT });
    emit(`payment_method ${ID}`, {
      id: pm.id,
      type: pm.type,
      customer: pm.customer ?? null,
      card_brand: pm.card?.brand,
      card_last4: pm.card?.last4,
      card_exp: pm.card ? `${pm.card.exp_month}/${pm.card.exp_year}` : null,
      created: iso(pm.created),
    }, ctx.scope);
  },

  /**
   * FIX-Task-39 item 4 (2026-09-16): enumerate EVERY PaymentMethod attached to a
   * customer in one call, instead of guessing pm_ ids one at a time. Verifying the
   * F2 orphan/detached-PM state previously meant repeatedly probing individual ids
   * and could not answer "is any PM still attached to this customer?".
   *
   * Read this against the DB: `subscriptions.stripe_payment_method_id` is the id the
   * APP thinks it saved. An id held there that does NOT appear in this list has been
   * DETACHED on Stripe (Stripe has no delete endpoint for a card PM, and a detached
   * PM can never be re-attached — see qa:invalidate-payment-method).
   */
  async ['pm-list'](ctx) {
    let customerId = CUSTOMER || (ID && String(ID).startsWith('cus_') ? ID : undefined);
    if (!customerId && USER) {
      const { admin } = getClients();
      const userId = await resolveUserId(admin, USER);
      const sub = (await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle()).data;
      if (!sub?.stripe_customer_id) throw new Error(`No stripe_customer_id stored for ${USER}.`);
      customerId = sub.stripe_customer_id;
    }
    if (!customerId) {
      throw new Error('Provide --customer <cus_...>, a cus_... id, or --user <persona|email|uuid>.');
    }

    const rows = await stripeList(ctx, '/payment_methods', {
      params: { customer: customerId },
      account: ACCOUNT,
      limit: LIMIT,
    });

    // Compare against the app's stored id so the orphan case is visible at a glance.
    // Queried by customer id, so it works for BOTH the --customer and --user paths.
    const { admin } = getClients();
    const subRow = (
      await admin
        .from('subscriptions')
        .select('stripe_payment_method_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
    ).data;
    const storedPmId = subRow?.stripe_payment_method_id ?? null;

    emit(`payment_methods for ${customerId}`, {
      customer: customerId,
      count: rows.length,
      // The generic printer collapses arrays of >3 to "[N items]", which would hide
      // exactly the ids this subcommand exists to enumerate — so print them joined
      // as one string (or use --json for the structured list).
      payment_method_ids: rows.map((p) => p.id).join(', ') || '(none)',
      payment_methods: rows.map((p) => ({
        id: p.id,
        type: p.type,
        card_brand: p.card?.brand ?? null,
        card_last4: p.card?.last4 ?? null,
        card_exp: p.card ? `${p.card.exp_month}/${p.card.exp_year}` : null,
        created: iso(p.created),
        is_default_card: p.customer === customerId,
      })),
      app_stored_payment_method_id: storedPmId,
      stored_pm_attached: storedPmId ? rows.some((p) => p.id === storedPmId) : null,
      note: 'Only ATTACHED PMs are listed. A DB-held pm id missing here was detached on Stripe (detached card PMs can never be re-attached) — restore with `npm run qa:ensure-cards -- --persona <name>`.',
    }, ctx.scope);
  },

  async customer(ctx) {
    if (ID) {
      const c = await stripeGet(ctx, `/customers/${ID}`, { account: ACCOUNT });
      emit(`customer ${ID}`, pick(c, ['id', 'email', 'created', 'livemode', 'invoice_settings', 'metadata']), ctx.scope);
      return;
    }
    if (!USER) throw new Error('Provide a customer id (cus_...) or --user <persona|email|uuid>.');
    const { admin } = getClients();
    const userId = await resolveUserId(admin, USER);
    const sub = (await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle()).data;
    if (!sub?.stripe_customer_id) throw new Error(`No stripe_customer_id stored for ${USER}.`);
    const c = await stripeGet(ctx, `/customers/${sub.stripe_customer_id}`, { account: ACCOUNT });
    emit(`customer for ${USER}`, pick(c, ['id', 'email', 'created', 'livemode', 'metadata']), ctx.scope);
  },

  async subscription(ctx) {
    let subId = ID;
    if (!subId && USER) {
      if (USER.startsWith('sub_')) subId = USER;
      else {
        const { admin } = getClients();
        const userId = await resolveUserId(admin, USER);
        const row = (await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()).data;
        subId = row?.stripe_subscription_id;
        if (!subId) throw new Error(`No stripe_subscription_id stored for ${USER}.`);
      }
    }
    if (!subId) throw new Error('Provide a subscription id (sub_...) or --user <persona|email|uuid>.');
    const s = await stripeGet(ctx, `/subscriptions/${subId}`, { account: ACCOUNT });
    const item = s.items?.data?.[0];
    emit(`subscription ${subId}`, {
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      cancel_at: iso(s.cancel_at),
      canceled_at: iso(s.canceled_at),
      current_period_start: iso(s.current_period_start),
      current_period_end: iso(s.current_period_end),
      trial_start: iso(s.trial_start),
      trial_end: iso(s.trial_end),
      test_clock: s.test_clock ?? null,
      default_payment_method: s.default_payment_method ?? null,
      customer: s.customer,
      price: item?.price?.id ?? null,
      unit_amount: item?.price?.unit_amount ?? null,
      interval: item?.price?.recurring?.interval ?? null,
      livemode: s.livemode,
    }, ctx.scope);
  },

  async invoice(ctx) {
    if (!ID) throw new Error('Provide an invoice id (in_...).');
    const inv = await stripeGet(ctx, `/invoices/${ID}`, { account: ACCOUNT });
    emit(`invoice ${ID}`, pick(inv, ['id', 'status', 'paid', 'amount_due', 'amount_paid', 'currency', 'created', 'subscription', 'payment_intent', 'charge', 'attempt_count', 'next_payment_attempt']), ctx.scope);
  },

  async payout(ctx) {
    if (!ID) throw new Error('Provide a payout id (po_...).');
    emit(`payout ${ID}${ACCOUNT ? ` [${ACCOUNT}]` : ''}`, await stripeGet(ctx, `/payouts/${ID}`, { account: ACCOUNT || undefined }), ctx.scope);
  },

  async payouts(ctx) {
    const rows = await stripeList(ctx, '/payouts', { params: STATUS ? { status: STATUS } : {}, account: ACCOUNT || undefined, limit: LIMIT });
    emit(`payouts${ACCOUNT ? ` [${ACCOUNT}]` : ' [platform]'}`, { count: rows.length, payouts: rows.map((p) => pick(p, ['id', 'amount', 'currency', 'status', 'arrival_date', 'created', 'automatic', 'destination'])) }, ctx.scope);
  },

  async transfer(ctx) {
    if (!ID) throw new Error('Provide a transfer id (tr_...).');
    // FIX-Task-52 item 2 (2026-09-17): a platform -> connected-account transfer
    // (`transfers.create({ destination: 'acct_...' })`) is a PLATFORM-level
    // object. Sending `Stripe-Account` makes Stripe look for a transfer OWNED BY
    // the connected account, so it 404s for every platform-initiated transfer.
    // That 404 reads exactly like a DB<->Stripe divergence and nearly produced a
    // false finding this round. Ignore `--account` unless --as-connected is set.
    const scoped = AS_CONNECTED ? ACCOUNT : undefined;
    if (ACCOUNT && !AS_CONNECTED) {
      console.log(
        `  NOTE: ignoring --account ${ACCOUNT} for this transfer read — a platform→connected\n` +
          '        transfer is a PLATFORM-level object. Re-run with --as-connected ONLY if the\n' +
          '        connected account created the transfer itself.'
      );
    }
    emit(
      `transfer ${ID}${scoped ? ` [${scoped}]` : ' [platform]'}`,
      await stripeGet(ctx, `/transfers/${ID}`, { account: scoped }),
      ctx.scope
    );
  },

  async events(ctx) {
    const piId = await resolvePiId(PI);
    const params = {};
    if (piId) params.object = `payment_intent:${piId}`;
    if (TYPES) params.types = TYPES.split(',').map((t) => t.trim()).filter(Boolean);
    const rows = await stripeList(ctx, '/events', { params, account: ACCOUNT, limit: LIMIT });
    emit(`events${piId ? ` for ${piId}` : ''}`, {
      count: rows.length,
      note: 'Stripe returns CURRENT state on object reads; Events are the only way to reconstruct a HISTORICAL state (e.g. "was in requires_capture at the time").',
      events: rows.map((e) => ({
        id: e.id,
        type: e.type,
        created: iso(e.created),
        object_status: e.data?.object?.status,
        object_amount_capturable: e.data?.object?.amount_capturable,
        object_amount_received: e.data?.object?.amount_received,
      })),
    }, ctx.scope);
  },

  async disputes(ctx) {
    const rows = await stripeList(ctx, '/disputes', { params: CHARGE ? { charge: CHARGE } : {}, account: ACCOUNT, limit: LIMIT });
    emit('disputes', {
      count: rows.length,
      disputes: rows.map((d) => pick(d, ['id', 'amount', 'currency', 'status', 'reason', 'charge', 'payment_intent', 'created', 'evidence_details'])),
    }, ctx.scope);
  },

  /** THE MONEY GATE: DB record vs real Stripe state for one trade, all layers. */
  async ['by-trade'](ctx) {
    if (!ID) throw new Error('Provide a trade uuid: qa:stripe-inspect -- by-trade <uuid>');
    const { admin } = getClients();
    const refs = await tradeStripeRefs(admin, ID);
    if (!refs) throw new Error(`No trade found for id ${ID}`);

    const { trade, payments, taxRecords, refunds, payouts, connectAccountId } = refs;
    const payment = payments[0] || null;
    const item = (await admin.from('items').select('id, title, price, accepts_swap_points, tax_category_id').eq('id', trade.listing_id).maybeSingle()).data;

    const piId = trade.stripe_payment_intent_id || payment?.stripe_payment_intent_id || null;
    let provider = { present: false, note: 'no PI id on the trade/payments row' };
    let providerError = null;
    if (piId) {
      try {
        provider = await providerPaymentFacts(ctx, piId);
        // FIX-Task-52 item 2 (2026-09-17): the transfer object is PLATFORM-level
        // even though its money lands on the seller's connected account — reading
        // it WITH the `Stripe-Account` header 404s. Read it unscoped.
        if (payouts.some((p) => p.provider_reference_id?.startsWith('tr_'))) {
          provider.transfer = await stripeGet(
            ctx,
            `/transfers/${payouts.find((p) => p.provider_reference_id?.startsWith('tr_')).provider_reference_id}`
          );
          provider.transfer_scope = connectAccountId ? 'platform (destination ' + connectAccountId + ')' : 'platform';
        }
      } catch (e) {
        providerError = e.message;
      }
    }

    const dbCharged = payment?.total_charged_cents ?? null;
    const piAmount = provider.pi?.amount ?? null;
    const captured = provider.pi ? Number(provider.pi.amount_received) > 0 : null;
    const taxCaptured = taxRecords.some((t) => t.captured_at) || taxRecords.some((t) => t.tax_status === 'collected');
    const taxVoided = taxRecords.some((t) => t.tax_status === 'voided') || taxRecords.some((t) => t.voided_at);

    const out = {
      key_scope: ctx.scope,
      trade: pick(trade, [
        'id', 'status', 'listing_id', 'bundle_id', 'buyer_id', 'seller_id',
        'cash_amount_cents', 'sp_amount', 'buyer_transaction_fee_cents',
        'seller_transaction_fee_cents', 'tax_amount_cents',
        'cancellation_reason', 'cancelled_at', 'completed_at', 'created_at',
        'stripe_payment_intent_id', 'payout_status',
      ]),
      item: item ? pick(item, ['id', 'title', 'price', 'accepts_swap_points', 'tax_category_id']) : null,
      db: {
        payments: payment
          ? {
              id: payment.id,
              // R100: this is a trigger-written MIRROR, never Stripe's state.
              derived_state: payment.derived_state ?? payment.status ?? null,
              derived_state_is_mirror: true,
              total_charged_cents: payment.total_charged_cents,
              item_price_cents: payment.item_price_cents,
              platform_fee_cents: payment.platform_fee_cents,
              tax_amount_cents: payment.tax_amount_cents,
              sp_amount: payment.sp_amount,
              refunded_cents: payment.refunded_cents,
              captured_at: payment.captured_at,
              refunded_at: payment.refunded_at,
              stripe_payment_intent_id: payment.stripe_payment_intent_id,
            }
          : null,
        tax_records: taxRecords.map((t) => pick(t, ['id', 'tax_status', 'taxable_amount_cents', 'tax_amount_cents', 'refunded_tax_cents', 'captured_at', 'voided_at', 'stripe_refund_id', 'reconciliation_status'])),
        trade_refunds: refunds.map((r) => pick(r, ['id', 'stripe_refund_id', 'refund_amount_cents', 'refund_price_cents', 'refund_fee_cents', 'refund_tax_cents', 'status', 'reason', 'created_at'])),
        seller_payouts: payouts.map((p) => pick(p, ['id', 'status', 'provider', 'provider_reference_id', 'gross_amount_cents', 'net_amount_cents', 'created_at'])),
        connect_account_id: connectAccountId ?? null,
      },
      provider,
      ...(providerError ? { provider_error: providerError } : {}),
      checks: {
        pi_amount_vs_db_total_charged: {
          stripe_amount: piAmount,
          db_total_charged_cents: dbCharged,
          verdict: agree(piAmount, dbCharged),
        },
        capture_state: {
          stripe_amount_received: provider.pi?.amount_received ?? null,
          stripe_amount_capturable: provider.pi?.amount_capturable ?? null,
          stripe_captured: provider.pi?.captured ?? null,
          db_payments_captured_at: payment?.captured_at ?? null,
          db_tax_captured: taxCaptured,
          db_tax_voided: taxVoided,
          note: 'Stripe is authoritative for capture; payments.captured_at and tax_records are mirrors.',
        },
        refund_count: {
          stripe_refund_count: provider.refund_count ?? null,
          db_trade_refund_rows: refunds.length,
          verdict: provider.present ? agree(provider.refund_count ?? 0, refunds.length) : 'NOT_COMPARABLE',
        },
        single_refund_outcome: {
          stripe_refund_count: provider.refund_count ?? null,
          expectation: 'exactly 1 for a single refund; >1 = duplicate-refund defect',
          verdict: provider.present ? (provider.refund_count <= 1 ? 'OK' : 'DISAGREE') : 'NOT_COMPARABLE',
        },
        payout_reality: {
          db_payout_rows: payouts.length,
          stripe_transfer_present: Boolean(provider.transfer),
          note: 'A payout row with no Stripe Transfer can be the documented synthetic-payout boundary, not a bug.',
        },
      },
      notes: [
        'payments.derived_state is a TRIGGER MIRROR of trades.status (fn_payments_sync_from_trade) - never evidence of Stripe state (R100).',
        'trades.payout_status stays default on cancelled trades - judge payouts on seller_payouts (R100/QTA-2026-09-13).',
        'A since-cancelled PI legitimately reads status=canceled today; use `events` to reconstruct historical state.',
      ],
    };
    console.log(JSON.stringify(out, null, 2));
  },

  /** Persona-level view: subscription + PM + invoices + PIs + Connect account. */
  async ['by-user'](ctx) {
    const ref = ID || USER;
    if (!ref) throw new Error('Provide a persona/email/uuid: qa:stripe-inspect -- by-user test-buyer');
    const { admin } = getClients();
    const userId = await resolveUserId(admin, ref);
    if (!userId) throw new Error(`Cannot resolve '${ref}' to an auth user.`);

    const sub = (await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()).data;
    const methods = ((await admin.from('seller_payout_methods').select('*').eq('user_id', userId)).data) || [];

    const out = {
      key_scope: ctx.scope,
      ref,
      user_id: userId,
      db_subscription: sub
        ? pick(sub, ['status', 'subscription_tier', 'current_period_start', 'current_period_end', 'grace_started_at', 'grace_ends_at', 'cancel_reason', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_payment_method_id', 'stripe_price_id'])
        : null,
      provider: {},
    };

    if (sub?.stripe_customer_id) {
      out.provider.customer = pick(await stripeGet(ctx, `/customers/${sub.stripe_customer_id}`), ['id', 'email', 'created', 'livemode', 'metadata']);
      const pms = await stripeList(ctx, '/payment_methods', { params: { customer: sub.stripe_customer_id }, limit: 20 });
      out.provider.payment_methods = pms.map((p) => ({ id: p.id, type: p.type, card_last4: p.card?.last4, created: iso(p.created) }));
      const subs = await stripeList(ctx, '/subscriptions', { params: { customer: sub.stripe_customer_id }, limit: 20 });
      out.provider.subscriptions = subs.map((s) => ({ id: s.id, status: s.status, cancel_at_period_end: s.cancel_at_period_end, cancel_at: iso(s.cancel_at), current_period_end: iso(s.current_period_end) }));
      const invs = await stripeList(ctx, '/invoices', { params: { customer: sub.stripe_customer_id }, limit: 20 });
      out.provider.invoices = invs.map((i) => ({ id: i.id, status: i.status, amount_paid: i.amount_paid, created: iso(i.created), subscription: i.subscription }));
    }
    if (sub?.stripe_payment_method_id) {
      try {
        out.provider.saved_payment_method = pick(await stripeGet(ctx, `/payment_methods/${sub.stripe_payment_method_id}`), ['id', 'type', 'customer', 'card', 'created']);
        out.provider.saved_pm_attached_to_expected_customer = out.provider.saved_payment_method.customer === sub.stripe_customer_id ? 'AGREE' : 'DISAGREE';
      } catch (e) {
        out.provider.saved_payment_method_error = e.message;
      }
    }
    out.provider.connect_accounts = [];
    for (const m of methods) {
      if (!isRealAcct(m.stripe_account_id)) continue;
      try {
        const a = await stripeGet(ctx, `/accounts/${m.stripe_account_id}`);
        out.provider.connect_accounts.push({ stripe_account_id: a.id, details_submitted: a.details_submitted, payouts_enabled: a.payouts_enabled, charges_enabled: a.charges_enabled });
      } catch (e) {
        out.provider.connect_accounts.push({ stripe_account_id: m.stripe_account_id, error: e.message });
      }
    }
    console.log(JSON.stringify(out, null, 2));
  },
};

/* ----------------------------------- main ---------------------------------- */
async function main() {
  const ctx = getReadKey({ breakGlass: hasFlag('break-glass-secret-key') });

  if (!SUB || !COMMANDS[SUB]) {
    console.error('Subcommands: ' + Object.keys(COMMANDS).join(', '));
    console.error('Run with no args to print this list. See the file header for usage examples.');
    process.exit(SUB ? 2 : 0);
  }
  // Diagnostics ALWAYS go to stderr so stdout stays pure evidence:
  //   npm run --silent qa:stripe-inspect -- by-trade <uuid> > evidence.json
  console.error(`[stripe-inspect] key_scope=${ctx.scope} (source: ${ctx.source})`);
  if (ctx.scope !== SCOPE_RESTRICTED) {
    console.error('!! This run is NOT backed by the restricted read-only key — label the evidence accordingly.');
  }

  try {
    await COMMANDS[SUB](ctx);
  } catch (e) {
    console.error('\n' + e.message);
    process.exit(1);
  }
}

main();
