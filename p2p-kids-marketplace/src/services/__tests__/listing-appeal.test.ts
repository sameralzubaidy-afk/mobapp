import { submitListingAppeal, submitListingNeedsEditsReReview } from '../listing';
import { supabase } from '../../config/supabase';
import { trackEvent } from '../analytics';
import * as adminConfigService from '../adminConfig';

jest.mock('../../config/supabase');
jest.mock('../analytics');
jest.mock('../adminConfig');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;
const mockGetAdminConfig = adminConfigService.getAdminConfig as jest.MockedFunction<
  typeof adminConfigService.getAdminConfig
>;

describe('submitListingAppeal', () => {
  const validAppealReason = 'I fixed the safety concern and updated the listing details.';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminConfig.mockResolvedValue({
      moderation_appeal_max_attempts: 3,
      moderation_appeal_window_days: 14,
    } as Awaited<ReturnType<typeof adminConfigService.getAdminConfig>>);
  });

  it('transitions rejected listing back to flagged for owner', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 1,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: true,
        },
        error: null,
      }),
    } as any;

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'flagged',
          appeal_count: 1,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: true,
          appeal_reason: validAppealReason,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const result = await submitListingAppeal('listing-1', 'seller-1', validAppealReason);

    expect(result.status).toBe('flagged');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'flagged',
        appeal_reason: validAppealReason,
      })
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'listing_appeal_submitted',
      expect.objectContaining({ listing_id: 'listing-1', seller_id: 'seller-1' })
    );
  });

  it('rejects appeal when listing status is not rejected', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'flagged',
          appeal_count: 0,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: true,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingAppeal('listing-1', 'seller-1', validAppealReason)).rejects.toThrow(
      'Only rejected listings can be appealed'
    );
  });

  it('rejects appeal for non-owner', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 2,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: true,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingAppeal('listing-1', 'seller-2', validAppealReason)).rejects.toThrow(
      'You are not authorized to appeal this listing'
    );
  });

  it('rejects empty appeal reason', async () => {
    await expect(submitListingAppeal('listing-1', 'seller-1', '   ')).rejects.toThrow(
      'Appeal reason is required'
    );
  });

  it('rejects appeal when max attempts are reached', async () => {
    mockGetAdminConfig.mockResolvedValue({
      moderation_appeal_max_attempts: 2,
      moderation_appeal_window_days: 14,
    } as Awaited<ReturnType<typeof adminConfigService.getAdminConfig>>);

    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 2,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: true,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingAppeal('listing-1', 'seller-1', validAppealReason)).rejects.toThrow(
      'Appeal limit reached. Maximum allowed appeals: 2.'
    );
  });

  it('rejects appeal after appeal window expires', async () => {
    mockGetAdminConfig.mockResolvedValue({
      moderation_appeal_max_attempts: 3,
      moderation_appeal_window_days: 7,
    } as Awaited<ReturnType<typeof adminConfigService.getAdminConfig>>);

    const nineDaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 1,
          rejected_at: nineDaysAgo,
          edited_since_rejection: true,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingAppeal('listing-1', 'seller-1', validAppealReason)).rejects.toThrow(
      'Appeal window has expired. Appeals must be submitted within 7 days of rejection.'
    );
  });

  it('rejects appeal when listing was not edited after rejection', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 1,
          rejected_at: new Date().toISOString(),
          edited_since_rejection: false,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingAppeal('listing-1', 'seller-1', validAppealReason)).rejects.toThrow(
      'Please edit your listing before submitting an appeal.'
    );
  });

  it('falls back when edited-tracking columns are missing and still submits appeal', async () => {
    const fetchWithNewColumnsBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'edited_since_rejection' column of 'items' in the schema cache",
        },
      }),
    } as any;

    const fetchFallbackBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'rejected',
          appeal_count: 1,
          rejected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any;

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-1',
          seller_id: 'seller-1',
          status: 'flagged',
          appeal_count: 1,
          appeal_reason: validAppealReason,
        },
        error: null,
      }),
    } as any;

    mockSupabase.from
      .mockReturnValueOnce(fetchWithNewColumnsBuilder)
      .mockReturnValueOnce(fetchFallbackBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await submitListingAppeal('listing-1', 'seller-1', validAppealReason);

    expect(result.status).toBe('flagged');
    expect(fetchWithNewColumnsBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('edited_since_rejection')
    );
    expect(fetchFallbackBuilder.select).toHaveBeenCalledWith(
      expect.not.stringContaining('edited_since_rejection')
    );
  });
});

describe('submitListingNeedsEditsReReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions needs_edits listing to pending for owner after edits', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'needs_edits',
          edited_since_rejection: true,
          rejected_at: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any;

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'pending',
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

    const result = await submitListingNeedsEditsReReview('listing-2', 'seller-2');

    expect(result.status).toBe('pending');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        edited_since_rejection: false,
        edited_since_rejection_at: null,
      })
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'listing_resubmitted_for_review',
      expect.objectContaining({ listing_id: 'listing-2', seller_id: 'seller-2' })
    );
  });

  it('rejects re-review submission when no edits were made', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'needs_edits',
          edited_since_rejection: false,
          rejected_at: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any;

    mockSupabase.from.mockReturnValueOnce(fetchBuilder);

    await expect(submitListingNeedsEditsReReview('listing-2', 'seller-2')).rejects.toThrow(
      'Please make at least one edit before submitting for re-review.'
    );
  });

  it('falls back to timestamp-based edit detection when edited-tracking columns are missing', async () => {
    const fetchWithNewColumnsBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'edited_since_rejection' column of 'items' in the schema cache",
        },
      }),
    } as any;

    const fetchFallbackBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'needs_edits',
          flagged_at: '2026-04-24T10:00:00.000Z',
          rejected_at: null,
          created_at: '2026-04-23T10:00:00.000Z',
          updated_at: '2026-04-24T11:00:00.000Z',
        },
        error: null,
      }),
    } as any;

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'pending',
        },
        error: null,
      }),
    } as any;

    mockSupabase.from
      .mockReturnValueOnce(fetchWithNewColumnsBuilder)
      .mockReturnValueOnce(fetchFallbackBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await submitListingNeedsEditsReReview('listing-2', 'seller-2');

    expect(result.status).toBe('pending');
    expect(fetchFallbackBuilder.select).toHaveBeenCalledWith(expect.stringContaining('flagged_at'));
  });

  it('retries status update when first resubmission response does not return pending', async () => {
    const fetchBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'needs_edits',
          edited_since_rejection: true,
          rejected_at: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any;

    const firstUpdateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'needs_edits',
        },
        error: null,
      }),
    } as any;

    const secondUpdateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'listing-2',
          seller_id: 'seller-2',
          status: 'pending',
        },
        error: null,
      }),
    } as any;

    mockSupabase.from
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(firstUpdateBuilder)
      .mockReturnValueOnce(secondUpdateBuilder);

    const result = await submitListingNeedsEditsReReview('listing-2', 'seller-2');

    expect(result.status).toBe('pending');
    expect(secondUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        appeal_count: 1,
      })
    );
  });
});
