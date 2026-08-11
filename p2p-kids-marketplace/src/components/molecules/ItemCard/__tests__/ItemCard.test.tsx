// File: p2p-kids-marketplace/src/components/molecules/ItemCard/__tests__/ItemCard.test.tsx
// Unit tests for ItemCard component (MODULE-15.1-UI-REDESIGN FLOW-06 Discovery)

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ItemCard from '../index';

// Mock Phosphor icons
jest.mock('phosphor-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Heart: ({ size, color, weight, testID }: any) =>
      React.createElement(View, {
        testID: testID || 'heart-icon',
        accessible: true,
        accessibilityLabel: 'Heart',
        size,
        color,
        weight,
      }),
    HeartStraight: ({ size, color, weight, testID }: any) =>
      React.createElement(View, {
        testID: testID || 'heart-filled-icon',
        accessible: true,
        accessibilityLabel: 'HeartStraight',
        size,
        color,
        weight,
      }),
    Share: ({ size, color, weight, testID }: any) =>
      React.createElement(View, {
        testID: testID || 'share-icon',
        accessible: true,
        accessibilityLabel: 'Share',
        size,
        color,
        weight,
      }),
  };
});

// Mock ListingImage + AcceptsSpBadge
jest.mock('@/components/atoms', () => ({
  ListingImage: ({ url, testID }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, {
      testID: testID || 'listing-image',
      accessible: true,
      accessibilityLabel: url || 'No image',
    });
  },
  // DISCOVER-REDESIGN: gold "Accepts SP" badge (design-system §6.7) replaced the
  // old inline "SP ✓" text.
  AcceptsSpBadge: ({ testID }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: testID || 'accepts-sp-badge' }, 'Accepts SP');
  },
}));

describe('ItemCard Component', () => {
  const defaultProps = {
    id: 'test-item-123',
    title: 'Test Item Title',
    price: 29.99,
    imageUrl: 'https://example.com/image.jpg',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // TC-ITEMCARD-001: Renders Required Props
  // ============================================
  it('should render title, price, and image with required props', () => {
    const { getByText, getByTestId } = render(<ItemCard {...defaultProps} />);

    expect(getByText('Test Item Title')).toBeTruthy();
    expect(getByText('$29.99')).toBeTruthy();
    expect(getByTestId('listing-image')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-002: onPress Handler
  // ============================================
  it('should call onPress when card is pressed', () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(<ItemCard {...defaultProps} onPress={mockOnPress} />);

    const card = getByTestId('item-card-test-item-123');
    fireEvent.press(card);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // TC-ITEMCARD-003: Favorite Button (Not Favorited)
  // ============================================
  it('should render Heart icon when item is not favorited', () => {
    const { getByTestId } = render(
      <ItemCard {...defaultProps} isFavorite={false} onFavoritePress={jest.fn()} />
    );

    // Heart icon should be present (unfilled)
    expect(getByTestId('heart-icon')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-004: Favorite Button (Favorited)
  // ============================================
  it('should render HeartStraight icon when item is favorited', () => {
    const { getByTestId } = render(
      <ItemCard {...defaultProps} isFavorite={true} onFavoritePress={jest.fn()} />
    );

    // HeartStraight icon should be present (filled)
    expect(getByTestId('heart-filled-icon')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-005: Favorite Button Press Handler
  // ============================================
  it('should call onFavoritePress when favorite button is pressed', () => {
    const mockOnFavoritePress = jest.fn();
    const { getByTestId } = render(
      <ItemCard {...defaultProps} isFavorite={false} onFavoritePress={mockOnFavoritePress} />
    );

    const favoriteButton = getByTestId('test-item-123-favorite-button');
    fireEvent.press(favoriteButton);

    expect(mockOnFavoritePress).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // TC-ITEMCARD-006: Share Button
  // ============================================
  it('should render Share icon when onSharePress is provided', () => {
    const { getByTestId } = render(
      <ItemCard {...defaultProps} onSharePress={jest.fn()} />
    );

    expect(getByTestId('share-icon')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-007: Share Button Press Handler
  // ============================================
  it('should call onSharePress when share button is pressed', () => {
    const mockOnSharePress = jest.fn();
    const { getByTestId } = render(
      <ItemCard {...defaultProps} onSharePress={mockOnSharePress} />
    );

    const shareButton = getByTestId('test-item-123-share-button');
    fireEvent.press(shareButton);

    expect(mockOnSharePress).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // TC-ITEMCARD-008: SP Badge Display
  // ============================================
  it('should render SP badge when acceptsSwapPoints is true', () => {
    const { getByText } = render(
      <ItemCard {...defaultProps} acceptsSwapPoints={true} />
    );

    expect(getByText('Accepts SP')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-009: No SP Badge
  // ============================================
  it('should not render SP badge when acceptsSwapPoints is false', () => {
    const { queryByText } = render(
      <ItemCard {...defaultProps} acceptsSwapPoints={false} />
    );

    expect(queryByText('Accepts SP')).toBeNull();
  });

  // ============================================
  // TC-ITEMCARD-010: Null Image URL
  // ============================================
  it('should render placeholder when imageUrl is null', () => {
    const { getByTestId } = render(<ItemCard {...defaultProps} imageUrl={null} />);
    const image = getByTestId('listing-image');

    expect(image).toBeTruthy();
    expect(image.props.accessibilityLabel).toBe('No image');
  });

  // ============================================
  // TC-ITEMCARD-011: Price Formatting
  // ============================================
  it('should format price correctly with 2 decimal places', () => {
    const { getByText, rerender } = render(<ItemCard {...defaultProps} price={10} />);
    expect(getByText('$10.00')).toBeTruthy();

    rerender(<ItemCard {...defaultProps} price={99.5} />);
    expect(getByText('$99.50')).toBeTruthy();

    rerender(<ItemCard {...defaultProps} price={0.99} />);
    expect(getByText('$0.99')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-012: Long Title Truncation
  // ============================================
  it('should render long titles without breaking layout', () => {
    const longTitle = 'This is a very long item title that should be handled gracefully by the component without breaking the 2-column grid layout';
    const { getByText } = render(<ItemCard {...defaultProps} title={longTitle} />);

    expect(getByText(longTitle)).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-013: testID Prop
  // ============================================
  it('should use custom testID when provided', () => {
    const { getByTestId } = render(<ItemCard {...defaultProps} testID="custom-test-id" />);

    expect(getByTestId('custom-test-id')).toBeTruthy();
  });

  // ============================================
  // TC-ITEMCARD-014: No Overlay Buttons When Handlers Not Provided
  // ============================================
  it('should not render favorite button when onFavoritePress is not provided', () => {
    const { queryByTestId } = render(<ItemCard {...defaultProps} />);

    expect(queryByTestId('test-item-123-favorite-button')).toBeNull();
  });

  it('should not render share button when onSharePress is not provided', () => {
    const { queryByTestId } = render(<ItemCard {...defaultProps} />);

    expect(queryByTestId('test-item-123-share-button')).toBeNull();
  });
});
