// File: p2p-kids-marketplace/src/screens/profile/__tests__/PrivacyPolicyScreen.test.tsx
// MODULE-13 SAFETY-011: Privacy Policy Screen Unit Tests

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PrivacyPolicyScreen from '../PrivacyPolicyScreen';
import { getPrivacyPolicyService } from '../../../services/privacyPolicy';
import { getQaPolicyLoadFailureMode } from '@/services/devTestingService';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
};

// Mock route
const mockRoute = {
  params: {},
};

// Mock service
jest.mock('../../../services/privacyPolicy');

// Mock QA toggle — fail-closed default so the real load path runs in tests.
jest.mock('@/services/devTestingService', () => ({
  getQaPolicyLoadFailureMode: jest.fn().mockResolvedValue('none'),
}));

// Mock Markdown
jest.mock('react-native-markdown-display', () => 'Markdown', { virtual: true });

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('PrivacyPolicyScreen', () => {
  let mockService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = {
      getCurrentPrivacyPolicy: jest.fn(),
      acceptPrivacyPolicy: jest.fn(),
    };
    (getPrivacyPolicyService as jest.Mock).mockReturnValue(mockService);
    // Fail-closed default so a toggle armed in a prior test never leaks (BP-60).
    (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('none');
  });

  describe('Loading State', () => {
    it('should show loading indicator initially', () => {
      mockService.getCurrentPrivacyPolicy.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      expect(getByTestId('privacy-policy-loading')).toBeTruthy();
    });
  });

  describe('Policy Display', () => {
    const mockPolicy = {
      id: 'policy-123',
      title: 'Privacy Policy',
      version: '1.0',
      content: '# Privacy Policy\n\nYour privacy matters...',
      effective_date: '2024-01-01',
    };

    it('should display privacy policy content', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const { getByTestId, getByText, getAllByText } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-content')).toBeTruthy();
      });

      expect(getAllByText('Privacy Policy').length).toBeGreaterThan(0);
      expect(getByText(/Last updated:/i)).toBeTruthy();
    });

    it('should display effective date', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-effective-date')).toBeTruthy();
      });
    });

    it('should render the effective date without a UTC→local day shift', async () => {
      // Stored 2024-01-01 must render as 1/1/2024 in every timezone.
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const { getByText } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(getByText('Last updated: 1/1/2024')).toBeTruthy();
      });
    });

    it('should display the policy version number (J03)', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const { getByTestId, getByText } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-version')).toBeTruthy();
        expect(getByText('Version 1.0')).toBeTruthy();
      });
    });

    it('should show accept button when requireAcceptance is true', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const route = {
        params: { requireAcceptance: true },
      };

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={route as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-accept-button')).toBeTruthy();
      });
    });

    it('should not show accept button when requireAcceptance is false', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);

      const { queryByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />
      );

      await waitFor(() => {
        expect(queryByTestId('privacy-policy-accept-button')).toBeNull();
      });
    });
  });

  describe('Error States', () => {
    it('should show error when policy not available', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(null);

      render(<PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Privacy Policy not available');
      });
    });

    it('should show error on load failure', async () => {
      mockService.getCurrentPrivacyPolicy.mockRejectedValue(new Error('Network error'));

      render(<PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load Privacy Policy');
      });
    });

    it('should show "not available" when QA no_policy toggle is armed (J07)', async () => {
      (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('no_policy');

      render(<PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Privacy Policy not available');
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('should show load-failure alert when QA fetch_failure toggle is armed (J08)', async () => {
      (getQaPolicyLoadFailureMode as jest.Mock).mockResolvedValue('fetch_failure');

      render(<PrivacyPolicyScreen navigation={mockNavigation as any} route={mockRoute as any} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load Privacy Policy');
      });
    });
  });

  describe('Acceptance Flow', () => {
    const mockPolicy = {
      id: 'policy-123',
      title: 'Privacy Policy',
      version: '1.0',
      content: '# Privacy Policy\n\nYour privacy matters...',
      effective_date: '2024-01-01',
    };

    it('should record acceptance and call onAccept callback', async () => {
      const mockOnAccept = jest.fn();
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
      mockService.acceptPrivacyPolicy.mockResolvedValue(undefined);

      const route = {
        params: { requireAcceptance: true, onAccept: mockOnAccept },
      };

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={route as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-accept-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('privacy-policy-accept-button'));

      await waitFor(() => {
        expect(mockService.acceptPrivacyPolicy).toHaveBeenCalledWith('policy-123');
        expect(mockOnAccept).toHaveBeenCalled();
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('should show success alert when acceptance not required', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
      mockService.acceptPrivacyPolicy.mockResolvedValue(undefined);

      const route = {
        params: { requireAcceptance: true },
      };

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={route as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-accept-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('privacy-policy-accept-button'));

      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('should show error on acceptance failure', async () => {
      mockService.getCurrentPrivacyPolicy.mockResolvedValue(mockPolicy);
      mockService.acceptPrivacyPolicy.mockRejectedValue(new Error('Database error'));

      const route = {
        params: { requireAcceptance: true },
      };

      const { getByTestId } = render(
        <PrivacyPolicyScreen navigation={mockNavigation as any} route={route as any} />
      );

      await waitFor(() => {
        expect(getByTestId('privacy-policy-accept-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('privacy-policy-accept-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to record acceptance. Please try again.'
        );
      });
    });
  });
});
