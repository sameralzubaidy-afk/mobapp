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
});
