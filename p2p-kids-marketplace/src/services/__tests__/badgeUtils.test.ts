// filepath: p2p-kids-marketplace/src/services/__tests__/badgeUtils.test.ts

import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../config/supabase';
import {
  uploadBadgeIcon,
  getSignedBadgeIconUrl,
  deleteBadgeIcon,
  getPublicBadgeIconUrl,
} from '../badgeUtils';

// Mock dependencies
jest.mock('../../config/supabase');
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));
jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn((_base64) => new ArrayBuffer(8)),
}));

describe('badgeUtils', () => {
  const mockBadgeId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFileUri = 'file:///path/to/badge-icon.png';
  const mockStoragePath = `icons/${mockBadgeId}-1234567890.png`;
  const mockPublicUrl = `https://example.com/storage/v1/object/public/badge-icons/${mockStoragePath}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadBadgeIcon', () => {
    it('should upload badge icon successfully', async () => {
      // Mock FileSystem.readAsStringAsync
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');

      // Mock storage upload
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: mockStoragePath },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      const mockUpdate = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as any);

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: mockUpdate,
        }),
      } as any);

      // Execute
      const result = await uploadBadgeIcon(mockBadgeId, mockFileUri);

      // Verify
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(mockFileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      expect(mockUpload).toHaveBeenCalled();
      expect(mockGetPublicUrl).toHaveBeenCalledWith(mockStoragePath);
      expect(result).toEqual({
        url: mockPublicUrl,
        path: mockStoragePath,
        error: null,
      });
    });

    it('should handle upload errors', async () => {
      // Mock FileSystem.readAsStringAsync
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');

      const uploadError = new Error('Upload failed');
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: uploadError,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      } as any);

      // Execute
      const result = await uploadBadgeIcon(mockBadgeId, mockFileUri);

      // Verify
      expect(result).toEqual({
        url: null,
        path: null,
        error: uploadError,
      });
    });

    it('should handle badge update errors', async () => {
      // Mock successful upload but failed update
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: mockStoragePath },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      const updateError = new Error('Update failed');
      const mockUpdate = jest.fn().mockResolvedValue({
        data: null,
        error: updateError,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      } as any);

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: mockUpdate,
        }),
      } as any);

      // Execute
      const result = await uploadBadgeIcon(mockBadgeId, mockFileUri);

      // Verify
      expect(result).toEqual({
        url: null,
        path: null,
        error: updateError,
      });
    });
  });

  describe('getSignedBadgeIconUrl', () => {
    it('should generate signed URL successfully', async () => {
      const mockSignedUrl = 'https://example.com/signed-url?token=abc123';
      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      } as any);

      // Execute
      const result = await getSignedBadgeIconUrl(mockStoragePath, 7200);

      // Verify
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(mockStoragePath, 7200);
      expect(result).toBe(mockSignedUrl);
    });

    it('should handle signed URL errors', async () => {
      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Signed URL failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      } as any);

      // Execute
      const result = await getSignedBadgeIconUrl(mockStoragePath);

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('deleteBadgeIcon', () => {
    it('should delete badge icon successfully', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      } as any);

      // Execute
      const result = await deleteBadgeIcon(mockStoragePath);

      // Verify
      expect(mockRemove).toHaveBeenCalledWith([mockStoragePath]);
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Delete failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      } as any);

      // Execute
      const result = await deleteBadgeIcon(mockStoragePath);

      // Verify
      expect(result).toBe(false);
    });
  });

  describe('getPublicBadgeIconUrl', () => {
    it('should generate public URL', () => {
      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        getPublicUrl: mockGetPublicUrl,
      } as any);

      // Execute
      const result = getPublicBadgeIconUrl(mockStoragePath);

      // Verify
      expect(mockGetPublicUrl).toHaveBeenCalledWith(mockStoragePath);
      expect(result).toBe(mockPublicUrl);
    });
  });
});
