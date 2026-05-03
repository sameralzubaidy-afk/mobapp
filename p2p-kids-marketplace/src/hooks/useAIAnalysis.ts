/**
 * File: p2p-kids-marketplace/src/hooks/useAIAnalysis.ts
 * MODULE-04 LISTING-V3-004: AI Analysis Hook
 *
 * Provides AI photo analysis with:
 * - Automatic analysis trigger on photo URLs change
 * - AbortController cancellation on URL change
 * - Single retry on network error
 * - Status state management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AIAnalysisResult } from '../types/listing';
import { analyzePhotosBatch, BatchAnalysisItem } from '../services/aiService';

const RETRY_DELAY_MS = 1500;

export type AIAnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'error';

export interface UseAIAnalysisResult {
  status: AIAnalysisStatus;
  result: AIAnalysisResult | null;
  error: string | null;
  retry: () => void;
}

/**
 * Hook for AI photo analysis
 *
 * Features:
 * - Does NOT auto-run until photoUrls.length > 0
 * - Aborts pending fetch when photoUrls change
 * - Single retry on network error with 1.5s delay
 * - Returns status: idle | analyzing | ready | error
 *
 * @param photoUrls - Array of photo URLs to analyze
 * @param sellerId - Seller ID for analysis request
 * @returns Analysis state and retry method
 */
export function useAIAnalysis(photoUrls: string[], sellerId: string): UseAIAnalysisResult {
  const [status, setStatus] = useState<AIAnalysisStatus>('idle');
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const photoUrlsRef = useRef<string[]>([]);

  // Perform analysis
  const analyze = useCallback(async () => {
    if (photoUrls.length === 0) {
      setStatus('idle');
      setResult(null);
      setError(null);
      return;
    }

    // Abort previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any queued retry before starting a new attempt
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setStatus('analyzing');
      setError(null);

      // Build batch analysis request
      const items: BatchAnalysisItem[] = [
        {
          groupId: 'single-item',
          primaryPhotoUrl: photoUrls[0],
          allPhotoUrls: photoUrls,
        },
      ];

      // Call batch analysis service
      const response = await analyzePhotosBatch(items, sellerId);

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Extract result for single item
      const itemResult = response.results[0];

      if (itemResult?.error) {
        throw new Error(itemResult.error);
      }

      if (itemResult?.analysis) {
        setResult(itemResult.analysis);
        setStatus('ready');
        retryCountRef.current = 0;
      } else {
        throw new Error('No analysis result returned');
      }
    } catch (err: any) {
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      const errorMessage = err.message || 'Analysis failed';
      setError(errorMessage);
      setStatus('error');

      // Retry once on network error
      if (retryCountRef.current === 0 && errorMessage.toLowerCase().includes('network')) {
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          analyze();
        }, RETRY_DELAY_MS);
      }
    }
  }, [photoUrls, sellerId]);

  // Trigger analysis when photo URLs change
  useEffect(() => {
    const urlsChanged = JSON.stringify(photoUrls) !== JSON.stringify(photoUrlsRef.current);

    if (urlsChanged) {
      photoUrlsRef.current = photoUrls;
      retryCountRef.current = 0;
      analyze();
    }
  }, [photoUrls, analyze]);

  // Manual retry method
  const retry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    analyze();
  }, [analyze]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    result,
    error,
    retry,
  };
}
