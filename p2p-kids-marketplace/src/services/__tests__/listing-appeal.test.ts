import { submitListingAppeal } from '../listing';
import { supabase } from '../../config/supabase';
import { trackEvent } from '../analytics';

jest.mock('../../config/supabase');
jest.mock('../analytics');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;

describe('submitListingAppeal', () => {
  const validAppealReason = 'I fixed the safety concern and updated the listing details.';

  beforeEach(() => {
    jest.clearAllMocks();
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
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder);

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
});
