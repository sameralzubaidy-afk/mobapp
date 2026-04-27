/**
 * Unit tests for useAIAnalysis hook
 * MODULE-04 LISTING-V3: TASK LISTING-V3-010
 * Tests idle→analyzing→ready; abort on photoUrls change; retry path
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAIAnalysis } from '../../hooks/useAIAnalysis';
import * as aiService from '../../services/aiService';

// Mock aiService
jest.mock('../../services/aiService', () => ({
  analyzePhotosBatch: jest.fn(),
}));

const mockAIService = aiService as jest.Mocked<typeof aiService>;

describe('useAIAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start in idle state when no photoUrls provided', () => {
    const { result } = renderHook(() => useAIAnalysis([], 'seller-123'));

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should transition to analyzing when photoUrls provided', async () => {
    mockAIService.analyzePhotosBatch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                results: [
                  {
                    groupId: 'single-item',
                    analysis: {
                      title: { value: 'Test Item', confidence: 0.85 },
                    },
                  },
                ],
                totalProcessed: 1,
                totalFailed: 0,
              }),
            100
          )
        )
    );

    const { result } = renderHook(() =>
      useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
    );

    // Should start analyzing immediately
    await waitFor(() => {
      expect(result.current.status).toBe('analyzing');
    });

    // Wait for completion
    await waitFor(
      () => {
        expect(result.current.status).toBe('ready');
      },
      { timeout: 3000 }
    );

    expect(result.current.result).toBeDefined();
    expect(result.current.result?.title?.value).toBe('Test Item');
  });

  it('should abort pending fetch when photoUrls change', async () => {
    let firstResolve: any;
    const firstPromise = new Promise((resolve) => {
      firstResolve = resolve;
    });

    mockAIService.analyzePhotosBatch.mockImplementationOnce(() => firstPromise);

    const { result, rerender } = renderHook(
      ({ urls, sellerId }) => useAIAnalysis(urls, sellerId),
      {
        initialProps: { urls: ['https://example.com/photo1.jpg'], sellerId: 'seller-123' },
      }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('analyzing');
    });

    // Change photoUrls before first analysis completes
    mockAIService.analyzePhotosBatch.mockResolvedValueOnce({
      results: [
        {
          groupId: 'single-item',
          analysis: {
            title: { value: 'Second Analysis', confidence: 0.90 },
          },
        },
      ],
      totalProcessed: 1,
      totalFailed: 0,
    });

    rerender({ urls: ['https://example.com/photo2.jpg'], sellerId: 'seller-123' });

    // Should start new analysis
    await waitFor(() => {
      expect(mockAIService.analyzePhotosBatch).toHaveBeenCalledTimes(2);
    });

    // Resolve the first (aborted) promise - should not affect state
    act(() => {
      firstResolve({
        results: [
          {
            groupId: 'single-item',
            analysis: {
              title: { value: 'First Analysis', confidence: 0.80 },
            },
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Should have result from second analysis, not first
    expect(result.current.result?.title?.value).toBe('Second Analysis');
  });

  it('should transition to error state on analysis failure', async () => {
    mockAIService.analyzePhotosBatch.mockRejectedValue(new Error('Network timeout'));

    const { result } = renderHook(() =>
      useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.error).toBe('Network timeout');
    expect(result.current.result).toBeNull();
  });

  it('should retry once on network error with 1.5s delay', async () => {
    jest.useFakeTimers();

    // First call fails
    mockAIService.analyzePhotosBatch.mockRejectedValueOnce(
      new Error('Network error')
    );

    // Second call succeeds
    mockAIService.analyzePhotosBatch.mockResolvedValueOnce({
      results: [
        {
          groupId: 'single-item',
          analysis: {
            title: { value: 'Retry Success', confidence: 0.75 },
          },
        },
      ],
      totalProcessed: 1,
      totalFailed: 0,
    });

    const { result } = renderHook(() =>
      useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
    );

    // Wait for first failure
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    // Auto-retry should trigger after 1.5s
    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve(); // Flush promises
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.result?.title?.value).toBe('Retry Success');
    expect(mockAIService.analyzePhotosBatch).toHaveBeenCalledTimes(2);
  });

  it('should handle partial analysis failure', async () => {
    mockAIService.analyzePhotosBatch.mockResolvedValue({
      results: [
        {
          groupId: 'single-item',
          error: 'Vision API rate limit exceeded',
        },
      ],
      totalProcessed: 0,
      totalFailed: 1,
    });

    const { result } = renderHook(() =>
      useAIAnalysis(['https://example.com/photo1.jpg'], 'seller-123')
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.error).toBe('Vision API rate limit exceeded');
  });

  it('should clear error state when new analysis succeeds', async () => {
    // First analysis fails
    mockAIService.analyzePhotosBatch.mockRejectedValueOnce(
      new Error('First failure')
    );

    const { result, rerender } = renderHook(
      ({ urls, sellerId }) => useAIAnalysis(urls, sellerId),
      {
        initialProps: { urls: ['https://example.com/photo1.jpg'], sellerId: 'seller-123' },
      }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('First failure');
    });

    // Second analysis succeeds
    mockAIService.analyzePhotosBatch.mockResolvedValueOnce({
      results: [
        {
          groupId: 'single-item',
          analysis: {
            title: { value: 'Success', confidence: 0.80 },
          },
        },
      ],
      totalProcessed: 1,
      totalFailed: 0,
    });

    rerender({ urls: ['https://example.com/photo2.jpg'], sellerId: 'seller-123' });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.result?.title?.value).toBe('Success');
  });

  it('should return to idle when photoUrls becomes empty', async () => {
    mockAIService.analyzePhotosBatch.mockResolvedValue({
      results: [
        {
          groupId: 'single-item',
          analysis: {
            title: { value: 'Test', confidence: 0.70 },
          },
        },
      ],
      totalProcessed: 1,
      totalFailed: 0,
    });

    const { result, rerender } = renderHook(
      ({ urls, sellerId }) => useAIAnalysis(urls, sellerId),
      {
        initialProps: { urls: ['https://example.com/photo1.jpg'], sellerId: 'seller-123' },
      }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Clear photos
    rerender({ urls: [], sellerId: 'seller-123' });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
