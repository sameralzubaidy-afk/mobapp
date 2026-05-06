import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OnboardingCarousel from '../OnboardingCarousel';
import * as educationContentService from '@/services/educationContentService';

jest.mock('@/services/educationContentService');
const mockGetSectionByType = educationContentService.getSectionByType as jest.MockedFunction<
  typeof educationContentService.getSectionByType
>;

describe('OnboardingCarousel FLOW-02', () => {
  const onComplete = jest.fn();
  const onSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSectionByType.mockResolvedValue(null);
  });

  it('renders carousel container and pagination ids', async () => {
    const { getByTestId } = render(<OnboardingCarousel onComplete={onComplete} onSkip={onSkip} />);

    expect(getByTestId('onboarding-carousel')).toBeTruthy();
    expect(getByTestId('onboarding-pagination-dots')).toBeTruthy();
    expect(getByTestId('onboarding-dot-0')).toBeTruthy();
    expect(getByTestId('onboarding-dot-4')).toBeTruthy();

    await waitFor(() => {
      expect(mockGetSectionByType).toHaveBeenCalledWith('sp_definition');
    });
  });

  it('triggers onSkip when skip button is pressed', () => {
    const { getByTestId } = render(<OnboardingCarousel onComplete={onComplete} onSkip={onSkip} />);

    fireEvent.press(getByTestId('skip-button'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
