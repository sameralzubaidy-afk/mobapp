/**
 * Tests for image URL utilities
 */

import { transformToCdnUrl, getImageUrl, isCdnUrl } from './imageUrl';

describe('imageUrl utilities', () => {
  // Set environment for tests
  beforeEach(() => {
    process.env.EXPO_PUBLIC_CDN_URL = 'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev';
  });

  describe('transformToCdnUrl', () => {
    it('transforms Supabase Storage URL to CDN URL', () => {
      const supabaseUrl =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/user-123/photo.jpg';
      const expected =
        'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/user-123/photo.jpg';

      const result = transformToCdnUrl(supabaseUrl);
      expect(result).toBe(expected);
    });

    it('returns null for null input', () => {
      expect(transformToCdnUrl(null)).toBeNull();
      expect(transformToCdnUrl(undefined)).toBeNull();
    });

    it('returns original URL if CDN not configured', () => {
      process.env.EXPO_PUBLIC_CDN_URL = '';

      const supabaseUrl =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/abc.jpg';
      const result = transformToCdnUrl(supabaseUrl);
      expect(result).toBe(supabaseUrl);
    });

    it('returns non-storage URLs unchanged', () => {
      const otherUrl = 'https://example.com/image.jpg';
      const result = transformToCdnUrl(otherUrl);
      expect(result).toBe(otherUrl);
    });

    it('handles URLs with special characters in path', () => {
      const supabaseUrl =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/user%20123/photo%20(1).jpg';
      const result = transformToCdnUrl(supabaseUrl);
      expect(result).toContain('item-images/user%20123/photo%20(1).jpg');
    });
  });

  describe('getImageUrl', () => {
    it('prefers CDN URL when both available', () => {
      const cdnUrl = 'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/abc.jpg';
      const publicUrl =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/abc.jpg';

      const result = getImageUrl(cdnUrl, publicUrl);
      expect(result).toBe(cdnUrl);
    });

    it('transforms publicUrl if CDN not provided', () => {
      const publicUrl =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/xyz.jpg';

      const result = getImageUrl(undefined, publicUrl);
      expect(result).toContain('item-images/xyz.jpg');
      expect(result).toContain('workers.dev');
    });

    it('uses CDN URL directly if only CDN provided', () => {
      const cdnUrl = 'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/test.jpg';

      const result = getImageUrl(cdnUrl, undefined);
      expect(result).toBe(cdnUrl);
    });

    it('returns null if neither URL provided', () => {
      const result = getImageUrl(undefined, undefined);
      expect(result).toBeNull();
    });

    it('returns null if both URLs are null/undefined', () => {
      expect(getImageUrl(null, null)).toBeNull();
      expect(getImageUrl(undefined, null)).toBeNull();
      expect(getImageUrl(null, undefined)).toBeNull();
    });
  });

  describe('isCdnUrl', () => {
    it('returns true for workers.dev URLs', () => {
      const url = 'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/abc.jpg';
      expect(isCdnUrl(url)).toBe(true);
    });

    it('returns true for configured CDN URL', () => {
      const url =
        'https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/xyz.jpg';
      expect(isCdnUrl(url)).toBe(true);
    });

    it('returns false for Supabase Storage URLs', () => {
      const url =
        'https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/abc.jpg';
      expect(isCdnUrl(url)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isCdnUrl(null)).toBe(false);
      expect(isCdnUrl(undefined)).toBe(false);
    });

    it('returns false for regular URLs', () => {
      expect(isCdnUrl('https://example.com/image.jpg')).toBe(false);
    });
  });
});
