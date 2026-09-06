// QA Task 37 — read-only Stripe account requirements probe (F-4 pattern).
// Reads the Stripe test key from ~/.dt11-stripe-key (never echoed), GETs the
// given account, prints requirements.currently_due / eventually_due + identity.
// Run: node qa37-stripe-account-probe.mjs <acct_id>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const acctId = process.argv[2];
if (!acctId) {
  console.error('usage: node qa37-stripe-account-probe.mjs <acct_id>');
  process.exit(2);
}
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

const res = await fetch(`https://api.stripe.com/v1/accounts/${acctId}`, {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});
const acct = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('GET failed', res.status, JSON.stringify(acct));
  process.exit(1);
}
console.log(JSON.stringify({
  id: acct.id,
  details_submitted: acct.details_submitted,
  charges_enabled: acct.charges_enabled,
  payouts_enabled: acct.payouts_enabled,
  individual_first: acct.individual?.first_name ?? null,
  individual_last: acct.individual?.last_name ?? null,
  currently_due: acct.requirements?.currently_due ?? [],
  eventually_due: acct.requirements?.eventually_due ?? [],
  disabled_reason: acct.requirements?.disabled_reason ?? null,
  business_profile_url: acct.business_profile?.url ?? null,
  business_profile_product_description: acct.business_profile?.product_description ?? null,
  tos_acceptance: !!acct.tos_acceptance?.date,
}, null, 2));
