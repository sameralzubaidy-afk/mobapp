/**
 * QA tool — start-of-run authoritative-state helper (DT-124 item 7, the QA Task
 * 37 decision-log I-7 ask).
 *
 * ONE command that reads a persona's current authoritative state before a QA
 * batch, replacing the ~54-call recon/prep phase of repeated SQL + probe reads:
 *
 *   - profile (node_id, profile_completed, phone_verified)
 *   - subscription (status, period start/end, grace window, cancel_reason,
 *     stripe_payment_method_id)
 *   - SP wallet (available/pending/lifetime, state)
 *   - seller balance (available/pending/lifetime, trades completed)
 *   - seller_payout_methods (id, type, primary, verified, onboarding/payouts/
 *     charges flags, stripe_account_id, paypal/venmo refs)
 *   - recent seller_payouts (status, gross/net, provider_reference_id)
 *   - billing_history tail (count + last invoice/amount)
 *   - per stripe_connect method: the LIVE Stripe account
 *     details_submitted/payouts_enabled/charges_enabled +
 *     requirements.currently_due / eventually_due / disabled_reason
 *     (key from ~/.dt11-stripe-key, never echoed)
 *
 * Read-only. Usage (from p2p-kids-marketplace):
 *   npm run qa:start-state                 # default qa-payout-seller
 *   npm run qa:start-state -- test-buyer   # persona short-name
 *   npm run qa:start-state -- someone@kidsmarketplace.test   # email
 *   npm run qa:start-state -- <uuid>       # raw auth user id
 *   npm run qa:start-state -- qa-payout-seller --json
 */
import { getClients, getStripeKey, resolveUserId, log } from './lib/r41-common.mjs';

const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
const ref = positional || 'qa-payout-seller@kidsmarketplace.test';
const AS_JSON = process.argv.includes('--json');

const { url, admin } = getClients();
const stripeKey = getStripeKey();

