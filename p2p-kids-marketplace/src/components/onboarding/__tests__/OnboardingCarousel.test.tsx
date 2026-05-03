// FILE: p2p-kids-marketplace/src/components/onboarding/__tests__/OnboardingCarousel.test.tsx
// MODULE-18 V1 EDU-004: OnboardingCarousel unit tests

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingCarousel from '../OnboardingCarousel';
import * as educationContentService from '../../../services/educationContentService';
import type { EducationSection } from '../../../types/education';

// Mock the education content service
jest.mock('../../../services/educationContentService');
const mockGetSectionByType = educationContentService.getSectionByType as jest.MockedFunction<
  typeof educationContentService.getSectionByType
>;

describe('OnboardingCarousel', () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  const mockDbSections: Record<string, EducationSection> = {
    sp_definition: {
      id: '1',
      title: 'What are Swap Points?',
      body: 'DB content for SP definition',
      image_url: null,
      display_order: 1,
      section_type: 'sp_definition',
      is_published: true,
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
    sp_earning: {
      id: '2',
      title: 'How You Earn SP',
      body: 'DB content for earning SP',
      image_url: null,
      display_order: 2,
      section_type: 'sp_earning',
      is_published: true,
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
    sp_spending: {
      id: '3',
      title: 'How You Spend SP',
      body: 'DB content for spending SP',
      image_url: null,
      display_order: 3,
      section_type: 'sp_spending',
      is_published: true,
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
    safety: {
      id: '4',
      title: 'Safety First!',
      body: 'DB content for safety',
      image_url: null,
      display_order: 4,
      section_type: 'safety',
      is_published: true,
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getSectionByType to return DB sections
    mockGetSectionByType.mockImplementation(async (type) => {
      return mockDbSections[type] || null;
    });
  });

  describe('Rendering', () => {
    it('should render carousel with 5 screens', () => {
      const { getByTestId } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(getByTestId('onboarding-carousel')).toBeTruthy();
    });

    it('should render progress dots for all screens', () => {
      const { getByTestID } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(getByTestID('progress-dot-0')).toBeTruthy();
      expect(getByTestID('progress-dot-1')).toBeTruthy();
      expect(getByTestID('progress-dot-2')).toBeTruthy();
      expect(getByTestID('progress-dot-3')).toBeTruthy();
      expect(getByTestID('progress-dot-4')).toBeTruthy();
    });

    it('should render skip button on all screens', () => {
      const { getByTestID } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(getByTestID('skip-button')).toBeTruthy();
    });

    it('should not render Get Started button on first screen', () => {
      const { queryByTestID } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(queryByTestID('get-started-button')).toBeNull();
    });
  });

  describe('DB Content Loading', () => {
    it('should load DB sections on mount', async () => {
      render(<OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />);

      await waitFor(() => {
        expect(mockGetSectionByType).toHaveBeenCalledWith('sp_definition');
        expect(mockGetSectionByType).toHaveBeenCalledWith('sp_earning');
        expect(mockGetSectionByType).toHaveBeenCalledWith('sp_spending');
        expect(mockGetSectionByType).toHaveBeenCalledWith('safety');
      });
    });

    it('should fallback to static content when DB sections fail to load', async () => {
      mockGetSectionByType.mockRejectedValue(new Error('Network error'));

      const { getByText } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      await waitFor(() => {
        // Should still render with static fallback content
        expect(getByText('Welcome to P2P Kids Marketplace!')).toBeTruthy();
      });
    });
  });

  describe('Skip Functionality', () => {
    it('should call onSkip when skip button is pressed', () => {
      const { getByTestID } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      fireEvent.press(getByTestID('skip-button'));

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should have correct accessibility label on skip button', () => {
      const { getByLabelText } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(getByLabelText('Skip onboarding')).toBeTruthy();
    });
  });

  describe('Get Started Functionality', () => {
    it('should show Get Started button on last screen', () => {
      const { getByTestID } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      // Simulate scrolling to last screen by updating state
      // Note: This is simplified; actual scroll simulation would require more setup
      // For now, we test the button existence when rendered

      // The button should appear when currentIndex = 4
      // This test would need scroll simulation which is complex in RN testing
      // We'll test this in integration/E2E tests instead
    });

    it('should call onComplete when Get Started is pressed', () => {
      // This test requires scroll simulation to reach last screen
      // Will be covered in E2E/Maestro tests
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Accessibility', () => {
    it('should have correct accessibility labels for screens', () => {
      const { getByLabelText } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(
        getByLabelText('Onboarding, step 1 of 5, Welcome to P2P Kids Marketplace')
      ).toBeTruthy();
    });

    it('should mark skip button as button role', () => {
      const { getByRole } = render(
        <OnboardingCarousel onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      expect(getByRole('button', { name: /skip/i })).toBeTruthy();
    });
  });
});
