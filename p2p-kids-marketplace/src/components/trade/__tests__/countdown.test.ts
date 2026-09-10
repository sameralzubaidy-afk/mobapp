import {
  AUTO_COMPLETE_URGENT_MINUTES,
  createCountdownModel,
  formatCountdownLabel,
  isAutoCompleteUrgent,
} from '../countdown';

describe('trade countdown helpers', () => {
  const now = Date.parse('2026-01-01T10:00:00.000Z');

  it('returns critical urgency when under 2 hours remain', () => {
    const model = createCountdownModel(
      '2026-01-01T11:30:00.000Z',
      '2026-01-01T08:00:00.000Z',
      now
    );

    expect(model.expired).toBe(false);
    expect(model.urgency).toBe('critical');
    expect(formatCountdownLabel(model)).toContain('h');
  });

  it('returns warning urgency when under 6 hours remain', () => {
    const model = createCountdownModel(
      '2026-01-01T15:00:00.000Z',
      '2026-01-01T08:00:00.000Z',
      now
    );

    expect(model.expired).toBe(false);
    expect(model.urgency).toBe('warning');
  });

  it('returns expired model when target time has passed', () => {
    const model = createCountdownModel(
      '2026-01-01T09:00:00.000Z',
      '2026-01-01T08:00:00.000Z',
      now
    );

    expect(model.expired).toBe(true);
    expect(model.percentLeft).toBe(0);
    expect(formatCountdownLabel(model)).toBe('Expired');
  });

  it('omitSuffix drops the trailing " left" (DEV-TASK-113 item 7)', () => {
    const model = createCountdownModel(
      '2026-01-01T12:00:00.000Z',
      '2026-01-01T08:00:00.000Z',
      now
    );

    expect(formatCountdownLabel(model)).toBe('2h left');
    expect(formatCountdownLabel(model, { omitSuffix: true })).toBe('2h');
  });

  // FIX-Task-13 item 2 (2026-09-10): the AutoCompleteBanner's urgent threshold is
  // exported from THIS module so editing countdown thresholds can no longer
  // silently miss the banner (it used to hard-code `minutesLeft < 240`).
  describe('isAutoCompleteUrgent (AutoCompleteBanner 2-band cut)', () => {
    const modelAt = (targetIso: string) =>
      createCountdownModel(targetIso, '2026-01-01T08:00:00.000Z', now);

    it('exposes the shared 4h threshold', () => {
      expect(AUTO_COMPLETE_URGENT_MINUTES).toBe(240);
    });

    it('is NOT urgent at 5h (normal) even though it is inside the 6h warning band edge', () => {
      expect(isAutoCompleteUrgent(modelAt('2026-01-01T15:00:00.000Z'))).toBe(false);
    });

    it('keeps the 2-band cut distinct from the shared 4-band model at 6h', () => {
      const sixHours = modelAt('2026-01-01T16:00:00.000Z');
      // Shared model: 6h is the `warning` band…
      expect(sixHours.urgency).toBe('warning');
      // …but the banner's own cut is < 4h, so it stays in its normal band.
      expect(isAutoCompleteUrgent(sixHours)).toBe(false);
    });

    it('is urgent at 3h and once expired', () => {
      expect(isAutoCompleteUrgent(modelAt('2026-01-01T13:00:00.000Z'))).toBe(true);
      expect(isAutoCompleteUrgent(modelAt('2026-01-01T09:00:00.000Z'))).toBe(true);
    });

    it('treats a missing model as not urgent', () => {
      expect(isAutoCompleteUrgent(null)).toBe(false);
      expect(isAutoCompleteUrgent(undefined)).toBe(false);
    });
  });
});
