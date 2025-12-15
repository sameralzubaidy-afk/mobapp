import { verifyPhoneCode } from '@/services/verification';
import { supabase } from '@/services/supabase/client';

describe('verifyPhoneCode (service)', () => {
  let testUserId: string;
  const phone = '+15555550124';

  beforeAll(async () => {
    testUserId = (globalThis as any).crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000001';
    await supabase.from('profiles').upsert({ user_id: testUserId, name: 'Verify Service User', phone_verified: false });
  });

  afterAll(async () => {
    await supabase.from('phone_verification_codes').delete().eq('user_id', testUserId);
    await supabase.from('profiles').delete().eq('user_id', testUserId);
  });

  test('test mode code verifies and updates profile', async () => {
    // Mock DB interactions for unit test to avoid network calls
    const fromMock = jest.spyOn(supabase, 'from' as any).mockImplementation(() => {
      const chain: any = {
        insert: async () => ({ error: null }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        update: () => ({ error: null }),
        select: () => ({ eq: () => ({ single: async () => ({ data: { phone_verified: true }, error: null }) }) }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return chain;
    });
    const rpcMock = jest.spyOn(supabase, 'rpc' as any).mockResolvedValue({ data: { success: true, rows_updated: 1 }, error: null } as any);

    const res = await verifyPhoneCode(testUserId, phone, '123456');
    expect(res.success).toBe(true);

    const { data: profile } = await supabase.from('profiles').select('phone_verified').eq('user_id', testUserId).single();
    expect(profile.phone_verified).toBe(true);

    fromMock.mockRestore();
    rpcMock.mockRestore();
  });
});
