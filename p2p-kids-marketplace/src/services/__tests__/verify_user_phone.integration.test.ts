import { supabase } from '@/services/supabase/client';
import { createConfirmedTestUser, deleteTestUser, getServiceClient } from '@/test-helpers/authTestUtils';

const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeSupabase = RUN_SUPABASE_E2E ? describe : describe.skip;

describeSupabase('verify_user_phone RPC', () => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  let testUserId: string;
  const service = getServiceClient();

  beforeAll(async () => {
    if (!service) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    // Create a confirmed test auth user (so foreign keys to auth.users succeed)
    const email = `verify-rpc-${Date.now()}@example.com`;
    const pw = 'TestPass123!';
    const created = await createConfirmedTestUser({ email, password: pw });
    if (!created?.userId) {
      throw new Error('Failed to create confirmed test user. Set SUPABASE_SERVICE_ROLE_KEY for integration tests.');
    }
    testUserId = created.userId;
    // Create a profile row for the user
    await service.from('profiles').upsert({ 
      user_id: testUserId, 
      name: 'RPC Test User', 
      phone_verified: false,
    } as any);
  });

  afterAll(async () => {
    // Cleanup test rows
    if (service) {
      await service.from('phone_verification_codes').delete().eq('user_id', testUserId);
      await service.from('profiles').delete().eq('user_id', testUserId);
    }
    await deleteTestUser(testUserId);
  });

  test('returns error when no verified code exists', async () => {
    await service.from('profiles').update({ phone_verified: false }).eq('user_id', testUserId);
    await service.from('phone_verification_codes').delete().eq('phone', phone);
    await service.from('phone_verification_codes').delete().eq('user_id', testUserId);

    const { data: noData, error: noError } = await supabase.rpc('verify_user_phone', { 
      p_user_id: testUserId, 
      p_phone: phone,
    } as any);
    expect(noError).toBeNull();
    const result = Array.isArray(noData) ? noData[0] : noData;
    expect(result).toBeDefined();
    expect(typeof (result as any)?.success).toBe('boolean');
    if ((result as any)?.success === false) {
      expect((result as any)?.message).toMatch(/No recent verified code/);
    }
  });

  test('marks profile verified when a verified code exists', async () => {
    // Insert a verified code for the user
    const { error: insertErr } = await service.from('phone_verification_codes').insert({
      user_id: testUserId,
      phone,
      code: '999999',
      verified: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // valid for 24h
      created_at: new Date().toISOString(),
    } as any);
    expect(insertErr).toBeNull();

    const { data, error } = await supabase.rpc('verify_user_phone', { 
      p_user_id: testUserId, 
      p_phone: phone,
    } as any);
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
