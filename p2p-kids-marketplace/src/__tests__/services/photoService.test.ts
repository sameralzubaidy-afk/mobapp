/**
 * Unit tests for photoService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests photo validation, compression, upload, grouping, and regrouping logic
 */

import * as photoService from '../../services/photoService';
import { PhotoAsset } from '../../types/listing';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../config/supabase';

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(),
      select: jest.fn(),
    })),
  },
}));

describe('photoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue('blob-data'),
    });
  });

  afterEach(() => {
    (global as any).fetch = undefined;
  });

  describe('validatePhoto', () => {
    it('should accept valid JPEG photo', async () => {
      const asset: PhotoAsset = {
        id: '1',
        uri: 'file://test.jpg',
        width: 800,
        height: 600,
        fileSize: 2 * 1024 * 1024, // 2MB
        mimeType: 'image/jpeg',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid PNG photo', async () => {
      const asset: PhotoAsset = {
        id: '2',
        uri: 'file://test.png',
        width: 1000,
        height: 1000,
        fileSize: 3 * 1024 * 1024,
        mimeType: 'image/png',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP photo', async () => {
      const asset: PhotoAsset = {
        id: '3',
        uri: 'file://test.webp',
        width: 600,
        height: 600,
        mimeType: 'image/webp',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid HEIC photo', async () => {
      const asset: PhotoAsset = {
        id: '3b',
        uri: 'file://test.heic',
        width: 1200,
        height: 900,
        fileSize: 2 * 1024 * 1024,
        mimeType: 'image/heic',
      };

      const result = await photoService.validatePhoto(asset);

      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file type', async () => {
      const asset: PhotoAsset = {
        id: '4',
        uri: 'file://test.gif',
        width: 800,
        height: 600,
        mimeType: 'image/gif',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JPEG, PNG, WebP, and HEIC');
    });

    it('should reject file larger than 10MB', async () => {
      const asset: PhotoAsset = {
        id: '5',
        uri: 'file://large.jpg',
        width: 800,
        height: 600,
        fileSize: 11 * 1024 * 1024, // 11MB
        mimeType: 'image/jpeg',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should reject photo with width < 400px', async () => {
      const asset: PhotoAsset = {
        id: '6',
        uri: 'file://small.jpg',
        width: 300,
        height: 600,
        mimeType: 'image/jpeg',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('400×400');
    });

    it('should reject photo with height < 400px', async () => {
      const asset: PhotoAsset = {
        id: '7',
        uri: 'file://small.jpg',
        width: 800,
        height: 300,
        mimeType: 'image/jpeg',
      };

      const result = await photoService.validatePhoto(asset);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('400×400');
    });
  });

  describe('compressPhoto', () => {
    it('should compress photo using expo-image-manipulator', async () => {
      const mockCompressed = { uri: 'file://compressed.jpg' };
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(mockCompressed);

      const result = await photoService.compressPhoto('file://test.jpg', 0.8);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://test.jpg',
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      expect(result).toBe(mockCompressed.uri);
    });

    it('should use default quality of 0.8', async () => {
      const mockCompressed = { uri: 'file://compressed.jpg' };
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(mockCompressed);

      await photoService.compressPhoto('file://test.jpg');
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ compress: 0.8 })
      );
    });

    it('should throw error on compression failure', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(
        new Error('Compression failed')
      );

      await expect(photoService.compressPhoto('file://test.jpg')).rejects.toThrow(
        'Failed to compress photo'
      );
    });
  });

  describe('groupPhotosAuto', () => {
    const createMockPhotos = (count: number): PhotoAsset[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `photo-${i}`,
        uri: `file://photo-${i}.jpg`,
        width: 800,
        height: 600,
      }));
    };

    it('should group photos with 1 per group by default', () => {
      const photos = createMockPhotos(6);
      const groups = photoService.groupPhotosAuto(photos);
      
      expect(groups).toHaveLength(6);
      expect(groups[0].photos).toHaveLength(1);
      expect(groups[1].photos).toHaveLength(1);
      expect(groups[2].photos).toHaveLength(1);
    });

    it('should respect custom photos per group', () => {
      const photos = createMockPhotos(9);
      const groups = photoService.groupPhotosAuto(photos, 3);
      
      expect(groups).toHaveLength(3);
      expect(groups[0].photos).toHaveLength(3);
      expect(groups[1].photos).toHaveLength(3);
      expect(groups[2].photos).toHaveLength(3);
    });

    it('should enforce 30 total photo cap', () => {
      const photos = createMockPhotos(35);
      const groups = photoService.groupPhotosAuto(photos);
      
      const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
      expect(totalPhotos).toBeLessThanOrEqual(30);
    });

    it('should enforce 15 group cap without dropping photos', () => {
      const photos = createMockPhotos(30);
      const groups = photoService.groupPhotosAuto(photos, 1); // 1 photo per group

      expect(groups.length).toBe(15);
      const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
      expect(totalPhotos).toBe(30);
      groups.forEach((group) => {
        expect(group.photos.length).toBe(2);
      });
    });

    it('should keep max item count while preserving all photos for 16-photo input', () => {
      const photos = createMockPhotos(16);
      const groups = photoService.groupPhotosAuto(photos, 1);

      expect(groups).toHaveLength(15);
      const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
      expect(totalPhotos).toBe(16);

      const groupsWithTwoPhotos = groups.filter((group) => group.photos.length === 2);
      const groupsWithOnePhoto = groups.filter((group) => group.photos.length === 1);
      expect(groupsWithTwoPhotos).toHaveLength(1);
      expect(groupsWithOnePhoto).toHaveLength(14);
    });

    it('should enforce 10 photos per group cap', () => {
      const photos = createMockPhotos(20);
      const groups = photoService.groupPhotosAuto(photos, 15); // Try 15 per group
      
      groups.forEach(group => {
        expect(group.photos.length).toBeLessThanOrEqual(10);
      });
    });

    it('should set primaryPhotoIndex to 0', () => {
      const photos = createMockPhotos(4);
      const groups = photoService.groupPhotosAuto(photos);
      
      groups.forEach(group => {
        expect(group.primaryPhotoIndex).toBe(0);
      });
    });

    it('should generate stable groupIds', () => {
      const photos = createMockPhotos(4);
      const groups = photoService.groupPhotosAuto(photos);
      
      groups.forEach(group => {
        expect(group.groupId).toMatch(/^group_\d+_\d+$/);
      });
    });

    it('should handle empty photo array', () => {
      const groups = photoService.groupPhotosAuto([]);
      
      expect(groups).toEqual([]);
    });

    it('should handle partial last group', () => {
      const photos = createMockPhotos(5); // 2 per group = 2 groups + 1 leftover
      const groups = photoService.groupPhotosAuto(photos, 2);
      
      expect(groups).toHaveLength(3);
      expect(groups[2].photos).toHaveLength(1);
    });
  });

  describe('uploadPhotoBatch', () => {
    it('should upload draft photos under drafts/{seller_id}/ prefix', async () => {
      const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/item-images/drafts/seller-123/ts/photo.jpg' },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://compressed.jpg',
      });

      const photos: PhotoAsset[] = [
        {
          id: 'p1',
          uri: 'file://test.jpg',
          width: 1200,
          height: 900,
          fileSize: 1024 * 1024,
          mimeType: 'image/jpeg',
        },
      ];

      const result = await photoService.uploadPhotoBatch(photos, 'seller-123');

      expect(result.errors).toHaveLength(0);
      expect(result.urls).toHaveLength(1);
      expect(mockUpload).toHaveBeenCalledTimes(1);

      const uploadedPath = mockUpload.mock.calls[0][0] as string;
      const uploadOptions = mockUpload.mock.calls[0][2] as { contentType: string };
      expect(uploadedPath.startsWith('drafts/seller-123/')).toBe(true);
      expect(uploadedPath.endsWith('.jpg')).toBe(true);
      expect(uploadOptions.contentType).toBe('image/jpeg');
    });

    it('should upload HEIC source as JPEG', async () => {
      const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/item-images/drafts/seller-123/ts/photo.jpg' },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://compressed.jpg',
      });

      const photos: PhotoAsset[] = [
        {
          id: 'p-heic',
          uri: 'file://test.heic',
          width: 1200,
          height: 900,
          fileSize: 1024 * 1024,
          mimeType: 'image/heic',
        },
      ];

      const result = await photoService.uploadPhotoBatch(photos, 'seller-123');

      expect(result.errors).toHaveLength(0);
      expect(mockUpload).toHaveBeenCalledTimes(1);

      const uploadedPath = mockUpload.mock.calls[0][0] as string;
      const uploadOptions = mockUpload.mock.calls[0][2] as { contentType: string };
      expect(uploadedPath.endsWith('.jpg')).toBe(true);
      expect(uploadOptions.contentType).toBe('image/jpeg');
    });
  });

  describe('regroupPhotos', () => {
    const createGroups = () => {
      const photos1: PhotoAsset[] = [
        { id: '1', uri: 'file://photo-1.jpg', width: 800, height: 600 },
        { id: '2', uri: 'file://photo-2.jpg', width: 800, height: 600 },
      ];
      const photos2: PhotoAsset[] = [
        { id: '3', uri: 'file://photo-3.jpg', width: 800, height: 600 },
      ];

      return [
        { groupId: 'group-1', photos: photos1, primaryPhotoIndex: 0 },
        { groupId: 'group-2', photos: photos2, primaryPhotoIndex: 0 },
      ];
    };

    it('should move photo from source to target group', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'group-1',
        'file://photo-1.jpg',
        'group-2'
      );
      
      expect(updated[0].photos).toHaveLength(1);
      expect(updated[1].photos).toHaveLength(2);
      expect(updated[1].photos.some(p => p.uri === 'file://photo-1.jpg')).toBe(true);
    });

    it('should maintain intra-group order', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'group-1',
        'file://photo-1.jpg',
        'group-2'
      );
      
      // Photo should be added to end of target group
      expect(updated[1].photos[1].uri).toBe('file://photo-1.jpg');
    });

    it('should be immutable (not modify original)', () => {
      const groups = createGroups();
      const originalLength = groups[0].photos.length;
      
      photoService.regroupPhotos(groups, 'group-1', 'file://photo-1.jpg', 'group-2');
      
      expect(groups[0].photos).toHaveLength(originalLength);
    });

    it('should be no-op if photo already in target', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'group-1',
        'file://photo-1.jpg',
        'group-1'
      );
      
      expect(updated).toEqual(groups);
    });

    it('should be no-op if source group not found', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'invalid-group',
        'file://photo-1.jpg',
        'group-2'
      );
      
      expect(updated).toEqual(groups);
    });

    it('should be no-op if target group not found', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'group-1',
        'file://photo-1.jpg',
        'invalid-group'
      );
      
      expect(updated).toEqual(groups);
    });

    it('should be no-op if photo not found in source', () => {
      const groups = createGroups();
      const updated = photoService.regroupPhotos(
        groups,
        'group-1',
        'file://nonexistent.jpg',
        'group-2'
      );
      
      expect(updated).toEqual(groups);
    });

    it('should be no-op if target group is full (10 photos)', () => {
      const fullGroup = {
        groupId: 'group-full',
        photos: Array.from({ length: 10 }, (_, i) => ({
          id: `${i}`,
          uri: `file://photo-${i}.jpg`,
          width: 800,
          height: 600,
        })),
        primaryPhotoIndex: 0,
      };
      
      const sourceGroup = {
        groupId: 'group-source',
        photos: [{ id: 'x', uri: 'file://extra.jpg', width: 800, height: 600 }],
        primaryPhotoIndex: 0,
      };
      
      const groups = [sourceGroup, fullGroup];
      const updated = photoService.regroupPhotos(
        groups,
        'group-source',
        'file://extra.jpg',
        'group-full'
      );
      
      expect(updated).toEqual(groups);
    });
  });
});
