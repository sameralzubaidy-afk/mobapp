// FILE: p2p-kids-marketplace/src/__tests__/components/education/BonusCategoryBadge-EDU-006.test.tsx
// MODULE-18 EDU-006: BonusCategoryBadge component unit tests

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BonusCategoryBadge } from '../../../components/education/BonusCategoryBadge';

describe('BonusCategoryBadge EDU-006', () => {
  it('renders with star emoji when no iconUrl provided', () => {
    const { getByTestId, getByText } = render(
      <BonusCategoryBadge testID="test-badge" />
    );

    expect(getByTestId('test-badge')).toBeTruthy();
    expect(getByTestId('test-badge-emoji')).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('renders with star emoji when iconUrl is null', () => {
    const { getByTestId, getByText } = render(
      <BonusCategoryBadge iconUrl={null} testID="test-badge" />
    );

    expect(getByTestId('test-badge-emoji')).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('renders image when valid iconUrl provided', () => {
    const { getByTestId, queryByTestId } = render(
      <BonusCategoryBadge iconUrl="https://example.com/bonus.png" testID="test-badge" />
    );

    expect(getByTestId('test-badge-image')).toBeTruthy();
    expect(queryByTestId('test-badge-emoji')).toBeNull();
  });

  it('falls back to emoji when image fails to load', async () => {
    const { getByTestId } = render(
      <BonusCategoryBadge iconUrl="https://example.com/broken.png" testID="test-badge" />
    );

    // Simulate image error
    const image = getByTestId('test-badge-image');
    fireEvent(image, 'error');

    // After error, should show emoji
    expect(getByTestId('test-badge-emoji')).toBeTruthy();
  });

  it('has correct accessibility properties', () => {
    const { getByTestId } = render(<BonusCategoryBadge testID="test-badge" />);

    const badge = getByTestId('test-badge');
    expect(badge.props.accessible).toBeTruthy();
    expect(badge.props.accessibilityLabel).toBe('Bonus category badge');
    expect(badge.props.accessibilityRole).toBe('image');
  });

  it('image has accessibilityIgnoresInvertColors', () => {
    const { getByTestId } = render(
      <BonusCategoryBadge iconUrl="https://example.com/bonus.png" testID="test-badge" />
    );

    const image = getByTestId('test-badge-image');
    expect(image.props.accessibilityIgnoresInvertColors).toBeTruthy();
  });
});
