/**
 * File: p2p-kids-marketplace/src/components/ui/__tests__/CountBadge.test.tsx
 *
 * Shared numeric count badge:
 *  - renders nothing when count <= 0
 *  - renders the number
 *  - caps at 99+
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import CountBadge from '../CountBadge';

describe('CountBadge — shared count badge', () => {
  it('renders nothing when count is 0', () => {
    const { queryByText } = render(<CountBadge count={0} />);
    expect(queryByText('0')).toBeNull();
  });

  it('renders nothing when count is negative', () => {
    const { queryByText } = render(<CountBadge count={-1} />);
    expect(queryByText('-1')).toBeNull();
  });

  it('renders the numeric count', () => {
    const { getByText } = render(<CountBadge count={3} />);
    expect(getByText('3')).toBeTruthy();
  });

  it('caps the display at 99+', () => {
    const { getByText, queryByText } = render(<CountBadge count={150} />);
    expect(getByText('99+')).toBeTruthy();
    expect(queryByText('150')).toBeNull();
  });
});
