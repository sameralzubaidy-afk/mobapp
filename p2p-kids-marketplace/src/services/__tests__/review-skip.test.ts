// Unit tests for skip review functionality - TASK REVIEW-004

import { skipReview } from '../review';

describe('skipReview', () => {
  it('should successfully skip review without saving to database', async () => {
    const params = {
      tradeId: 'trade-123',
      userId: 'user-456',
    };

    const result = await skipReview(params);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle skip with valid trade ID and user ID', async () => {
    const params = {
      tradeId: 'abc-def-ghi',
      userId: '123-456-789',
    };

    const result = await skipReview(params);

    expect(result.success).toBe(true);
  });

  it('should always return success (skip is non-blocking)', async () => {
    // Even with invalid IDs, skip should succeed (it only tracks analytics)
    const params = {
      tradeId: '',
      userId: '',
    };

    const result = await skipReview(params);

    expect(result.success).toBe(true);
  });

  it('should not throw errors during skip', async () => {
    const params = {
      tradeId: 'trade-123',
      userId: 'user-456',
    };

    await expect(skipReview(params)).resolves.not.toThrow();
  });

  it('should log skip event for analytics (console verification)', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const params = {
      tradeId: 'trade-123',
      userId: 'user-456',
    };

    await skipReview(params);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[skipReview] User skipped review',
      expect.objectContaining({
        tradeId: 'trade-123',
        userId: 'user-456',
      })
    );

    consoleSpy.mockRestore();
  });
});
