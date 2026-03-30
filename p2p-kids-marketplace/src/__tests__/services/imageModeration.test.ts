/// <reference types="jest" />

/**
 * Unit tests for imageModeration service (SAFETY-004)
 * Tests Google Vision API integration via moderate-image Edge Function
 */

import {
  isImageModerationEnabled,
  moderateListingImage,
  moderateListingImages,
} from '../../services/imageModeration';
import { supabase } from '../../config/supabase';

const mockSingle = jest.fn();

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

describe('imageModeration service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockReset();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  describe('isImageModerationEnabled', () => {
    it('returns true when config value is "true"', async () => {
      mockSingle.mockResolvedValue({
        data: { value: 'true' },
        error: null,
      });

      await expect(isImageModerationEnabled()).resolves.toBe(true);
    });

    it('returns false when config value is "false"', async () => {
      mockSingle.mockResolvedValue({
        data: { value: 'false' },
        error: null,
      });

      await expect(isImageModerationEnabled()).resolves.toBe(false);
    });

    it('defaults to true when config query returns error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(isImageModerationEnabled()).resolves.toBe(true);
    });

    it('defaults to true when config query throws', async () => {
      mockSingle.mockRejectedValue(new Error('network error'));

      await expect(isImageModerationEnabled()).resolves.toBe(true);
    });
  });

  describe('moderateListingImage', () => {
    it('should return approved decision for safe image', async () => {
      const mockResponse = {
        success: true,
        decision: 'approved' as const,
        flagged: false,
        categories: [],
        confidence: 0.1,
        details: {
          adult: 'VERY_UNLIKELY',
          violence: 'VERY_UNLIKELY',
          racy: 'UNLIKELY',
          medical: 'UNLIKELY',
          spoof: 'VERY_UNLIKELY',
        },
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await moderateListingImage('item-123', 'https://example.com/image.jpg');

      expect(mockInvoke).toHaveBeenCalledWith('moderate-image', {
        body: {
          itemId: 'item-123',
          imageUrl: 'https://example.com/image.jpg',
        },
      });

      expect(result.success).toBe(true);
      expect(result.decision).toBe('approved');
      expect(result.flagged).toBe(false);
      expect(result.confidence).toBe(0.1);
    });

    it('should return flagged decision for unsafe image', async () => {
      const mockResponse = {
        success: true,
        decision: 'flagged' as const,
        flagged: true,
        categories: ['adult', 'racy'],
        confidence: 0.9,
        details: {
          adult: 'VERY_LIKELY',
          violence: 'UNLIKELY',
          racy: 'LIKELY',
          medical: 'UNLIKELY',
          spoof: 'UNLIKELY',
        },
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await moderateListingImage('item-456', 'https://example.com/flagged.jpg');

      expect(result.success).toBe(true);
      expect(result.decision).toBe('flagged');
      expect(result.flagged).toBe(true);
      expect(result.categories).toEqual(['adult', 'racy']);
      expect(result.confidence).toBe(0.9);
    });

    it('should throw error when Edge Function returns error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('Network timeout'),
      });

      await expect(
        moderateListingImage('item-789', 'https://example.com/image.jpg')
      ).rejects.toThrow('Image moderation failed: Network timeout');
    });

    it('should throw error when moderation service returns error in data', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          error: {
            code: 'GOOGLE_VISION_ERROR',
            message: 'Google Vision API key invalid',
          },
        },
        error: null,
      });

      await expect(
        moderateListingImage('item-789', 'https://example.com/image.jpg')
      ).rejects.toThrow('Image moderation failed: Google Vision API key invalid');
    });
  });

  describe('moderateListingImages (multiple)', () => {
    it('should moderate multiple images successfully', async () => {
      const mockResponse1 = {
        success: true,
        decision: 'approved' as const,
        flagged: false,
        categories: [],
        confidence: 0.1,
      };

      const mockResponse2 = {
        success: true,
        decision: 'approved' as const,
        flagged: false,
        categories: [],
        confidence: 0.2,
      };

      mockInvoke
        .mockResolvedValueOnce({ data: mockResponse1, error: null })
        .mockResolvedValueOnce({ data: mockResponse2, error: null });

      const results = await moderateListingImages('item-123', [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].decision).toBe('approved');
      expect(results[1].decision).toBe('approved');
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should continue moderating other images if one fails', async () => {
      const mockResponse = {
        success: true,
        decision: 'approved' as const,
        flagged: false,
        categories: [],
        confidence: 0.1,
      };

      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockResponse, error: null });

      const results = await moderateListingImages('item-456', [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ]);

      expect(results).toHaveLength(2);
      // First one defaults to approved on error
      expect(results[0].flagged).toBe(false);
      expect(results[0].decision).toBe('approved');
      // Second one succeeds
      expect(results[1].decision).toBe('approved');
    });

    it('should flag listing if any image is flagged', async () => {
      const mockApproved = {
        success: true,
        decision: 'approved' as const,
        flagged: false,
        categories: [],
        confidence: 0.1,
      };

      const mockFlagged = {
        success: true,
        decision: 'flagged' as const,
        flagged: true,
        categories: ['violence'],
        confidence: 0.8,
      };

      mockInvoke
        .mockResolvedValueOnce({ data: mockApproved, error: null })
        .mockResolvedValueOnce({ data: mockFlagged, error: null });

      const results = await moderateListingImages('item-789', [
        'https://example.com/safe.jpg',
        'https://example.com/violent.jpg',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].flagged).toBe(false);
      expect(results[1].flagged).toBe(true);
      expect(results[1].categories).toEqual(['violence']);
    });

    it('should handle empty image array', async () => {
      const results = await moderateListingImages('item-empty', []);
      
      expect(results).toEqual([]);
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
