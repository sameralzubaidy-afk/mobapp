// qa-reset-harness.mjs — Group Q+S calibration run (2026-08-23)
// Mints a recovery link via the staging `admin-trigger-password-reset` harness
// (return_link: true) and delivers the tokenized deep link straight to the iOS
// simulator. All minted credentials (admin JWT, OTP, access/refresh tokens) are
// used internally and NEVER printed — only a redacted confirmation is emitted.
// Credentials come from env vars (documented staging admin cred; anon is publishable).
//
// Usage (from p2p-kids-marketplace/):
//   P2P_ANON_KEY=... P2P_ADMIN_EMAIL=... P2P_ADMIN_PW=... \
//   P2P_TARGET_EMAIL=... P2P_SIM_UDID=... \
//   node ../e2e-test-results/group-qs-calibration-2026-08-23/qa-reset-harness.mjs

import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';

const API_URL = 'https://drntwgporzabmxdqykrp.supabase.co';
const ANON = process.env.P2P_ANON_KEY;
const ADMIN_EMAIL = process.env.P2P_ADMIN_EMAIL;
const ADMIN_PW = process.env.P2P_ADMIN_PW;
const TARGET = process.env.P2P_TARGET_EMAIL;
const UDID = process.env.P2P_SIM_UDID;

if (!ANON || !ADMIN_EMAIL || !ADMIN_PW || !TARGET || !UDID) {
  console.error('[qa-harness] missing env: P2P_ANON_KEY, P2P_ADMIN_EMAIL, P2P_ADMIN_PW, P2P_TARGET_EMAIL, P2P_SIM_UDID');
  process.exit(2);
}

// 1) Admin JWT (password grant with the documented staging admin).
const tokRes = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PW }),
});
const tokJson = await tokRes.json();
if (!tokJson.access_token) {
  throw new Error(`[qa-harness] admin token mint failed (status ${tokRes.status}): ${JSON.stringify(tokJson).slice(0, 200)}`);
}
const adminJwt = tokJson.access_token;

// 2) Mint recovery link (return_link: true).
const mintRes = await fetch(`${API_URL}/functions/v1/admin-trigger-password-reset`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${adminJwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TARGET, return_link: true }),
});
const mintJson = await mintRes.json();
if (!mintJson.resetLink) {
  throw new Error(`[qa-harness] mint failed (status ${mintRes.status}): ${JSON.stringify(mintJson).slice(0, 300)}`);
}
const otp = new URL(mintJson.resetLink).searchParams.get('token');
if (!otp) {
  throw new Error('[qa-harness] resetLink had no token param');
}

// 3) Exchange OTP for access/refresh tokens via the web-redirect GET (303 → Location fragment).
const exUrl = `${API_URL}/auth/v1/verify?token=${encodeURIComponent(otp)}&type=recovery&redirect_to=${encodeURIComponent('p2pkidsmarketplace://reset-password')}`;
const exRes = await fetch(exUrl, { redirect: 'manual' });
const location = exRes.headers.get('location');
if (!location) {
  throw new Error(`[qa-harness] OTP exchange failed (status ${exRes.status})`);
}

// 4) Deliver the tokenized deep link straight to the simulator (never printed).
execFileSync('xcrun', ['simctl', 'openurl', UDID, location], { stdio: 'inherit' });
console.log(`[qa-harness] recovery deep link delivered to simulator (fragment length ${(location.split('#')[1] || '').length})`);
