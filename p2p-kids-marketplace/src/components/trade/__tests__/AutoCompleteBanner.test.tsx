import React from 'react';
import { render } from '@testing-library/react-native';
import AutoCompleteBanner from '../AutoCompleteBanner';

describe('AutoCompleteBanner', () => {
  it('renders banner for in-progress trade with auto-complete timestamp', () => {
    const { getByTestId, getByText } = render(
      <AutoCompleteBanner
        status="in_progress"
        autoCompleteAt="2026-01-02T10:00:00.000Z"
        nowMs={Date.parse('2026-01-01T10:00:00.000Z')}
      />
    );

    expect(getByTestId('auto-complete-banner')).toBeTruthy();
    // Component copy is mid-sentence ("Confirm pickup — auto-completes in …"), so match case-insensitively.
    expect(getByText(/auto-completes in/i)).toBeTruthy();
  });

  it('returns null when trade is not in progress', () => {
    const { queryByTestId } = render(
      <AutoCompleteBanner
        status="pending"
        autoCompleteAt="2026-01-02T10:00:00.000Z"
        nowMs={Date.parse('2026-01-01T10:00:00.000Z')}
      />
    );

    expect(queryByTestId('auto-complete-banner')).toBeNull();
  });

  // FIX-Task-13 items 2 + 5d (2026-09-10): urgency is no longer colour-alone —
  // the urgent band also renders a "Due soon" label (and a left accent bar).
  describe('non-colour urgency cue', () => {
    const renderAt = (autoCompleteAt: string, nowIso: string) =>
      render(
        <AutoCompleteBanner
          status="in_progress"
          autoCompleteAt={autoCompleteAt}
          nowMs={Date.parse(nowIso)}
        />
      );

    it('omits the cue in the normal band (5h left)', () => {
      const { queryByTestId } = renderAt('2026-01-01T15:00:00.000Z', '2026-01-01T10:00:00.000Z');
      expect(queryByTestId('auto-complete-urgency-pill')).toBeNull();
    });

    it('renders the cue in the urgent band (3h left)', () => {
      const { getByTestId, getByText } = renderAt(
        '2026-01-01T13:00:00.000Z',
        '2026-01-01T10:00:00.000Z'
      );
      expect(getByTestId('auto-complete-urgency-pill')).toBeTruthy();
      expect(getByText('Due soon')).toBeTruthy();
    });

    it('omits the cue once expired (the expired copy already says it)', () => {
      const { queryByTestId, getByText } = renderAt(
        '2026-01-01T09:00:00.000Z',
        '2026-01-01T10:00:00.000Z'
      );
      expect(queryByTestId('auto-complete-urgency-pill')).toBeNull();
      expect(getByText(/ready for auto-completion/i)).toBeTruthy();
    });
  });
});
