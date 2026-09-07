// File: src/services/__tests__/oauthProviderStatus.test.ts
// Unit tests for oauthProviderStatus — the GoTrue /auth/v1/settings provider
// pre-check (FIX-Task-3, QA Task 43d Item 1).
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN

import { getEnabledOAuthProviders } from '../oauthProviderStatus';

const REAL_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

const mockJson = jest.fn();
const mockFetch = jest.fn();

// eslint-disable-next-line no-undef
global.fetch = mockFetch as any;

function mockOkResponse(external: Record<string, boolean>) {
  mockJson.mockResolvedValue({ external });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: mockJson,
  } as any);
}

function mockErrorResponse(status: number) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
  } as any);
}

describe('getEnabledOAuthProviders (FIX-Task-3 Item 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mockproject.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterAll(() => {
    if (REAL_SUPABASE_URL === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = REAL_SUPABASE_URL;
    }
  });

  it('returns only the app providers that are enabled in the auth config', async () => {
    mockOkResponse({ apple: false, google: true, facebook: true, github: true });

    const result = await getEnabledOAuthProviders(true);

    expect(result).toEqual(['google', 'facebook']);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://mockproject.supabase.co/auth/v1/settings',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
        }),
      })
    );
  });

  it('returns an empty array when every app provider is disabled', async () => {
    mockOkResponse({ apple: false, google: false, facebook: false });

    const result = await getEnabledOAuthProviders(true);

    expect(result).toEqual([]);
  });

  it('fails OPEN (null) on a non-OK response so the real OAuth initiation still runs', async () => {
    mockErrorResponse(500);

    const result = await getEnabledOAuthProviders(true);

    expect(result).toBeNull();
  });

  it('fails OPEN (null) when the network call throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    const result = await getEnabledOAuthProviders(true);

    expect(result).toBeNull();
  });

  it('fails OPEN (null) when the Supabase URL env is missing', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    mockFetch.mockClear();

    const result = await getEnabledOAuthProviders(true);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('serves a cached result within the TTL without re-hitting the endpoint', async () => {
    mockOkResponse({ apple: false, google: true, facebook: true });
    await getEnabledOAuthProviders(true); // populate the cache
    mockFetch.mockClear();

    const cached = await getEnabledOAuthProviders(); // should be a cache hit

    expect(cached).toEqual(['google', 'facebook']);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('bypasses the cache when forceRefresh is passed', async () => {
    mockOkResponse({ apple: false, google: true, facebook: true });
    mockFetch.mockClear();

    await getEnabledOAuthProviders(true);
    await getEnabledOAuthProviders(true);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
