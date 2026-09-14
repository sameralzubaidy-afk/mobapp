// File: supabase/functions/_shared/service-credential.test.ts
//
// FIX-Task-34 item 4 regression guard — drift-proof service-role acceptance.
//
// Run with:
//   deno test --allow-env --no-config --no-lock supabase/functions/_shared/service-credential.test.ts
//
// WHY THIS TEST EXISTS
// --------------------
// The defect it guards is DRIFT-dependent and therefore invisible to a static
// read: the code looks correct, and it IS correct while the caller's key happens
// to equal the injected env key. It only breaks when the two strings diverge —
// which is an environment fact, not a code fact. So the honest check is an
// assertion on the DECISION, with `fetch` injected:
//
//   * a real service credential must be accepted even though it does not equal
//     our env key (the whole point of the fix);
//   * a normal user JWT must be rejected WITHOUT any network call (the
//     pre-filter must not turn every request into an Auth round-trip);
//   * every failure path must fail CLOSED (network throw, 401, 403), because an
//     open failure here would let an arbitrary caller request a refund.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  decodeJwtRole,
  looksLikeServiceCredential,
  isValidServiceCredential,
} from './service-credential.ts';

/** Build an unsigned JWT-shaped token with the given `role` claim. */
function fakeJwt(role: string): string {
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role, sub: '00000000-0000-0000-0000-000000000000' })}.sig`;
}

const URL_BASE = 'https://project.supabase.co';

/** A fetch stub that records how many times it was called. */
function stubFetch(respond: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const impl = (input: string) => {
    calls.push(input);
    return Promise.resolve(respond());
  };
  return { impl, calls };
}

const ok = () => new Response('{"users":[]}', { status: 200 });
const unauthorized = () => new Response('{"message":"bad key"}', { status: 401 });

Deno.test('decodeJwtRole reads the role claim, and never throws on junk', () => {
  assertEquals(decodeJwtRole(fakeJwt('service_role')), 'service_role');
  assertEquals(decodeJwtRole(fakeJwt('authenticated')), 'authenticated');
  assertEquals(decodeJwtRole('not-a-jwt'), null);
  assertEquals(decodeJwtRole(''), null);
  assertEquals(decodeJwtRole('a.b.c'), null);
});

Deno.test('pre-filter accepts a service-role JWT and a new-style secret key', () => {
  assertEquals(looksLikeServiceCredential(fakeJwt('service_role')), true);
  assertEquals(looksLikeServiceCredential('sb_secret_abc123'), true);
});

Deno.test('pre-filter rejects a normal user JWT — no network call is made', async () => {
  const { impl, calls } = stubFetch(ok);
  assertEquals(looksLikeServiceCredential(fakeJwt('authenticated')), false);
  assertEquals(await isValidServiceCredential(URL_BASE, fakeJwt('authenticated'), impl), false);
  assertEquals(calls.length, 0);
});

Deno.test('item 4: a valid service credential is accepted even though it is NOT our env key', async () => {
  const { impl, calls } = stubFetch(ok);
  // This is the regression: the old code string-compared and would return false here.
  assertEquals(await isValidServiceCredential(URL_BASE, fakeJwt('service_role'), impl), true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].includes('/auth/v1/admin/users'), true);
});

Deno.test('fail CLOSED — a 401 from the Auth admin endpoint rejects the credential', async () => {
  const { impl } = stubFetch(unauthorized);
  assertEquals(await isValidServiceCredential(URL_BASE, fakeJwt('service_role'), impl), false);
});

Deno.test('fail CLOSED — a thrown network error rejects the credential', async () => {
  const impl = () => Promise.reject(new Error('network down'));
  assertEquals(await isValidServiceCredential(URL_BASE, fakeJwt('service_role'), impl), false);
});

Deno.test('fail CLOSED — missing url / empty token never reach the network', async () => {
  const { impl, calls } = stubFetch(ok);
  assertEquals(await isValidServiceCredential('', fakeJwt('service_role'), impl), false);
  assertEquals(await isValidServiceCredential(URL_BASE, '', impl), false);
  assertEquals(calls.length, 0);
});
