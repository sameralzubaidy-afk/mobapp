/**
 * Unit tests for aiService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests AI batch analysis, result parsing, and confidence level determination
 */

import * as aiService from '../../services/aiService';
import { AIAnalysisResult } from '../../types/listing';
import { supabase } from '../../config/supabase';

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAIConfidenceLevel', () => {
    it('should return "high" for confidence >= 0.70', () => {
      expect(aiService.getAIConfidenceLevel(0.70)).toBe('high');
      expect(aiService.getAIConfidenceLevel(0.85)).toBe('high');
      expect(aiService.getAIConfidenceLevel(1.00)).toBe('high');
    });

    it('should return "medium" for confidence 0.40-0.69', () => {
      expect(aiService.getAIConfidenceLevel(0.40)).toBe('medium');
      expect(aiService.getAIConfidenceLevel(0.55)).toBe('medium');
      expect(aiService.getAIConfidenceLevel(0.69)).toBe('medium');
    });

    it('should return "low" for confidence < 0.40', () => {
      expect(aiService.getAIConfidenceLevel(0.00)).toBe('low');
      expect(aiService.getAIConfidenceLevel(0.20)).toBe('low');
      expect(aiService.getAIConfidenceLevel(0.39)).toBe('low');
    });
  });

  describe('parseAIResult', () => {
    it('should keep fields with confidence >= 0.40', () => {
      const raw: AIAnalysisResult = {
        title: { value: 'LEGO Dinosaur Set', confidence: 0.85 },
        category: { value: { label: 'Toys', categoryId: '123' }, confidence: 0.70 },
        condition: { value: 'like_new', confidence: 0.50 },
        brand: { value: 'LEGO', confidence: 0.90 },
      };

      const filtered = aiService.parseAIResult(raw);

      expect(filtered.title).toEqual(raw.title);
      expect(filtered.category).toEqual(raw.category);
      expect(filtered.condition).toEqual(raw.condition);
      expect(filtered.brand).toEqual(raw.brand);
    });

    it('should strip fields with confidence < 0.40', () => {
      const raw: AIAnalysisResult = {
        title: { value: 'Toy', confidence: 0.35 },
        category: { value: { label: 'Unknown', categoryId: null }, confidence: 0.25 },
        brand: { value: 'Generic', confidence: 0.10 },
      };

      const filtered = aiService.parseAIResult(raw);

      expect(filtered.title).toBeUndefined();
      expect(filtered.category).toBeUndefined();
      expect(filtered.brand).toBeUndefined();
    });

    it('should preserve rawLabels and error', () => {
      const raw: AIAnalysisResult = {
        rawLabels: ['toy', 'plastic', 'colorful'],
        error: 'Partial analysis failure',
      };

      const filtered = aiService.parseAIResult(raw);

      expect(filtered.rawLabels).toEqual(raw.rawLabels);
      expect(filtered.error).toBe(raw.error);
    });

    it('should handle mix of valid and invalid fields', () => {
      const raw: AIAnalysisResult = {
        title: { value: 'Nike Shoes', confidence: 0.80 }, // Keep
        brand: { value: 'Nike', confidence: 0.30 }, // Strip
        color: { value: ['blue', 'white'], confidence: 0.60 }, // Keep
        age_group: { value: '6-8', confidence: 0.25 }, // Strip
      };

      const filtered = aiService.parseAIResult(raw);

      expect(filtered.title).toBeDefined();
      expect(filtered.brand).toBeUndefined();
      expect(filtered.color).toBeDefined();
      expect(filtered.age_group).toBeUndefined();
    });

    it('should handle empty result', () => {
      const raw: AIAnalysisResult = {};
      const filtered = aiService.parseAIResult(raw);

      expect(Object.keys(filtered)).toHaveLength(0);
    });
  });

  describe('analyzePhotosBatch', () => {
    it('should invoke batch-analyze-items edge function', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'group-1',
            analysis: {
              title: { value: 'Test Item', confidence: 0.85 },
            },
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const items = [
        {
          groupId: 'group-1',
          primaryPhotoUrl: 'https://example.com/photo1.jpg',
          allPhotoUrls: ['https://example.com/photo1.jpg'],
        },
      ];

      const result = await aiService.analyzePhotosBatch(items, 'seller-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith('batch-analyze-items', {
        body: {
          items,
          sellerId: 'seller-123',
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(result.totalFailed).toBe(0);
    });

    it('should parse results defensively', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'group-1',
            analysis: {
              title: { value: 'Item 1', confidence: 0.85 },
              brand: { value: 'Brand', confidence: 0.30 }, // Should be stripped
            },
          },
          {
            groupId: 'group-2',
            error: 'Analysis failed',
          },
        ],
        totalProcessed: 1,
        totalFailed: 1,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const items = [
        { groupId: 'group-1', primaryPhotoUrl: 'url1', allPhotoUrls: ['url1'] },
        { groupId: 'group-2', primaryPhotoUrl: 'url2', allPhotoUrls: ['url2'] },
      ];

      const result = await aiService.analyzePhotosBatch(items, 'seller-123');

      expect(result.results[0].analysis?.title).toBeDefined();
      expect(result.results[0].analysis?.brand).toBeUndefined(); // Stripped
      expect(result.results[1].error).toBe('Analysis failed');
    });

    it('should handle edge function error', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const items = [
        { groupId: 'group-1', primaryPhotoUrl: 'url1', allPhotoUrls: ['url1'] },
      ];

      const result = await aiService.analyzePhotosBatch(items, 'seller-123');

      expect(result.totalFailed).toBe(1);
      expect(result.results[0].error).toBeDefined();
    });

    it('should fallback to analyze-item-image when batch returns non-2xx error', async () => {
      (supabase.functions.invoke as jest.Mock)
        .mockRejectedValueOnce({
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
        })
        .mockResolvedValueOnce({
          data: {
            title: { value: 'Fallback Title', confidence: 0.91 },
            brand: { value: 'Brand X', confidence: 0.88 },
          },
          error: null,
        });

      const items = [
        { groupId: 'group-1', primaryPhotoUrl: 'https://example.com/photo.jpg', allPhotoUrls: ['https://example.com/photo.jpg'] },
      ];

      const result = await aiService.analyzePhotosBatch(items, 'seller-123');

      expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, 'batch-analyze-items', {
        body: {
          items,
          sellerId: 'seller-123',
        },
      });
      expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, 'analyze-item-image', {
        body: {
          photoUrl: 'https://example.com/photo.jpg',
          sellerId: 'seller-123',
        },
      });

      expect(result.totalProcessed).toBe(1);
      expect(result.totalFailed).toBe(0);
      expect(result.results[0].analysis?.title?.value).toBe('Fallback Title');
    });

    it('should handle missing response data', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const items = [
        { groupId: 'group-1', primaryPhotoUrl: 'url1', allPhotoUrls: ['url1'] },
      ];

      const result = await aiService.analyzePhotosBatch(items, 'seller-123');

      expect(result.results).toEqual([]);
      expect(result.totalProcessed).toBe(0);
      expect(result.totalFailed).toBe(0);
    });
  });

  describe('analyzeSinglePhoto', () => {
    it('should analyze single photo using batch wrapper', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single',
            analysis: {
              title: { value: 'Test Item', confidence: 0.85 },
            },
          },
        ],
        totalProcessed: 1,
        totalFailed: 0,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await aiService.analyzeSinglePhoto(
        'https://example.com/photo.jpg',
        'seller-123'
      );

      expect(result).toHaveProperty('title');
      expect((result as AIAnalysisResult).title?.value).toBe('Test Item');
    });

    it('should return error if analysis fails', async () => {
      const mockResponse = {
        results: [
          {
            groupId: 'single',
            error: 'Analysis failed',
          },
        ],
        totalProcessed: 0,
        totalFailed: 1,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await aiService.analyzeSinglePhoto(
        'https://example.com/photo.jpg',
        'seller-123'
      );

      expect(result).toHaveProperty('error');
      expect((result as any).error).toBe('Analysis failed');
    });

    it('should return error if no result', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { results: [], totalProcessed: 0, totalFailed: 0 },
        error: null,
      });

      const result = await aiService.analyzeSinglePhoto(
        'https://example.com/photo.jpg',
        'seller-123'
      );

      expect(result).toHaveProperty('error');
      expect((result as any).error).toBe('No analysis result');
    });
  });
});
