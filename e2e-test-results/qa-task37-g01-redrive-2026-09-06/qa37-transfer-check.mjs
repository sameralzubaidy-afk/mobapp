// QA Task 37 — read-only check of real Stripe transfers to the Connect account
// after the app-initiated withdrawal. Reads the Stripe key from ~/.dt11-stripe-key.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const acctId = process.argv[2] || 'acct_1UCgIu4HHYZdHIok';
const STRIPE_KEY = readFileSync(resolve(process.env.HOME || '~', '.dt11-stripe-key'), 'utf8').trim();

const transfersRes = await fetch(`https://api.stripe.com/v1/transfers?destination=${acctId}&limit=5`, {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});
const transfers = await transfersRes.json().catch(() => ({}));
console.log('transfers list:', transfersRes.status);
if (transfers.data) {
  console.log(JSON.stringify(transfers.data.map((t) => ({
    id: t.id,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    destination: t.destination,
    created: new Date(t.created * 1000).toISOString(),
  })), null, 2));
} else {
  console.log(JSON.stringify(transfers).slice(0, 800));
}