async function stripeCall(method, path, form) {
  let target = `https://api.stripe.com/v1${path}`;
  const isGet = method === 'GET';
  if (isGet && form) target += '?' + new URLSearchParams(form).toString();
  const res = await fetch(target, {
    method,
    headers: { Authorization: `Bearer ${stripeKey}` },
    body: !isGet && form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function one(row) {
  const by = { user_id: row.user_id };
  const out = { ref, user_id: row.user_id };

  // profile
  const profile = (await admin.from('profiles').select('node_id, profile_completed, phone_verified, role').eq('user_id', row.user_id).maybeSingle()).data;
  out.profile = profile;

  // subscription
  const sub = (await admin.from('subscriptions').select('*').eq('user_id', row.user_id).maybeSingle()).data;
  if (sub) {
    out.subscription = {
      status: sub.status,
      tier: sub.subscription_tier,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      grace_started_at: sub.grace_started_at,
      grace_ends_at: sub.grace_ends_at,
      cancel_reason: sub.cancel_reason,
      has_pm: Boolean(sub.stripe_payment_method_id),
    };
  } else {
    out.subscription = null;
  }

  // SP wallet
  const wallet = (await admin.from('sp_wallets').select('available_balance, pending_balance, lifetime_earned, lifetime_spent, state').eq('user_id', row.user_id).maybeSingle()).data;
  out.sp_wallet = wallet;

  // seller balance
  const bal = (await admin.from('seller_balance').select('available_balance_cents, pending_balance_cents, lifetime_earnings_cents, total_trades_completed').eq('user_id', row.user_id).maybeSingle()).data;
  out.seller_balance = bal;

  // payout methods
  const methods = (await admin.from('seller_payout_methods').select('id, method_type, is_primary, is_verified, stripe_onboarding_complete, stripe_payouts_enabled, stripe_charges_enabled, stripe_account_id, paypal_email, venmo_handle, venmo_phone_e164').eq('user_id', row.user_id).order('is_primary', { ascending: false }))?.data ?? [];
  out.payout_methods = methods.map((m) => ({
    id: m.id,
    method_type: m.method_type,
    is_primary: m.is_primary,
    is_verified: m.is_verified,
    onboarding_complete: m.stripe_onboarding_complete,
    payouts_enabled: m.stripe_payouts_enabled,
    charges_enabled: m.stripe_charges_enabled,
    stripe_account_id: m.stripe_account_id,
    paypal_email: m.paypal_email,
    venmo_handle: m.venmo_handle,
  }));

  // recent payouts
  const payouts = (await admin.from('seller_payouts').select('id, status, provider, provider_reference_id, gross_amount_cents, net_amount_cents, trade_id, created_at').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(5))?.data ?? [];
  out.recent_payouts = payouts;

  // billing history tail
  const { count } = await admin.from('billing_history').select('*', { count: 'exact', head: true }).eq('user_id', row.user_id);
  out.billing_history_count = count ?? 0;
  const lastBill = (await admin.from('billing_history').select('invoice_id, amount_cents, status, created_at').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(3))?.data ?? [];
  out.billing_history_tail = lastBill;

  // Stripe Connect live state per stripe_connect method
  out.stripe_connect = [];
  for (const m of methods) {
    if (m.method_type !== 'stripe_connect' || !m.stripe_account_id) continue;
    try {
      const acct = await stripeCall('GET', `/accounts/${m.stripe_account_id}`);
      out.stripe_connect.push({
        stripe_account_id: m.stripe_account_id,
        details_submitted: acct.details_submitted,
        payouts_enabled: acct.payouts_enabled,
        charges_enabled: acct.charges_enabled,
        currently_due: acct.requirements?.currently_due ?? [],
        eventually_due: acct.requirements?.eventually_due ?? [],
        disabled_reason: acct.requirements?.disabled_reason ?? null,
      });
    } catch (e) {
      out.stripe_connect.push({ stripe_account_id: m.stripe_account_id, error: e.message });
    }
  }
  return out;
}

async function main() {
  const userId = await resolveUserId(admin, ref);
  if (!userId) {
    console.error(`❌ Cannot resolve '${ref}' to an auth user.`);
    process.exit(2);
  }
  log(`resolved '${ref}' -> ${userId}`);
  const out = await one({ user_id: userId });
  if (AS_JSON) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const f = (v) => (v === null || v === undefined ? '—' : String(v));
    console.log('\n=== START-OF-RUN STATE ===');
    console.log(`user        ${userId}`);
    console.log(`node        ${f(out.profile?.node_id)} · profile_completed ${f(out.profile?.profile_completed)} · phone_verified ${f(out.profile?.phone_verified)}`);
    console.log(`subscription ${f(out.subscription?.status)} · tier ${f(out.subscription?.tier)} · period_end ${f(out.subscription?.current_period_end)} · grace_end ${f(out.subscription?.grace_ends_at)} · cancel ${f(out.subscription?.cancel_reason)} · has_pm ${f(out.subscription?.has_pm)}`);
    console.log(`sp_wallet   avail ${f(out.sp_wallet?.available_balance)} · pending ${f(out.sp_wallet?.pending_balance)} · state ${f(out.sp_wallet?.state)}`);
    console.log(`balance     avail ${f(out.seller_balance?.available_balance_cents)}¢ · pending ${f(out.seller_balance?.pending_balance_cents)}¢ · lifetime ${f(out.seller_balance?.lifetime_earnings_cents)}¢ · trades ${f(out.seller_balance?.total_trades_completed)}`);
    for (const m of out.payout_methods) {
      console.log(`method      ${m.method_type}${m.is_primary ? ' PRIMARY' : ''} verified=${f(m.is_verified)} onboard=${f(m.onboarding_complete)} payouts=${f(m.payouts_enabled)} acct=${f(m.stripe_account_id)}`);
    }
    for (const p of out.recent_payouts) {
      console.log(`payout      ${p.status} · ${p.provider} · net ${f(p.net_amount_cents)}¢ · ref ${f(p.provider_reference_id)} · ${f(p.created_at)}`);
    }
    for (const sc of out.stripe_connect) {
      console.log(`connect     ${sc.stripe_account_id} submitted=${f(sc.details_submitted)} payouts=${f(sc.payouts_enabled)} charges=${f(sc.charges_enabled)} due=${JSON.stringify(sc.currently_due ?? [])} disabled=${f(sc.disabled_reason)}`);
    }
    console.log(`billing     ${out.billing_history_count} row(s); tail=${JSON.stringify((out.billing_history_tail ?? []).map((b) => ({ i: b.invoice_id, amt: b.amount_cents, s: b.status })))}`);
    console.log('=== END ===\n');
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exitCode = 1;
});
