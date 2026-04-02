import { submitListingAppeal } from '../listing';
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
});
