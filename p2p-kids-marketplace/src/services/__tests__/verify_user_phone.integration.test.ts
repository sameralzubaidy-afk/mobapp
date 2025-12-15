import { supabase } from '@/services/supabase/client';

describe('verify_user_phone RPC', () => {
  const phone = '+15555550123';
  let testUserId: string;

  beforeAll(async () => {
    // Create a test auth user (so foreign keys to auth.users succeed)
    const email = `verify-rpc-${Date.now()}@example.com`;
    const pw = 'TestPass123!';
    const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password: pw });
    if (signErr) throw signErr;
    // Use returned user id or fallback to a generated uuid
    testUserId = (signData as any)?.user?.id || (globalThis as any).crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000000';
    // Create a profile row for the user
    await supabase.from('profiles').upsert({ user_id: testUserId, name: 'RPC Test User', phone_verified: false });
  });

  afterAll(async () => {
    // Cleanup test rows
    await supabase.from('phone_verification_codes').delete().eq('user_id', testUserId);
    await supabase.from('profiles').delete().eq('user_id', testUserId);
    // Note: auth.users cleanup requires service role and is left as-is for staging tests
  });

  test('returns error when no verified code exists', async () => {
    const { data: noData, error: noError } = await supabase.rpc('verify_user_phone', { p_user_id: testUserId, p_phone: phone });
    expect(noError).toBeNull();
    const result = Array.isArray(noData) ? noData[0] : noData;
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No recent verified code/);
  });

  test('marks profile verified when a verified code exists', async () => {
    // Insert a verified code for the user
    const { error: insertErr } = await supabase.from('phone_verification_codes').insert({
      user_id: testUserId,
      phone,
      code: '999999',
      verified: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // valid for 24h
      created_at: new Date().toISOString(),
    });
    expect(insertErr).toBeNull();

    const { data, error } = await supabase.rpc('verify_user_phone', { p_user_id: testUserId, p_phone: phone });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Check profile updated
    const { data: profile, error: profileErr } = await supabase.from('profiles').select('phone_verified').eq('user_id', testUserId).single();
    expect(profileErr).toBeNull();
    expect(profile.phone_verified).toBe(true);
  });
});
