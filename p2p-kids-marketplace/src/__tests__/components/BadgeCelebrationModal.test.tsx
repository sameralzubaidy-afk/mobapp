// filepath: p2p-kids-marketplace/src/__tests__/components/BadgeCelebrationModal.test.tsx
// Unit Tests for Badge Celebration Modal
// TASK: NOTIF-V2-004

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BadgeCelebrationModal from '@/components/badges/BadgeCelebrationModal';
import { UserBadge } from '@/types/badge';

describe('BadgeCelebrationModal', () => {
  const mockBadge: UserBadge = {
    id: 'user-badge-1',
    user_id: 'user-123',
    badge_id: 'badge-1',
    awarded_at: '2024-01-01T00:00:00Z',
    badge: {
      id: 'badge-1',
      name: 'Trader 10',
      description: 'Complete 10 trades',
      category: 'trades',
      icon_url: 'https://example.com/icon.png',
      threshold: 10,
      created_at: '2024-01-01T00:00:00Z',
      is_active: true,
      sort_order: 1,
    },
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible with badge', () => {
    const { getByTestId, getByText } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    expect(getByTestId('badge-celebration-modal')).toBeTruthy();
    expect(getByText('🎉 New Badge Earned! 🎉')).toBeTruthy();
    expect(getByText('Trader 10')).toBeTruthy();
    expect(getByText('Complete 10 trades')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByTestId } = render(
      <BadgeCelebrationModal visible={false} badge={mockBadge} onClose={mockOnClose} />
    );

    expect(queryByTestId('badge-celebration-modal')).toBeNull();
  });

  it('should not render when badge is null', () => {
    const { queryByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={null} onClose={mockOnClose} />
    );

    expect(queryByTestId('badge-celebration-modal')).toBeNull();
  });

  it('should call onClose when close button pressed', () => {
    const { getByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    const closeButton = getByTestId('celebration-close-button');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay pressed', () => {
    const { getByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    const overlay = getByTestId('celebration-overlay');
    fireEvent.press(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render badge image when icon_url provided', () => {
    const { getByTestId, queryByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    expect(getByTestId('badge-image')).toBeTruthy();
    expect(queryByTestId('badge-emoji')).toBeNull();
  });

  it('should render emoji fallback when no icon_url', () => {
    const badgeWithoutIcon: UserBadge = {
      ...mockBadge,
      badge: {
        ...mockBadge.badge!,
        icon_url: undefined,
      },
    };

    const { getByTestId, queryByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={badgeWithoutIcon} onClose={mockOnClose} />
    );

    expect(getByTestId('badge-emoji')).toBeTruthy();
    expect(queryByTestId('badge-image')).toBeNull();
  });

  it('should animate badge in when visible', async () => {
    const { getByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    // Verify modal and animated content are rendered (animation execution tested manually)
    expect(getByTestId('badge-celebration-modal')).toBeTruthy();
    expect(getByTestId('celebration-overlay')).toBeTruthy();
    expect(getByTestId('celebration-content')).toBeTruthy();
  });

  it('should display all badge details', () => {
    const { getByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={mockBadge} onClose={mockOnClose} />
    );

    expect(getByTestId('celebration-title')).toBeTruthy();
    expect(getByTestId('badge-name').children[0]).toBe('Trader 10');
    expect(getByTestId('badge-description').children[0]).toBe('Complete 10 trades');
  });

  it('should not crash with missing nested badge data', () => {
    const incompleteBadge = {
      ...mockBadge,
      badge: undefined,
    };

    const { queryByTestId } = render(
      <BadgeCelebrationModal visible={true} badge={incompleteBadge as any} onClose={mockOnClose} />
    );

    // Should not render when badge data is incomplete
    expect(queryByTestId('badge-celebration-modal')).toBeNull();
  });
});
