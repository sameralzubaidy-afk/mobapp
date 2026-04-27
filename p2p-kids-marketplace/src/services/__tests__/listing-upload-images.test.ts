import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uploadListingImages } from '../listing';
import { supabase } from '../../config/supabase';
import { uploadImage, deleteImage } from '../supabase/storage';

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

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockDeleteImage = deleteImage as jest.MockedFunction<typeof deleteImage>;

describe('uploadListingImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

    await expect(uploadListingImages('listing-1', 'seller-1', ['file:///photo.jpg'])).rejects.toThrow(
      'Failed to save image 1 reference: insert failed'
    );

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
});
