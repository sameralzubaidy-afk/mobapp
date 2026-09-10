// File: p2p-kids-marketplace/src/components/trade/__tests__/SafeMeetupCard.test.tsx
// FIX-Task-15 item 7 (2026-09-10): contract test for the state the card PUBLISHES
// to its host (the Trade Timeline), which reserves the expanded card's height for
// floating-tab-bar clearance.
//
// Why this exists: the first cut published the internal `collapsed` flag into a
// host state called `safeMeetupExpanded`, so the reserved space was added while
// the card was COLLAPSED and removed while it was EXPANDED — the exact inverse of
// the intent. Unit tests over the padding formula alone could not catch it (the
// formula was right; the wiring was wrong); this test pins the wiring itself.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeMeetupCard } from '../SafeMeetupCard';

describe('SafeMeetupCard — published expanded state (FIX-Task-15 item 7)', () => {
  it('publishes expanded=false while collapsed (the default for every trade)', async () => {
    const onExpandedChange = jest.fn();

    render(<SafeMeetupCard tradeId="trade-1" onExpandedChange={onExpandedChange} />);

    await waitFor(() => expect(onExpandedChange).toHaveBeenLastCalledWith(false));
  });

  it('publishes expanded=true when the pill expands the card', async () => {
    const onExpandedChange = jest.fn();
    const { getByTestId } = render(
      <SafeMeetupCard tradeId="trade-1" onExpandedChange={onExpandedChange} />
    );

    fireEvent.press(getByTestId('safe-meetup-toggle'));

    await waitFor(() => expect(onExpandedChange).toHaveBeenLastCalledWith(true));
    expect(getByTestId('safe-meetup-cta')).toBeTruthy();
  });

  it('publishes expanded=false again after the CTA dismisses the card', async () => {
    const onExpandedChange = jest.fn();
    const { getByTestId } = render(
      <SafeMeetupCard tradeId="trade-1" onExpandedChange={onExpandedChange} />
    );

    fireEvent.press(getByTestId('safe-meetup-toggle'));
    await waitFor(() => expect(getByTestId('safe-meetup-cta')).toBeTruthy());

    fireEvent.press(getByTestId('safe-meetup-cta'));

    await waitFor(() => expect(onExpandedChange).toHaveBeenLastCalledWith(false));
    expect(getByTestId('safe-meetup-toggle')).toBeTruthy();
  });
});
