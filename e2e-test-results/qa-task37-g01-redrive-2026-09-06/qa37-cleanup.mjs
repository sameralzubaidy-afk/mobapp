// QA Task 37 cleanup (R41/BP-70) — Stripe-side.
// Deletes the disposable user's customer (cancels its subs) and the Batch B
// Connect account created for the G01 re-drive.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', 'p2p-kids-admin', '.env.local') });

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('no STRIPE_SECRET_KEY');
  process.exit(2);
}

const stripeFetch = async (method, path) => {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const CUSTOMER = process.argv[2] || 'cus_VD79HhriarejMN';
const CONNECT_ACCOUNT = process.argv[3] || 'acct_1UCgIu4HHYZdHIok';

// 1. Delete the disposable's customer (cancels sub_1UCgva4 + sub_1UCh0o4, detaches PM)
const del = await stripeFetch('DELETE', `/customers/${CUSTOMER}`);
console.log('delete customer', del.status, del.json.id || del.json.error?.message);

// 2. Delete the Batch B Connect account (G01 re-drive residue)
const conn = await stripeFetch('DELETE', `/accounts/${CONNECT_ACCOUNT}`);
console.log('delete connect account', conn.status, conn.json.id || conn.json.error?.message);

process.exit(0);
