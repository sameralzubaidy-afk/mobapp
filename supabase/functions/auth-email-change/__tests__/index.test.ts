// File: supabase/functions/auth-email-change/__tests__/index.test.ts
// Dev Task B02 (ACC-TC-B02): unit tests for the two CRITICAL auth-email-change
// defects found by the QA Full Closure batch on 2026-08-26:
//   1. (BP-62) verify_email_change_code is RETURNS TABLE(...) so supabase-js
//      returns an ARRAY; the EF read .success/.new_email off the array → verify
//      ALWAYS "failed" even after the RPC set verified_at. The email was never
//      applied.
//   2. (BP-63) the EMAIL_IN_USE uniqueness guard used a cross-schema PostgREST
//      query (admin.schema('auth').from('users').maybeSingle()) that returns
//      HTTP 406 → treated as "no user" → a change to another account's email
//      was ACCEPTED (account-email-takeover hazard).
//
// These tests exercise the REAL exported logic (unwrapRpcResult,
// emailOwnedByOtherUser, handleAction) with a mock admin client — they prove
// the fixed behavior, not a mirror of it.
//
// Run with:
//   deno test --allow-env --allow-net supabase/functions/auth-email-change/__tests__/index.test.ts

import {
  assertEquals,
  assert,
  assertMatch,
} from 'https://deno.land/std@0.201.0/testing/asserts.ts';
import {
  emailOwnedByOtherUser,
  handleAction,
  unwrapRpcResult,
} from '../index.ts';

// ─── Mock admin client ──────────────────────────────────────────────────────
type RpcResult = { data: unknown; error: unknown };

function buildMockAdmin(
  rpcResults: Record<string, RpcResult> = {},
  defaultRpc: RpcResult = { data: null, error: null }
) {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    rpc: async (fn: string, params: unknown): Promise<RpcResult> => {
      calls.push({ method: `rpc.${fn}`, args: [params] });
      return rpcResults[fn] || defaultRpc;
    },
    auth: {
      admin: {
        updateUserById: async (id: string, attrs: unknown) => {
          calls.push({ method: 'auth.admin.updateUserById', args: [id, attrs] });
          return { error: null };
        },
      },
    },
    from: () => ({
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
    schema: () => ({}),
  };
}

type MockAdmin = ReturnType<typeof buildMockAdmin>;
type AdminClient = Parameters<typeof handleAction>[0];

function asAdmin(admin: MockAdmin): AdminClient {
  return admin as unknown as AdminClient;
}

/** Stub fetch so sendVerificationEmail / sendOldEmailSecurityAlert succeed. */
function stubFetchOk(): () => void {
  const original = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = async () =>
    new Response(JSON.stringify({}), { status: 200 });
  return () => {
    (globalThis as { fetch: typeof fetch }).fetch = original;
  };
}

// ─── Fix 1: unwrapRpcResult (TABLE-returning RPC → array) ────────────────────
Deno.test('BP-62 unwrapRpcResult: RETURNS TABLE result (array of 1) resolves .success/.new_email', () => {
  const row = unwrapRpcResult([
    { success: true, message: 'Code verified', new_email: 'new@example.com' },
  ]);
  assertEquals(row?.success, true);
  assertEquals(row?.new_email, 'new@example.com');
});

Deno.test('BP-62 unwrapRpcResult: empty array → undefined (never a false success)', () => {
  assertEquals(unwrapRpcResult([]), undefined);
});

Deno.test('BP-62 unwrapRpcResult: jsonb RPC (already an object) passes through', () => {
  const row = unwrapRpcResult({ exists: true, user_id: 'abc' });
  assertEquals(row?.exists, true);
});

Deno.test('BP-62 unwrapRpcResult: null/undefined → undefined', () => {
  assertEquals(unwrapRpcResult(null), undefined);
  assertEquals(unwrapRpcResult(undefined), undefined);
});

// ─── Fix 2: emailOwnedByOtherUser decision helper ────────────────────────────
Deno.test('BP-63 emailOwnedByOtherUser: another account owns the email → conflict (REJECT)', () => {
  assertEquals(
    emailOwnedByOtherUser(
      { exists: true, user_id: 'db71e4d8-4f18-9d3a-99e0-2e7f6fdb7d5c' },
      'current-user-id'
    ),
    true
  );
});

Deno.test('BP-63 emailOwnedByOtherUser: same user owns the email → no conflict', () => {
  assertEquals(emailOwnedByOtherUser({ exists: true, user_id: 'me' }, 'me'), false);
});

Deno.test('BP-63 emailOwnedByOtherUser: email not registered → no conflict', () => {
  assertEquals(emailOwnedByOtherUser({ exists: false, user_id: null }, 'me'), false);
});

Deno.test('BP-63 emailOwnedByOtherUser: RPC returned null/undefined → no conflict (fail closed on shape)', () => {
  assertEquals(emailOwnedByOtherUser(null, 'me'), false);
  assertEquals(emailOwnedByOtherUser(undefined, 'me'), false);
});

// ─── Fix 2: the explicit duplicate-email REJECTION path (required test) ─────
Deno.test('handleAction request → email owned by ANOTHER account → 409 EMAIL_IN_USE (rejects change)', async () => {
  const admin = buildMockAdmin({
    check_account_exists_by_email: {
      data: {
        exists: true,
        user_id: 'db71e4d8-4f18-9d3a-99e0-2e7f6fdb7d5c',
        providers: ['email'],
        has_password: true,
      },
      error: null,
    },
  });

  const res = await handleAction(
    asAdmin(admin),
    'current-user-id',
    'current@example.com',
    { action: 'request', newEmail: 'already-registered@example.com' }
  );

  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error.code, 'EMAIL_IN_USE');
  assertMatch(body.error.message, /already used by another account/);
  // No pending request was minted and no email was sent.
  assert(!admin.calls.some((c) => c.method === 'rpc.create_email_change_request'));
});

