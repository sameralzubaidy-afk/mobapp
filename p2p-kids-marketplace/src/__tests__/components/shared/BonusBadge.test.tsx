/**
 * File: p2p-kids-marketplace/src/__tests__/components/shared/BonusBadge.test.tsx
 * TASK ADMIN-V3-007: Unit tests for BonusBadge component
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { BonusBadge } from '../../../components/shared/BonusBadge';

describe('BonusBadge Component', () => {
  it('renders custom icon when iconUrl provided', () => {
    const { getByTestId } = render(
      <BonusBadge iconUrl="https://example.com/badge.png" testID="bonus-badge" />
    );

    const badge = getByTestId('bonus-badge');
    expect(badge).toBeTruthy();
  });

  it('renders fallback emoji when no iconUrl', () => {
    const { getByTestId, getByText } = render(<BonusBadge testID="bonus-badge" />);

    const fallback = getByTestId('bonus-badge-fallback');
    expect(fallback).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('renders fallback emoji when icon image fails to load', () => {
    const { getByTestId, getByText } = render(
      <BonusBadge iconUrl="https://example.com/missing-badge.png" testID="bonus-badge" />
    );

    // Trigger load failure from the Image node rendered inside the badge.
    const rootBadge = getByTestId('bonus-badge');
    const imageNode = rootBadge.findByType(Image);
    fireEvent(imageNode, 'error', { nativeEvent: { error: '404' } });

    const fallback = getByTestId('bonus-badge-fallback');
    expect(fallback).toBeTruthy();
    expect(getByText('⭐')).toBeTruthy();
  });

  it('applies correct size styles', () => {
    const { getByTestId, rerender } = render(<BonusBadge size="small" testID="bonus-badge" />);

    let badge = getByTestId('bonus-badge-fallback');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ width: 16, height: 16 })])
    );

    rerender(<BonusBadge size="medium" testID="bonus-badge" />);
    badge = getByTestId('bonus-badge-fallback');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ width: 24, height: 24 })])
    );

    rerender(<BonusBadge size="large" testID="bonus-badge" />);
    badge = getByTestId('bonus-badge-fallback');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ width: 32, height: 32 })])
    );
  });

  it('applies custom style override', () => {
    const customStyle = { marginLeft: 16 };
    const { getByTestId } = render(<BonusBadge style={customStyle} testID="bonus-badge" />);

    const badge = getByTestId('bonus-badge-fallback');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining(customStyle)])
    );
  });
});
