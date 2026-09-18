import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uploadListingImages } from '../listing';
import { supabase } from '../../config/supabase';
import { uploadImage, deleteImage } from '../supabase/storage';
import { getLocalImageSizeBytes } from '../../utils/localImageFileSize';
import { PhotoAsset } from '../../types/listing';

jest.mock('../../config/supabase');
jest.mock('../subscription', () => ({
  getSubscriptionSummary: jest.fn(),
  getSubscriptionStatusString: jest.fn(),
}));
jest.mock('../analytics', () => ({
  trackEvent: jest.fn(),
}));
jest.mock('../supabase/storage', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));
// The on-disk size probe is a native call — stub it so the publish-path contract
// tests are deterministic on any platform/CI machine.
jest.mock('../../utils/localImageFileSize', () => ({
  getLocalImageSizeBytes: jest.fn(),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockDeleteImage = deleteImage as jest.MockedFunction<typeof deleteImage>;
const mockGetLocalImageSizeBytes = getLocalImageSizeBytes as jest.MockedFunction<
  typeof getLocalImageSizeBytes
>;

describe('uploadListingImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: the size probe cannot resolve a size. That is the "unknown" case,
    // which must NOT by itself reject anything — it mirrors the pre-FIX-Task-61
    // behaviour for these legacy URI-string callers.
    mockGetLocalImageSizeBytes.mockResolvedValue(null);

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'admin_config') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { value: false },
                error: null,
              }),
            }),
          }),
        } as any;
      }

      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'img-1' },
              error: null,
            }),
          }),
        }),
      } as any;
    });

    mockSupabase.functions = {
      invoke: jest.fn().mockResolvedValue({
        data: {
          success: true,
          decision: 'approved',
          flagged: false,
          categories: [],
          confidence: 0.1,
        },
        error: null,
      }),
    } as any;
  });

  it('uploads successfully using preferred seller/listing path', async () => {
    mockUploadImage.mockResolvedValue({
      url: 'https://example.com/item-images/seller-1/listing-1/0.jpg',
      path: 'seller-1/listing-1/0.jpg',
      error: null,
    });

    const result = await uploadListingImages('listing-1', 'seller-1', ['file:///photo.jpg']);

    expect(mockUploadImage).toHaveBeenCalledTimes(1);
    expect(mockUploadImage).toHaveBeenCalledWith(
      'item-images',
      'seller-1/listing-1/0.jpg',
      'file:///photo.jpg',
      { upsert: true }
    );
    expect(result).toEqual([
      {
        url: 'https://example.com/item-images/seller-1/listing-1/0.jpg',
        display_order: 0,
      },
    ]);
  });

  it('falls back to legacy listing-only path when preferred path is blocked by RLS', async () => {
    const rlsError = new Error('new row violates row-level security policy');
    rlsError.name = 'StorageApiError';

    mockUploadImage
      .mockResolvedValueOnce({
        url: null,
        path: null,
        error: rlsError,
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/item-images/listing-1/0.jpg',
        path: 'listing-1/0.jpg',
        error: null,
      });

    const result = await uploadListingImages('listing-1', 'seller-1', ['file:///photo.jpg']);

    expect(mockUploadImage).toHaveBeenCalledTimes(2);
    expect(mockUploadImage).toHaveBeenNthCalledWith(
      1,
      'item-images',
      'seller-1/listing-1/0.jpg',
      'file:///photo.jpg',
      { upsert: true }
    );
    expect(mockUploadImage).toHaveBeenNthCalledWith(
      2,
      'item-images',
      'listing-1/0.jpg',
      'file:///photo.jpg',
      { upsert: true }
    );
    expect(result).toEqual([
      {
        url: 'https://example.com/item-images/listing-1/0.jpg',
        display_order: 0,
      },
    ]);
  });

  it('cleans up using the actual uploaded path when DB insert fails after fallback upload', async () => {
    const rlsError = new Error('new row violates row-level security policy');
    rlsError.name = 'StorageApiError';

    mockUploadImage
      .mockResolvedValueOnce({
        url: null,
        path: null,
        error: rlsError,
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/item-images/listing-1/0.jpg',
        path: 'listing-1/0.jpg',
        error: null,
      });

    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'admin_config') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { value: false },
                error: null,
              }),
            }),
          }),
        } as any;
      }

      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'insert failed' },
            }),
          }),
        }),
      } as any;
    });

    mockDeleteImage.mockResolvedValue({ error: null });

    await expect(
      uploadListingImages('listing-1', 'seller-1', ['file:///photo.jpg'])
    ).rejects.toThrow('Failed to save image 1 reference: insert failed');

    expect(mockDeleteImage).toHaveBeenCalledWith('item-images', 'listing-1/0.jpg');
  });

  it('reuses existing remote URLs without re-uploading', async () => {
    const remoteUrl =
      'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/drafts/seller-1/123/photo_0.jpg';

    const result = await uploadListingImages('listing-1', 'seller-1', [remoteUrl]);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        url: remoteUrl,
        display_order: 0,
      },
    ]);
  });

  // ── FIX-Task-61 item 2: the publish path used to validate NOTHING but the image
  //    count, so an oversize / wrong-type photo that reached the strip through any
  //    route could be published and only failed at the Storage bucket. These tests
  //    prove the contract is now enforced here, before any upload or DB write.
  describe('publish-path size/MIME contract', () => {
    const OVERSIZE_BYTES = 11 * 1024 * 1024; // > the 10MB cap

    it('rejects an oversize photo from its asset metadata BEFORE any upload', async () => {
      const photos: PhotoAsset[] = [
        {
          id: 'p1',
          uri: 'file:///tmp/huge.png',
          width: 2500,
          height: 2500,
          fileSize: OVERSIZE_BYTES,
          mimeType: 'image/png',
        },
      ];

      await expect(uploadListingImages('listing-1', 'seller-1', photos)).rejects.toThrow(
        "Photo 1 can't be uploaded: Image must be smaller than 10MB"
      );

      expect(mockUploadImage).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalledWith('item_images');
    });

    it('rejects an unsupported file type derived from the URI BEFORE any upload', async () => {
      await expect(
        uploadListingImages('listing-1', 'seller-1', ['file:///tmp/animation.gif'])
      ).rejects.toThrow(
        "Photo 1 can't be uploaded: Only JPEG, PNG, WebP, and HEIC images are supported"
      );

      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('rejects an oversize file measured from disk when the caller has no metadata', async () => {
      mockGetLocalImageSizeBytes.mockResolvedValue(OVERSIZE_BYTES);

      await expect(
        uploadListingImages('listing-1', 'seller-1', ['file:///tmp/huge.jpg'])
      ).rejects.toThrow("Photo 1 can't be uploaded: Image must be smaller than 10MB");

      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('names the offending position and still uploads nothing when a LATER photo is invalid', async () => {
      const photos: PhotoAsset[] = [
        {
          id: 'p1',
          uri: 'file:///tmp/ok.jpg',
          width: 800,
          height: 800,
          fileSize: 1000,
          mimeType: 'image/jpeg',
        },
        {
          id: 'p2',
          uri: 'file:///tmp/bad.gif',
          width: 800,
          height: 800,
          fileSize: 1000,
          mimeType: 'image/gif',
        },
      ];

      await expect(uploadListingImages('listing-1', 'seller-1', photos)).rejects.toThrow(
        /^Photo 2 can't be uploaded:/
      );

      // Fail-fast: the VALID first photo must not have been uploaded either, so a
      // rejection can never leave a half-uploaded listing behind.
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('positive control: a valid photo still uploads normally', async () => {
      mockUploadImage.mockResolvedValue({
        url: 'https://example.com/item-images/seller-1/listing-1/0.jpg',
        path: 'seller-1/listing-1/0.jpg',
        error: null,
      });

      const photos: PhotoAsset[] = [
        {
          id: 'p1',
          uri: 'file:///tmp/ok.jpg',
          width: 800,
          height: 800,
          fileSize: 1000,
          mimeType: 'image/jpeg',
        },
      ];

      const result = await uploadListingImages('listing-1', 'seller-1', photos);

      expect(mockUploadImage).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