Deno.test('handleAction request → same user owns the target email → NOT rejected (allowed to continue)', async () => {
  const admin = buildMockAdmin({
    check_account_exists_by_email: {
      data: {
        exists: true,
        user_id: 'current-user-id',
        providers: ['email'],
        has_password: true,
      },
      error: null,
    },
    hash_otp_code: { data: '$2a$06$hashed', error: null },
    create_email_change_request: { data: '00000000-0000-0000-0000-000000000001', error: null },
  });
  const restoreFetch = stubFetchOk();
  try {
    const res = await handleAction(
      asAdmin(admin),
      'current-user-id',
      'current@example.com',
      { action: 'request', newEmail: 'new@example.com' }
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
    // Uniqueness went through the RPC (not the broken cross-schema PostgREST query).
    assert(admin.calls.some((c) => c.method === 'rpc.check_account_exists_by_email'));
  } finally {
    restoreFetch();
  }
});

Deno.test('handleAction request → uniqueness RPC errors → 500 (fail CLOSED, never allow)', async () => {
  const admin = buildMockAdmin({
    check_account_exists_by_email: { data: null, error: { message: 'boom' } },
  });

  const res = await handleAction(
    asAdmin(admin),
    'current-user-id',
    'current@example.com',
    { action: 'request', newEmail: 'new@example.com' }
  );

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error.code, 'INTERNAL');
  assert(!admin.calls.some((c) => c.method === 'rpc.create_email_change_request'));
});

// ─── Fix 1: full verify path applies the email once the array is unwrapped ──
Deno.test('handleAction verify → correct code (TABLE RPC returns array) → 200 + email applied', async () => {
  const admin = buildMockAdmin({
    verify_email_change_code: {
      data: [{ success: true, message: 'Code verified', new_email: 'new@example.com' }],
      error: null,
    },
    complete_email_change: { data: { success: true }, error: null },
  });
  const restoreFetch = stubFetchOk();
  try {
    const res = await handleAction(
      asAdmin(admin),
      'current-user-id',
      'old@example.com',
      { action: 'verify', code: '123456' }
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
    assertEquals(body.newEmail, 'new@example.com');
    // The admin apply ran — this never happened before the fix.
    const updateCall = admin.calls.find((c) => c.method === 'auth.admin.updateUserById');
    assert(updateCall, 'admin.auth.admin.updateUserById should have been called');
    assertEquals(
      (updateCall?.args[1] as { email?: string })?.email,
      'new@example.com'
    );
  } finally {
    restoreFetch();
  }
});

Deno.test('handleAction verify → wrong code (array with success:false) → INVALID_CODE, no apply', async () => {
  const admin = buildMockAdmin({
    verify_email_change_code: {
      data: [
        {
          success: false,
          message: "That code didn't match. Check it and try again.",
          new_email: null,
        },
      ],
      error: null,
    },
  });

  const res = await handleAction(
    asAdmin(admin),
    'current-user-id',
    'old@example.com',
    { action: 'verify', code: '999999' }
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, 'INVALID_CODE');
  assert(!admin.calls.some((c) => c.method === 'auth.admin.updateUserById'));
});
