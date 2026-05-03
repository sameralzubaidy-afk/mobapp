// FILE: p2p-kids-marketplace/src/__tests__/services/educationAnalyticsService.test.ts
// MODULE-18 V1 EDU-003: Unit tests for education analytics service

import {
  trackEducationEvent,
  shouldShowOnboarding,
  markOnboardingComplete,
  markOnboardingSkipped,
  markPromptSeen,
  shouldShowPrompt,
} from '../../services/educationAnalyticsService';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('educationAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackEducationEvent', () => {
    it('should insert analytics event without throwing', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      const mockQuery = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(trackEducationEvent('onboarding_start')).resolves.not.toThrow();
      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        event_type: 'onboarding_start',
        event_data: null,
      });
    });

    it('should never throw on error (fire-and-forget)', async () => {
      (supabase.auth.getUser as jest.Mock).mockRejectedValue(new Error('Auth error'));

      await expect(trackEducationEvent('help_view')).resolves.not.toThrow();
    });

    it('should log warning on insert error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });

      const mockQuery = {
        insert: jest.fn().mockResolvedValue({ error: new Error('Insert failed') }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await trackEducationEvent('calculator_use', { price: 20 });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[educationAnalyticsService] Track event failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('shouldShowOnboarding', () => {
    it('should return true when both fields are null', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { onboarding_completed_at: null, onboarding_skipped_at: null },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowOnboarding('user-1');

      expect(result).toBe(true);
    });

    it('should return false when onboarding_completed_at is set', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            onboarding_completed_at: '2026-05-01T10:00:00Z',
            onboarding_skipped_at: null,
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowOnboarding('user-1');

      expect(result).toBe(false);
    });

    it('should return false when onboarding_skipped_at is set', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            onboarding_completed_at: null,
            onboarding_skipped_at: '2026-05-01T10:00:00Z',
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowOnboarding('user-1');

      expect(result).toBe(false);
    });

    it('should return true on error (safe default)', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowOnboarding('user-1');

      expect(result).toBe(true);
    });
  });

  describe('markPromptSeen', () => {
    it('should append key to education_prompts_seen array', async () => {
      const mockSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { education_prompts_seen: ['seller_first_listing'] },
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(mockSelectQuery)
        .mockReturnValueOnce(mockUpdateQuery);

      const result = await markPromptSeen('user-1', 'buyer_first_purchase');

      expect(result).toBe(true);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith({
        education_prompts_seen: ['seller_first_listing', 'buyer_first_purchase'],
      });
    });

    it('should be idempotent (not add duplicate)', async () => {
      const mockSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { education_prompts_seen: ['seller_first_listing'] },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSelectQuery);

      const result = await markPromptSeen('user-1', 'seller_first_listing');

      // Should still return true but not call update
      expect(result).toBe(true);
    });
  });

  describe('shouldShowPrompt', () => {
    it('should return false if key in education_prompts_seen', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            education_prompts_seen: ['seller_first_listing'],
            education_prompts_suppressed_at: null,
            onboarding_skipped_at: null,
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowPrompt('user-1', 'seller_first_listing');

      expect(result).toBe(false);
    });

    it('should return false if education_prompts_suppressed_at is set', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            education_prompts_seen: [],
            education_prompts_suppressed_at: '2026-05-01T10:00:00Z',
            onboarding_skipped_at: null,
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await shouldShowPrompt('user-1', 'new_prompt');

      expect(result).toBe(false);
    });

    it('should auto-suppress after 3 prompts when onboarding skipped', async () => {
      const mockSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            education_prompts_seen: ['prompt1', 'prompt2', 'prompt3'],
            education_prompts_suppressed_at: null,
            onboarding_skipped_at: '2026-05-01T10:00:00Z',
          },
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(mockSelectQuery)
        .mockReturnValueOnce(mockUpdateQuery);

      const result = await shouldShowPrompt('user-1', 'new_prompt');

      expect(result).toBe(false);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith({
        education_prompts_suppressed_at: expect.any(String),
      });
    });
  });
});
