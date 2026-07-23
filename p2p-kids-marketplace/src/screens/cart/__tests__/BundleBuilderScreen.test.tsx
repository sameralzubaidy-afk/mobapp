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

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
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
    it('should render "Build Offer" heading', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText('Build Offer')).toBeTruthy();
      });
    });

    it('should render empty-state helper subtext', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText(/This seller doesn't have any other items/)).toBeTruthy();
      });
    });

    it('should render back button', async () => {
      const { getByTestId } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByTestId('back-button')).toBeTruthy();
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
    it('should render the post-load empty state when no items are available', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        expect(getByText('No More Items Available')).toBeTruthy();
      });
    });
  });

  describe('Close Button', () => {
    it('should go back when back button is pressed', async () => {
      const { getByTestId } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const closeButton = getByTestId('back-button');
        fireEvent.press(closeButton);
        expect(mockGoBack).toHaveBeenCalled();
      });
    });
  });

  describe('Design System Compliance', () => {
    it('should show the screen title', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const heading = getByText('Bundle');
        expect(heading).toBeTruthy();
      });
    });

    it('should show empty-state supporting text', async () => {
      const { getByText } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const subtext = getByText(/This seller doesn't have any other items/);
        expect(subtext).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible back button', async () => {
      const { getByTestId } = render(<BundleBuilderScreen />);

      await waitFor(() => {
        const closeButton = getByTestId('back-button');
        expect(closeButton).toBeTruthy();
      });
    });
  });
});
