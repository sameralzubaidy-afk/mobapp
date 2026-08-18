// FILE: p2p-kids-marketplace/src/screens/onboarding/__tests__/OnboardingScreen.test.tsx
// MODULE-18 V1 EDU-004: OnboardingScreen unit tests

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../OnboardingScreen';
import * as educationAnalyticsService from '../../../services/educationAnalyticsService';
import { AuthContext } from '../../../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';

// Mock dependencies
jest.mock('../../../services/educationAnalyticsService');
jest.mock('@react-navigation/native');

// MODULE-18 EDU-004 FIX: capture the carousel's props so tests can invoke the
// real onComplete/onSkip handlers (previously these were placeholder tests).
let mockCarouselProps: { onComplete: () => void; onSkip: () => void } | undefined;
jest.mock('../../../components/onboarding/OnboardingCarousel', () => {
  return function MockOnboardingCarousel(props: any) {
    mockCarouselProps = props;
    return null;
  };
});

const mockMarkOnboardingComplete =
  educationAnalyticsService.markOnboardingComplete as jest.MockedFunction<
    typeof educationAnalyticsService.markOnboardingComplete
  >;
const mockMarkOnboardingSkipped =
  educationAnalyticsService.markOnboardingSkipped as jest.MockedFunction<
    typeof educationAnalyticsService.markOnboardingSkipped
  >;
const mockTrackEducationEvent =
  educationAnalyticsService.trackEducationEvent as jest.MockedFunction<
    typeof educationAnalyticsService.trackEducationEvent
  >;

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockReplace = jest.fn();
const mockOnOnboardingFinished = jest.fn();
(useNavigation as jest.Mock).mockReturnValue({
  navigate: mockNavigate,
  reset: mockReset,
  replace: mockReplace,
});
(useRoute as jest.Mock).mockReturnValue({
  params: { onOnboardingFinished: mockOnOnboardingFinished },
});

describe('OnboardingScreen', () => {
  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
  };

  const mockAuthContext = {
    session: mockSession,
    isLoading: false,
    refreshSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkOnboardingComplete.mockResolvedValue(true);
    mockMarkOnboardingSkipped.mockResolvedValue(true);
    mockTrackEducationEvent.mockResolvedValue();
    mockCarouselProps = undefined;
  });

  const renderWithContext = (contextValue = mockAuthContext) => {
    return render(
      <AuthContext.Provider value={contextValue as any}>
        <OnboardingScreen />
      </AuthContext.Provider>
    );
  };

  describe('Analytics Tracking', () => {
    it('should track onboarding_start event on mount', async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockTrackEducationEvent).toHaveBeenCalledWith('onboarding_start');
      });
    });

    it('should track onboarding_start only once per mount', async () => {
      const { rerender } = renderWithContext();

      await waitFor(() => {
        expect(mockTrackEducationEvent).toHaveBeenCalledTimes(1);
      });

      // Rerender should not trigger another event
      rerender(
        <AuthContext.Provider value={mockAuthContext as any}>
          <OnboardingScreen />
        </AuthContext.Provider>
      );

      expect(mockTrackEducationEvent).toHaveBeenCalledTimes(1);
    });

    it('should not track event when userId is missing', () => {
      const contextWithoutUser = {
        ...mockAuthContext,
        session: null,
      };

      renderWithContext(contextWithoutUser);

      expect(mockTrackEducationEvent).not.toHaveBeenCalled();
    });
  });

  describe('Completion Flow', () => {
    it('should mark complete, navigate to Home, and flip the onboarding gate (tab bar) on completion', async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockCarouselProps).toBeDefined();
      });

      // Trigger the real "Get Started" handler from the carousel
      await mockCarouselProps!.onComplete();

      expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('test-user-123');
      expect(mockTrackEducationEvent).toHaveBeenCalledWith('onboarding_complete');
      expect(mockReplace).toHaveBeenCalledWith('Home');
      // MODULE-18 EDU-004 FIX: gate flip must fire so PersistentTabBar mounts immediately
      expect(mockOnOnboardingFinished).toHaveBeenCalledTimes(1);
    });

    it('should navigate to Home and flip the gate even if markOnboardingComplete fails', async () => {
      mockMarkOnboardingComplete.mockRejectedValue(new Error('Database error'));
      renderWithContext();

      await waitFor(() => {
        expect(mockCarouselProps).toBeDefined();
      });

      await mockCarouselProps!.onComplete();

      expect(mockReplace).toHaveBeenCalledWith('Home');
      expect(mockOnOnboardingFinished).toHaveBeenCalledTimes(1);
    });
  });

  describe('Skip Flow', () => {
    it('should mark skipped, navigate to Home, and flip the onboarding gate (tab bar) on skip', async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockCarouselProps).toBeDefined();
      });

      // Trigger the real "Skip" handler from the carousel
      await mockCarouselProps!.onSkip();

      expect(mockMarkOnboardingSkipped).toHaveBeenCalledWith('test-user-123');
      expect(mockTrackEducationEvent).toHaveBeenCalledWith('onboarding_skip');
      expect(mockReplace).toHaveBeenCalledWith('Home');
      // MODULE-18 EDU-004 FIX: gate flip must fire on Skip too — this is the bug fix
      expect(mockOnOnboardingFinished).toHaveBeenCalledTimes(1);
    });

    it('should navigate to Home and flip the gate even if markOnboardingSkipped fails', async () => {
      mockMarkOnboardingSkipped.mockRejectedValue(new Error('Database error'));
      renderWithContext();

      await waitFor(() => {
        expect(mockCarouselProps).toBeDefined();
      });

      await mockCarouselProps!.onSkip();

      expect(mockReplace).toHaveBeenCalledWith('Home');
      expect(mockOnOnboardingFinished).toHaveBeenCalledTimes(1);
    });

    it('should navigate to Home without crashing when no onOnboardingFinished callback is provided', async () => {
      (useRoute as jest.Mock).mockReturnValue({ params: undefined });
      renderWithContext();

      await waitFor(() => {
        expect(mockCarouselProps).toBeDefined();
      });

      await mockCarouselProps!.onSkip();

      expect(mockReplace).toHaveBeenCalledWith('Home');
      expect(mockOnOnboardingFinished).not.toHaveBeenCalled();
    });
  });
});
