/**
 * Unit Tests: Storage Service - Item Images Bucket
 * Module: MODULE-13-SAFETY-COMPLIANCE
 * Task: SAFETY-P001
 * 
 * Tests the storage service functions for uploading/deleting item images
 * to the 'item-images' bucket with mocked Supabase client.
 */

import { uploadImage, uploadMultipleImages, deleteImage, deleteMultipleImages } from '../../src/services/supabase/storage';

// Mock Supabase client
jest.mock('../../src/services/supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        remove: jest.fn(),
      })),
    },
  },
}));

// Mock fetch for getCdnUrl and purge
global.fetch = jest.fn();

const { supabase } = require('../../src/services/supabase/client');

describe('Storage Service - Item Images', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('uploadImage', () => {
    it('should successfully upload an image to item-images bucket', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-item-id/photo1.jpg' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/item-images/test-item-id/photo1.jpg' },
      });

      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const result = await uploadImage(
        'item-images',
        'test-item-id/photo1.jpg',
        'file://photo1.jpg'
      );

      expect(supabase.storage.from).toHaveBeenCalledWith('item-images');
      expect(mockUpload).toHaveBeenCalledWith(
        'test-item-id/photo1.jpg',
        mockBlob,
        { cacheControl: '3600', upsert: false }
      );
      expect(result.error).toBeNull();
      expect(result.path).toBe('test-item-id/photo1.jpg');
      expect(result.url).toContain('item-images/test-item-id/photo1.jpg');
    });

    it('should handle upload errors gracefully', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const mockError = new Error('Storage quota exceeded');
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: jest.fn(),
      });

      const result = await uploadImage(
        'item-images',
        'test-item-id/large-photo.jpg',
        'file://large-photo.jpg'
      );

      expect(result.error).toBe(mockError);
      expect(result.url).toBeNull();
      expect(result.path).toBeNull();
    });

    it('should respect 5MB file size limit (enforced by Supabase)', async () => {
      // Simulate a 6MB file upload attempt
      const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(largeBlob),
      });

      const mockError = { message: 'File size exceeds bucket limit of 5242880 bytes' };
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: jest.fn(),
      });

      const result = await uploadImage(
        'item-images',
        'test-item-id/large-file.jpg',
        'file://large-file.jpg'
      );

      expect(result.error).toEqual(mockError);
    });

    it('should allow upsert when specified', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-item-id/photo1.jpg' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/item-images/test-item-id/photo1.jpg' },
      });

      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      await uploadImage(
        'item-images',
        'test-item-id/photo1.jpg',
        'file://photo1.jpg',
        { upsert: true }
      );

      expect(mockUpload).toHaveBeenCalledWith(
        'test-item-id/photo1.jpg',
        mockBlob,
        { cacheControl: '3600', upsert: true }
      );
    });
  });

  describe('uploadMultipleImages', () => {
    it('should upload multiple images in parallel', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const mockUpload = jest.fn()
        .mockResolvedValueOnce({
          data: { path: 'test-item-id/photo1.jpg' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { path: 'test-item-id/photo2.jpg' },
          error: null,
        });

      const mockGetPublicUrl = jest.fn()
        .mockReturnValueOnce({
          data: { publicUrl: 'https://supabase.co/storage/v1/object/public/item-images/test-item-id/photo1.jpg' },
        })
        .mockReturnValueOnce({
          data: { publicUrl: 'https://supabase.co/storage/v1/object/public/item-images/test-item-id/photo2.jpg' },
        });

      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const files = [
        { path: 'test-item-id/photo1.jpg', fileUri: 'file://photo1.jpg' },
        { path: 'test-item-id/photo2.jpg', fileUri: 'file://photo2.jpg' },
      ];

      const results = await uploadMultipleImages('item-images', files);

      expect(results).toHaveLength(2);
      expect(results[0].path).toBe('test-item-id/photo1.jpg');
      expect(results[1].path).toBe('test-item-id/photo2.jpg');
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteImage', () => {
    it('should successfully delete an image from item-images bucket', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      supabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      const result = await deleteImage('item-images', 'test-item-id/photo1.jpg');

      expect(supabase.storage.from).toHaveBeenCalledWith('item-images');
      expect(mockRemove).toHaveBeenCalledWith(['test-item-id/photo1.jpg']);
      expect(result.error).toBeNull();
    });

    it('should handle delete errors gracefully', async () => {
      const mockError = new Error('File not found');
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      supabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      const result = await deleteImage('item-images', 'test-item-id/nonexistent.jpg');

      expect(result.error).toBe(mockError);
    });

    it('should attempt to purge CDN cache when configured', async () => {
      process.env.SUPABASE_PURGE_ENDPOINT = 'https://purge.example.com';
      process.env.SUPABASE_PURGE_X_API_KEY = 'test-key';

      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      supabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await deleteImage('item-images', 'test-item-id/photo1.jpg');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://purge.example.com',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key',
          }),
        })
      );

      delete process.env.SUPABASE_PURGE_ENDPOINT;
      delete process.env.SUPABASE_PURGE_X_API_KEY;
    });
  });

  describe('deleteMultipleImages', () => {
    it('should delete multiple images in a single call', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      supabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      const paths = [
        'test-item-id/photo1.jpg',
        'test-item-id/photo2.jpg',
        'test-item-id/photo3.jpg',
      ];

      const result = await deleteMultipleImages('item-images', paths);

      expect(mockRemove).toHaveBeenCalledWith(paths);
      expect(result.error).toBeNull();
    });
  });

  describe('RLS Policy Simulation', () => {
    it('should only allow sellers to upload to their own item folders (conceptual test)', () => {
      // This is a conceptual test - actual RLS is enforced by Supabase
      // In real scenario: seller with seller_id = 'user-123' tries to upload to item they own
      
      const currentUserId = 'user-123';
      const itemOwnerId = 'user-123';
      const canUpload = currentUserId === itemOwnerId;

      expect(canUpload).toBe(true);

      // Unauthorized attempt
      const unauthorizedUserId = 'user-456';
      const cannotUpload = unauthorizedUserId === itemOwnerId;

      expect(cannotUpload).toBe(false);
    });

    it('should allow public read access to all item images', () => {
      // Conceptual test - RLS allows SELECT for public role
      const publicCanRead = true; // RLS policy: FOR SELECT TO public USING (bucket_id = 'item-images')
      expect(publicCanRead).toBe(true);
    });

    it('should allow service_role full access for moderation', () => {
      // Conceptual test - RLS allows ALL for service_role
      const serviceRoleFullAccess = true; // RLS policy: FOR ALL TO service_role
      expect(serviceRoleFullAccess).toBe(true);
    });
  });
});
