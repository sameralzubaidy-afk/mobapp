import { createCountdownModel, formatCountdownLabel } from '../countdown';

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
});
