/**
 * FILE: p2p-kids-marketplace/src/services/__tests__/safety.test.ts
 * MODULE: MODULE-13-SAFETY-COMPLIANCE
 * TASK: SAFETY-002 - CPSC Recall Matching Logic - Unit Tests
 * 
 * Tests safety service functions with mocked Supabase client.
 */

import { checkItemSafety, getItemSafetyFlags, isCpscCheckEnabled, getCpscMatchThreshold } from '../safety';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            then: jest.fn(),
          })),
          single: jest.fn(() => ({
            then: jest.fn(),
          })),
        })),
        single: jest.fn(() => ({
          then: jest.fn(),
        })),
      })),
    })),
  },
}));

describe('safety service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkItemSafety', () => {
    it('should return success = true when no recalls match', async () => {
      const mockResponse = { success: true, flagged: false };
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await checkItemSafety(
        '123e4567-e89b-12d3-a456-426614174000',
        'LEGO Building Set',
        'Safe toy for kids'
      );

      expect(result.success).toBe(true);
      expect(result.flagged).toBe(false);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('check-item-safety', {
        body: {
          itemId: '123e4567-e89b-12d3-a456-426614174000',
          title: 'LEGO Building Set',
          description: 'Safe toy for kids',
        },
      });
    });

    it('should return flagged = true when CPSC recall matches', async () => {
      const mockMatch = {
        recall_id: 'aaa-bbb-ccc',
        recall_number: 'R-2025-001',
        product_name: 'Fisher-Price Baby Toy',
        manufacturer: 'Fisher-Price',
        hazard: 'Choking hazard: small parts',
        similarity_score: 0.85,
      };

      const mockResponse = {
        success: true,
        flagged: true,
        reason: 'cpsc_recall',
        match: mockMatch,
        confidence: 0.85,
      };

      (supabase.functions.invoke as jest. Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await checkItemSafety(
        '456e4567-e89b-12d3-a456-426614174001',
        'Fisher-Price Baby Toy',
        'Colorful toy with parts'
      );

      expect(result.success).toBe(true);
      expect(result.flagged).toBe(true);
      expect(result.reason).toBe('cpsc_recall');
      expect(result.match?.product_name).toBe('Fisher-Price Baby Toy');
      expect(result.confidence).toBe(0.85);
    });

    it('should handle edge function errors gracefully', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' },
      });

      const result = await checkItemSafety(
        '789e4567-e89b-12d3-a456-426614174002',
        'Test Item',
        'Test description'
      );

      expect(result.success).toBe(false);
      expect(result.flagged).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle exceptions during invocation', async () => {
      (supabase.functions.invoke as jest.Mock).mockRejectedValueOnce(
        new Error('Connection timeout')
      );

      const result = await checkItemSafety(
        '999e4567-e89b-12d3-a456-426614174003',
        'Test Item 2',
        'Test description 2'
      );

      expect(result.success).toBe(false);
      expect(result.flagged).toBe(false);
      expect(result.error).toContain('Connection timeout');
    });

    it('should work without description', async () => {
      const mockResponse = { success: true, flagged: false };
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await checkItemSafety(
        '111e4567-e89b-12d3-a456-426614174004',
        'Simple Title'
      );

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('check-item-safety', {
        body: {
          itemId: '111e4567-e89b-12d3-a456-426614174004',
          title: 'Simple Title',
          description: undefined,
        },
      });
    });
  });

  describe('getItemSafetyFlags', () => {
    it('should return safety flags for an item', async () => {
      const mockFlags = [
        {
          id: 'flag-1',
          item_id: 'item-123',
          flag_type: 'cpsc_recall',
          flag_reason: 'Possible recall match',
          confidence_score: 0.75,
          recall_id: 'recall-abc',
          status: 'pending',
          reviewer_id: null,
          reviewed_at: null,
          review_notes: null,
          created_at: '2025-03-29T00:00:00Z',
          updated_at: '2025-03-29T00:00:00Z',
        },
      ];

      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockFlags, error: null })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getItemSafetyFlags('item-123');

      expect(result).toEqual(mockFlags);
      expect(mockFrom).toHaveBeenCalledWith('item_safety_flags');
    });

    it('should return empty array on error', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getItemSafetyFlags('item-456');

      expect(result).toEqual([]);
    });
  });

  describe('isCpscCheckEnabled', () => {
    it('should return true when config is enabled', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { value: 'true' }, error: null })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await isCpscCheckEnabled();

      expect(result).toBe(true);
    });

    it('should return true (default) when config not found', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await isCpscCheckEnabled();

      expect(result).toBe(true);
    });
  });

  describe('getCpscMatchThreshold', () => {
    it('should return configured threshold', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { value: '0.65' }, error: null })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getCpscMatchThreshold();

      expect(result).toBe(0.65);
    });

    it('should return 0.5 default when config not found', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getCpscMatchThreshold();

      expect(result).toBe(0.5);
    });

    it('should return 0.5 default when value is invalid', async () => {
      const mockFrom = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { value: 'invalid' }, error: null })),
          })),
        })),
      }));

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await getCpscMatchThreshold();

      expect(result).toBe(0.5);
    });
  });
});
