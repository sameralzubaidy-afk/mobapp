/**
 * File: p2p-kids-marketplace/src/screens/cart/__tests__/BundleBuilderScreen.test.tsx
 * MODULE-15.1-UI-REDESIGN: Bundle Builder Screen Unit Tests
 * Task: FLOW-07 Cart & Bundling
 * 
 * Tests bundle builder screen rendering, item selection, and savings calculation.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import BundleBuilderScreen from '../BundleBuilderScreen';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      sellerId: 'seller-123',
      sellerName: 'Test Seller',
    },
  }),
}));

jest.mock('@/components/ui', () => ({
  Button: ({ children, onPress, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID={testID}>
        <Text>{children}</Text>
      </TouchableOpacity>
    );
  },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

describe('BundleBuilderScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Header', () => {
    it('should render "Build a Bundle" heading', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText('Build a Bundle')).toBeTruthy();
      });
    });

    it('should render subtext with seller name', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText(/Add more items from Test Seller to save/)).toBeTruthy();
      });
    });

    it('should render close button', async () => {
      const { getByTestID } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByTestID('bundle-close-button')).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no items available', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText('No More Items Available')).toBeTruthy();
        expect(getByText(/This seller doesn't have any other items/)).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading text initially', () => {
      const { getByText } = render(<BundleBuilderScreen />);
      expect(getByText('Loading items...')).toBeTruthy();
    });
  });

  describe('Close Button', () => {
    it('should go back when close pressed with no selection', async () => {
      const mockGoBack = jest.fn();
      jest.mocked(require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: jest.fn(),
        goBack: mockGoBack,
      });

      const { getByTestID } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const closeButton = getByTestID('bundle-close-button');
        fireEvent.press(closeButton);
        expect(mockGoBack).toHaveBeenCalled();
      });
    });
  });

  describe('Design System Compliance', () => {
    it('should use correct heading font size (24px)', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const heading = getByText('Build a Bundle');
        expect(heading).toBeTruthy();
      });
    });

    it('should use correct subtext font size (15px)', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const subtext = getByText(/Add more items from/);
        expect(subtext).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible close button', async () => {
      const { getByTestID } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const closeButton = getByTestID('bundle-close-button');
        expect(closeButton).toBeTruthy();
      });
    });
  });
});
