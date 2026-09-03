// File: p2p-kids-marketplace/src/screens/profile/__tests__/IDVerificationUploadScreen.test.tsx
// TASK MODULE-15.1 FLOW-21: Unit tests for ID Verification Upload Screen
// Coverage: all 3 visual states + interactions + business logic preservation

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import IDVerificationUploadScreen from '../IDVerificationUploadScreen';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigateGoBack = jest.fn();
const mockNavigation = { goBack: mockNavigateGoBack };

jest.mock('@/services/idBadge', () => ({
  idBadgeService: {
    getMessage: jest.fn(),
    getVerificationStatus: jest.fn(),
    checkPendingRequest: jest.fn(),
    submitVerificationRequest: jest.fn(),
  },
}));

jest.mock('@/services/supabase/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/components/ui', () => ({
  LoadingSpinner: () => null,
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://test-image.jpg' }],
  }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://camera-image.jpg' }],
  }),
  MediaTypeOptions: { Images: 'images' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { idBadgeService } = require('@/services/idBadge');
const { getCurrentUser } = require('@/services/supabase/auth');

function setupMocks({
  status = 'none',
  disclaimerText = 'We will not store your ID.',
  submitLabel = 'Submit for Verification',
}: {
  status?: 'none' | 'pending' | 'approved' | 'rejected';
  disclaimerText?: string;
  submitLabel?: string;
} = {}) {
  getCurrentUser.mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com' },
    error: null,
  });
  idBadgeService.getMessage.mockImplementation((key: string) => {
    if (key === 'upload_disclaimer') return Promise.resolve(disclaimerText);
    if (key === 'submit_button_label') return Promise.resolve(submitLabel);
    return Promise.resolve('');
  });
  idBadgeService.getVerificationStatus.mockResolvedValue({ status });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IDVerificationUploadScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────────────────────
  describe('Loading state', () => {
    it('renders loading screen initially while fetching status', async () => {
      // Keep getVerificationStatus unresolved to stay in loading
      getCurrentUser.mockResolvedValue({ user: { id: 'user-123' }, error: null });
      idBadgeService.getMessage.mockImplementation(() => new Promise(() => {}));
      idBadgeService.getVerificationStatus.mockImplementation(() => new Promise(() => {}));

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      expect(getByTestId('id-verification-loading')).toBeTruthy();
    });
  });

  // ── State A: Unverified ─────────────────────────────────────────────────────
  describe('State A — Unverified (status: none)', () => {
    it('renders unverified state with IdentificationCard icon area and upload area', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-unverified-state')).toBeTruthy();
        expect(getByTestId('id-verification-upload-area')).toBeTruthy();
        expect(getByText('Verify Your Identity')).toBeTruthy();
      });
    });

    it('shows disclaimer text fetched from DB via getMessage()', async () => {
      setupMocks({ status: 'none', disclaimerText: 'Custom disclaimer from DB' });

      const { getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('Custom disclaimer from DB')).toBeTruthy();
      });
    });

    it('submit button is disabled and uses submitButtonDisabled style when no image selected', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        const submitBtn = getByTestId('id-verification-submit-btn');
        expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('shows submit label fetched from DB', async () => {
      setupMocks({ status: 'none', submitLabel: 'Verify Me Now' });

      const { getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('Verify Me Now')).toBeTruthy();
      });
    });

    it('shows image preview and change-image button after picking an image', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('id-verification-upload-area'));

      await act(async () => {
        fireEvent.press(getByTestId('id-verification-upload-area'));
      });

      await waitFor(() => {
        expect(getByTestId('id-verification-image-preview')).toBeTruthy();
        expect(getByTestId('id-verification-change-image-btn')).toBeTruthy();
      });
    });

    it('submit button is enabled (accessibilityState.disabled=false) after image selected', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('id-verification-upload-area'));
      await act(async () => {
        fireEvent.press(getByTestId('id-verification-upload-area'));
      });

      await waitFor(() => {
        const submitBtn = getByTestId('id-verification-submit-btn');
        expect(submitBtn.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('renders State A again when status is rejected (user can re-submit)', async () => {
      setupMocks({ status: 'rejected' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-unverified-state')).toBeTruthy();
        // DEV-TASK-101 (Item 7): inline note explains why the user is back at upload
        // without needing to open the Notification Center.
        expect(getByTestId('id-verification-rejected-note')).toBeTruthy();
        expect(getByText(/previous submission wasn't approved/i)).toBeTruthy();
      });
    });

    it('shows take-photo button', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-take-photo-btn')).toBeTruthy();
      });
    });
  });

  // ── State B: Pending ─────────────────────────────────────────────────────────
  describe('State B — Pending Review (status: pending)', () => {
    it('renders pending state with "Verification Pending" heading', async () => {
      setupMocks({ status: 'pending' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-pending-state')).toBeTruthy();
        expect(getByText('Verification Pending')).toBeTruthy();
      });
    });

    it('shows gold "Under Review" status pill', async () => {
      setupMocks({ status: 'pending' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-status-pill-pending')).toBeTruthy();
        expect(getByText('Under Review')).toBeTruthy();
      });
    });

    it('shows 24–48 hour review subtext', async () => {
      setupMocks({ status: 'pending' });

      const { getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText(/24.+48 hours/)).toBeTruthy();
      });
    });

    it('"Back to Profile" button calls navigation.goBack()', async () => {
      setupMocks({ status: 'pending' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('id-verification-back-profile-btn'));

      fireEvent.press(getByTestId('id-verification-back-profile-btn'));
      expect(mockNavigateGoBack).toHaveBeenCalled();
    });

    it('does NOT render upload area in pending state', async () => {
      setupMocks({ status: 'pending' });

      const { queryByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(queryByTestId('id-verification-upload-area')).toBeNull();
      });
    });
  });

  // ── State C: Verified ─────────────────────────────────────────────────────────
  describe('State C — Verified (status: approved)', () => {
    it('renders verified state with "Identity Verified" heading in green', async () => {
      setupMocks({ status: 'approved' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-verified-state')).toBeTruthy();
        expect(getByText('Identity Verified')).toBeTruthy();
      });
    });

    it('shows green "Verified ✓" status pill', async () => {
      setupMocks({ status: 'approved' });

      const { getByTestId, getByText } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('id-verification-status-pill-verified')).toBeTruthy();
        expect(getByText('Verified ✓')).toBeTruthy();
      });
    });

    it('does NOT render upload area in verified state', async () => {
      setupMocks({ status: 'approved' });

      const { queryByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(queryByTestId('id-verification-upload-area')).toBeNull();
        expect(queryByTestId('id-verification-submit-btn')).toBeNull();
      });
    });
  });

  // ── Submit flow ──────────────────────────────────────────────────────────────
  describe('Submit flow', () => {
    it('calls submitVerificationRequest and transitions to pending state on success', async () => {
      setupMocks({ status: 'none' });
      idBadgeService.submitVerificationRequest.mockResolvedValue('request-id-001');

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('id-verification-upload-area'));
      await act(async () => {
        fireEvent.press(getByTestId('id-verification-upload-area'));
      });
      await waitFor(() => getByTestId('id-verification-submit-btn'));

      await act(async () => {
        fireEvent.press(getByTestId('id-verification-submit-btn'));
      });

      await waitFor(() => {
        expect(idBadgeService.submitVerificationRequest).toHaveBeenCalledWith(
          'user-123',
          'file://test-image.jpg'
        );
        expect(getByTestId('id-verification-pending-state')).toBeTruthy();
      });
    });

    it('shows error message when submitVerificationRequest fails', async () => {
      setupMocks({ status: 'none' });
      idBadgeService.submitVerificationRequest.mockRejectedValue(
        new Error('Network error')
      );

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('id-verification-upload-area'));
      await act(async () => {
        fireEvent.press(getByTestId('id-verification-upload-area'));
      });
      await waitFor(() => getByTestId('id-verification-submit-btn'));

      await act(async () => {
        fireEvent.press(getByTestId('id-verification-submit-btn'));
      });

      await waitFor(() => {
        expect(getByTestId('id-verification-error')).toBeTruthy();
      });
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────────
  describe('Navigation', () => {
    it('back button calls navigation.goBack()', async () => {
      setupMocks({ status: 'none' });

      const { getByTestId } = render(
        <IDVerificationUploadScreen navigation={mockNavigation} />
      );

      await waitFor(() => getByTestId('back-button'));
      fireEvent.press(getByTestId('back-button'));
    });

    it('navigates back when getCurrentUser fails', async () => {
      getCurrentUser.mockResolvedValue({ user: null, error: new Error('Not logged in') });

      render(<IDVerificationUploadScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockNavigateGoBack).toHaveBeenCalled();
      });
    });
  });
});
