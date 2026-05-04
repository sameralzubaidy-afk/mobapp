// FILE: p2p-kids-marketplace/src/__tests__/components/education/BonusCategoryBadge-EDU-006.test.tsx
// MODULE-18 EDU-006: BonusCategoryBadge component unit tests

import React from 'react';
import { render } from '@testing-library/react-native';
import { BonusCategoryBadge } from '../../../components/education/BonusCategoryBadge';

describe('BonusCategoryBadge EDU-006', () => {
  it('renders with star emoji when no iconUrl provided', () => {
    const { getByTestId, getByText } = render(
      <BonusCategoryBadge testID="test-badge" />
    );

    expect(getByTestID('test-badge')).toBeTruthy();
    expect(getByTestID('test-badge-emoji')).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('renders with star emoji when iconUrl is null', () => {
    const { getByTestID, getByText } = render(
      <BonusCategoryBadge iconUrl={null} testID="test-badge" />
    );

    expect(getByTestID('test-badge-emoji')).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('renders image when valid iconUrl provided', () => {
    const { getByTestID, queryByTestID } = render(
      <BonusCategoryBadge iconUrl="https://example.com/bonus.png" testID="test-badge" />
    );

    expect(getByTestID('test-badge-image')).toBeTruthy();
    expect(queryByTestID('test-badge-emoji')).toBeNull();
  });

  it('falls back to emoji when image fails to load', async () => {
    const { getByTestID, rerender } = render(
      <BonusCategoryBadge iconUrl="https://example.com/broken.png" testID="test-badge" />
    );

    // Simulate image error
    const image = getByTestID('test-badge-image');
    if (image.props.onError) {
      image.props.onError();
    }

    // Rerender to apply state change
    rerender(<BonusCategoryBadge iconUrl="https://example.com/broken.png" testID="test-badge" />);

    // After error, should show emoji
    expect(getByTestID('test-badge-emoji')).toBeTruthy();
  });

  it('has correct accessibility properties', () => {
    const { getByTestID } = render(<BonusCategoryBadge testID="test-badge" />);

    const badge = getByTestID('test-badge');
    expect(badge.props.accessible).toBeTruthy();
    expect(badge.props.accessibilityLabel).toBe('Bonus category badge');
    expect(badge.props.accessibilityRole).toBe('image');
  });

  it('image has accessibilityIgnoresInvertColors', () => {
    const { getByTestID } = render(
      <BonusCategoryBadge iconUrl="https://example.com/bonus.png" testID="test-badge" />
    );

    const image = getByTestID('test-badge-image');
    expect(image.props.accessibilityIgnoresInvertColors).toBeTruthy();
  });
});
