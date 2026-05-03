// File: p2p-kids-marketplace/src/services/__tests__/profileService.test.ts
// AUTH-V3-005: ProfileService Unit Tests

import { autoFillProfile, downloadProviderAvatar, ProviderProfile } from '../profileService';
import { supabase } from '../supabase/client';
import * as ImageManipulator from 'expo-image-manipulator';

// Mock dependencies
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  onloadend: null,
  onerror: null,
  result: null,
})) as any;

describe('ProfileService — autoFillProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should auto-fill name when profile is empty', async () => {
    const mockUser = { id: 'user-123' };
    const mockProfile: ProviderProfile = { name: 'John Doe', provider: 'google' };

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null, // No existing profile
      error: null,
    });

    const mockUpsert = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    });

    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-123',
        name: 'John Doe',
        auto_filled_from_provider: true,
      },
      { onConflict: 'user_id' }
    );
  });

  test('should NOT overwrite existing name', async () => {
    const mockUser = { id: 'user-123' };
    const mockProfile: ProviderProfile = { name: 'New Name', provider: 'google' };

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { name: 'Existing Name' },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(1); // Only SELECT, no UPSERT
  });

  test('should skip gracefully when no name provided (Apple)', async () => {
    const mockProfile: ProviderProfile = { provider: 'apple' }; // No name

    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('should return error when not authenticated', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const mockProfile: ProviderProfile = { name: 'John Doe' };
    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  test('should handle upsert errors gracefully', async () => {
    const mockUser = { id: 'user-123' };
    const mockProfile: ProviderProfile = { name: 'John Doe' };

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const mockUpsert = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    });

    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });

  test('should fallback to base payload when auto_filled_from_provider column is missing', async () => {
    const mockUser = { id: 'user-123' };
    const mockProfile: ProviderProfile = { name: 'John Doe' };

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

    const mockUpsert = jest
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column "auto_filled_from_provider" does not exist' },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    });

    const result = await autoFillProfile(mockProfile);

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenNthCalledWith(
      1,
      {
        user_id: 'user-123',
        name: 'John Doe',
        auto_filled_from_provider: true,
      },
      { onConflict: 'user_id' }
    );
    expect(mockUpsert).toHaveBeenNthCalledWith(
      2,
      {
        user_id: 'user-123',
        name: 'John Doe',
      },
      { onConflict: 'user_id' }
    );
  });
});

describe('ProfileService — downloadProviderAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return null when no URL provided (Apple)', async () => {
    const result = await downloadProviderAvatar(undefined, 'user-123');

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should download, validate, and upload avatar successfully', async () => {
    const mockUrl = 'https://example.com/avatar.jpg';
    const mockUserId = 'user-123';
    const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });

    // Mock fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/jpeg;base64,fakebase64';
        this.onloadend();
      }),
      onloadend: null as any,
      onerror: null as any,
      result: null,
    };
    (global.FileReader as any).mockImplementation(() => mockFileReader);

    // Mock ImageManipulator
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://fake.jpg',
      width: 200,
      height: 200,
    });

    // Mock Supabase Storage
    const mockUpload = jest.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/user-123/social_avatar.jpg' },
    });

    (supabase.storage.from as jest.Mock).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const result = await downloadProviderAvatar(mockUrl, mockUserId);

    expect(fetch).toHaveBeenCalledWith(mockUrl, expect.any(Object));
    expect(result).toBe('https://storage.example.com/user-123/social_avatar.jpg');
  });

  test('should return null on fetch timeout', async () => {
    const mockUrl = 'https://example.com/slow-avatar.jpg';

    // Mock fetch with abort
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Aborted'), { name: 'AbortError' })
    );

    const result = await downloadProviderAvatar(mockUrl, 'user-123');

    expect(result).toBeNull();
  });

  test('should return null on invalid content-type', async () => {
    const mockUrl = 'https://example.com/avatar.txt';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/plain']]),
    });

    const result = await downloadProviderAvatar(mockUrl, 'user-123');

    expect(result).toBeNull();
  });

  test('should return null when image is too large (> 2 MB)', async () => {
    const mockUrl = 'https://example.com/large-avatar.jpg';
    const largeBlob = new Blob([new ArrayBuffer(3 * 1024 * 1024)], { type: 'image/jpeg' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      blob: jest.fn().mockResolvedValue(largeBlob),
    });

    const result = await downloadProviderAvatar(mockUrl, 'user-123');

    expect(result).toBeNull();
  });

  test('should return null when image dimensions are too small (< 100×100)', async () => {
    const mockUrl = 'https://example.com/small-avatar.jpg';
    const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const mockFileReader = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/jpeg;base64,fakebase64';
        this.onloadend();
      }),
      onloadend: null as any,
      onerror: null as any,
      result: null,
    };
    (global.FileReader as any).mockImplementation(() => mockFileReader);

    // Mock ImageManipulator with small dimensions
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://fake.jpg',
      width: 50, // Too small
      height: 50,
    });

    const result = await downloadProviderAvatar(mockUrl, 'user-123');

    expect(result).toBeNull();
  });

  test('should return null on upload error', async () => {
    const mockUrl = 'https://example.com/avatar.jpg';
    const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const mockFileReader = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/jpeg;base64,fakebase64';
        this.onloadend();
      }),
      onloadend: null as any,
      onerror: null as any,
      result: null,
    };
    (global.FileReader as any).mockImplementation(() => mockFileReader);

    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://fake.jpg',
      width: 200,
      height: 200,
    });

    // Mock upload error
    const mockUpload = jest.fn().mockResolvedValue({
      error: { message: 'Storage error' },
    });

    (supabase.storage.from as jest.Mock).mockReturnValue({
      upload: mockUpload,
    });

    const result = await downloadProviderAvatar(mockUrl, 'user-123');

    expect(result).toBeNull();
  });
});
