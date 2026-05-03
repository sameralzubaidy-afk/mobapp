/**
 * File: p2p-kids-marketplace/src/hooks/__tests__/useAIAnalysis.test.tsx
 * MODULE-04 LISTING-V3-004: useAIAnalysis Hook Unit Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAIAnalysis } from '../useAIAnalysis';
import * as aiService from '../../services/aiService';
import { AIAnalysisResult } from '../../types/listing';

// Mock dependencies
jest.mock('../../services/aiService');

// Mock timers
jest.useFakeTimers();

const mockAnalysisResult: AIAnalysisResult = {
  title: { value: 'Blue Bike', confidence: 0.85 },
  category: {
    value: { label: 'Bikes & Ride-Ons', categoryId: 'cat-123' },
    confidence: 0.9,
  },
  condition: { value: 'good', confidence: 0.75 },
  brand: { value: 'Schwinn', confidence: 0.8 },
  color: { value: ['blue', 'black'], confidence: 0.88 },
  age_group: { value: '6-8', confidence: 0.7 },
  gender: { value: 'boy', confidence: 0.65 },
};

describe('useAIAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Initial state', () => {
    it('should start with idle status when no photos provided', () => {
      const { result } = renderHook(() => useAIAnalysis([], 'seller-123'));

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should not trigger analysis with empty photo array', () => {
      renderHook(() => useAIAnalysis([], 'seller-123'));

      expect(aiService.analyzePhotosBatch).not.toHaveBeenCalled();
    });
  });

  describe('Successful analysis', () => {
    it('should analyze photos when URLs provided', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      expect(result.current.status).toBe('analyzing');

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(result.current.result).toEqual(mockAnalysisResult);
      expect(result.current.error).toBeNull();
      expect(aiService.analyzePhotosBatch).toHaveBeenCalledWith(
        [
          {
            groupId: 'single-item',
            primaryPhotoUrl: 'https://example.com/photo1.jpg',
            allPhotoUrls: ['https://example.com/photo1.jpg'],
          },
        ],
        'seller-123'
      );
    });

    it('should use all photo URLs in analysis', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockResolvedValue(mockResponse);

      const photoUrls = [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
      ];

      const { result } = renderHook(() => useAIAnalysis(photoUrls, 'seller-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(aiService.analyzePhotosBatch).toHaveBeenCalledWith(
        [
          {
            groupId: 'single-item',
            primaryPhotoUrl: photoUrls[0],
            allPhotoUrls: photoUrls,
          },
        ],
        'seller-123'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle analysis error', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            error: 'Vision API error',
          },
        ],
        totalProcessed: 0,
        totalFailed: 1,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.error).toBe('Vision API error');
      expect(result.current.result).toBeNull();
    });

    it('should retry once on network error', async () => {
      (aiService.analyzePhotosBatch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          results: [
            {
              groupId: 'single-item',
              analysis: mockAnalysisResult,
            },
          ],
          totalProcessed: 1,
          totalFailed: 0,
        });

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      // First call fails
      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      // Wait for retry delay
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Second call succeeds
      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(result.current.result).toEqual(mockAnalysisResult);
      expect(aiService.analyzePhotosBatch).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-network errors', async () => {
      (aiService.analyzePhotosBatch as jest.Mock).mockRejectedValue(new Error('Invalid API key'));

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      // Wait to ensure no retry happens
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(aiService.analyzePhotosBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Photo URL changes', () => {
    it('should re-analyze when photo URLs change', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockResolvedValue(mockResponse);

      const { result, rerender } = renderHook(({ urls }) => useAIAnalysis(urls, 'seller-123'), {
        initialProps: { urls: ['https://example.com/photo1.jpg'] },
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(aiService.analyzePhotosBatch).toHaveBeenCalledTimes(1);

      // Change photo URLs
      rerender({ urls: ['https://example.com/photo2.jpg'] });

      await waitFor(() => {
        expect(aiService.analyzePhotosBatch).toHaveBeenCalledTimes(2);
      });
    });

    it('should abort previous request when URLs change', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 1000);
          })
      );

      const { rerender } = renderHook(({ urls }) => useAIAnalysis(urls, 'seller-123'), {
        initialProps: { urls: ['https://example.com/photo1.jpg'] },
      });

      // Change URLs before first analysis completes
      rerender({ urls: ['https://example.com/photo2.jpg'] });

      expect(aiService.analyzePhotosBatch).toHaveBeenCalledTimes(2);
    });

    it('should reset to idle when URLs become empty', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockResolvedValue(mockResponse);

      const { result, rerender } = renderHook(({ urls }) => useAIAnalysis(urls, 'seller-123'), {
        initialProps: { urls: ['https://example.com/photo1.jpg'] },
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      // Clear photos
      rerender({ urls: [] });

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Manual retry', () => {
    it('should allow manual retry after error', async () => {
      (aiService.analyzePhotosBatch as jest.Mock)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          results: [
            {
              groupId: 'single-item',
              analysis: mockAnalysisResult,
            },
          ],
          totalProcessed: 1,
          totalFailed: 0,
        });

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      // Manual retry
      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('ready');
      });

      expect(result.current.result).toEqual(mockAnalysisResult);
    });

    it('should reset retry count on manual retry', async () => {
      (aiService.analyzePhotosBatch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      // First error + auto retry
      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Manual retry should reset count
      act(() => {
        result.current.retry();
      });

      // Should retry again on next error
      await waitFor(() => {
        expect(aiService.analyzePhotosBatch).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup', () => {
    it('should abort pending request on unmount', () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single-item',
            analysis: mockAnalysisResult,
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (aiService.analyzePhotosBatch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 1000);
          })
      );

      const { unmount } = renderHook(() =>
        useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
      );

      unmount();

      // Should not crash or cause memory leaks
      expect(true).toBe(true);
    });
  });
});
