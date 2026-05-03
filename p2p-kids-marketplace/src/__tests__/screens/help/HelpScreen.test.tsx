// FILE: p2p-kids-marketplace/src/__tests__/screens/help/HelpScreen.test.tsx
// MODULE-18 EDU-005: HelpScreen component unit tests

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HelpScreen from '../../../screens/help/HelpScreen';
import * as educationContentService from '../../../services/educationContentService';
import * as educationAnalyticsService from '../../../services/educationAnalyticsService';

// Mock services
jest.mock('../../../services/educationContentService');
jest.mock('../../../services/educationAnalyticsService');
jest.mock('../../../services/categoryService');
jest.mock('../../../services/spCalculatorService');

const mockSections = [
  {
    id: '1',
    title: 'What are Swap Points?',
    body: 'Swap Points (SP) are the fun, safe currency kids use to trade items without cash. You earn SP when you sell and can use SP to buy!',
    image_url: null,
    display_order: 1,
    section_type: 'sp_definition',
    is_published: true,
    published_at: '2026-04-20T00:00:00Z',
    created_at: '2026-04-20T00:00:00Z',
  },
  {
    id: '2',
    title: 'How do I earn SP?',
    body: 'When you sell an item, you earn Swap Points! Different categories earn different amounts. Bonus categories earn extra SP!',
    image_url: null,
    display_order: 2,
    section_type: 'sp_earning',
    is_published: true,
    published_at: '2026-04-20T00:00:00Z',
    created_at: '2026-04-20T00:00:00Z',
  },
];

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockRoute = {
  params: {},
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('HelpScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
    (educationContentService.getPublishedSections as jest.Mock).mockResolvedValue(mockSections);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    );
  };

  it('renders correctly with all sections', async () => {
    const { getByText, getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('help-screen')).toBeTruthy();
      expect(getByText('How Trading Works')).toBeTruthy();
      expect(getByText(/Learn how to trade safely/)).toBeTruthy();
    });
  });

  it('loads and displays published sections', async () => {
    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(educationContentService.getPublishedSections).toHaveBeenCalled();
      expect(getByTestId('help-section-sp_definition-header')).toBeTruthy();
      expect(getByTestId('help-section-sp_earning-header')).toBeTruthy();
    });
  });

  it('tracks help_view analytics event on mount', async () => {
    renderWithProviders(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith('help_view', {});
    });
  });

  it('sp_definition section is expanded by default', async () => {
    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('help-section-sp_definition-content')).toBeTruthy();
    });
  });

  it('handles deep link to specific section', async () => {
    const deepLinkRoute = {
      params: { section: 'sp_earning' },
    };

    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={deepLinkRoute} />
    );

    await waitFor(() => {
      // Section should be expanded
      expect(getByTestId('help-section-sp_earning-content')).toBeTruthy();
    });
  });

  it('displays SP calculator', async () => {
    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('help-sp-calculator')).toBeTruthy();
    });
  });

  it('displays bonus categories list', async () => {
    const { getByTestID } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestID('help-bonus-categories')).toBeTruthy();
    });
  });

  it('handles pull-to-refresh', async () => {
    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('help-refresh-control')).toBeTruthy();
    });

    const refreshControl = getByTestId('help-refresh-control');
    fireEvent(refreshControl, 'refresh');

    await waitFor(() => {
      expect(educationContentService.getPublishedSections).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates back when back button pressed', async () => {
    const { getByTestId } = renderWithProviders(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByTestId('help-back-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('help-back-button'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays error message on load failure', async () => {
    (educationContentService.getPublishedSections as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

    renderWithProviders(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to load help content. Please try again.'
      );
    });

    alertSpy.mockRestore();
  });
});
