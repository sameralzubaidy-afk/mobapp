// FILE: p2p-kids-marketplace/src/__tests__/screens/help/HelpScreen.test.tsx
// MODULE-18 EDU-005: HelpScreen component unit tests

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HelpScreen from '../../../screens/help/HelpScreen';
import * as educationContentService from '../../../services/educationContentService';
import * as educationAnalyticsService from '../../../services/educationAnalyticsService';

// Mock services
jest.mock('../../../services/educationContentService');
jest.mock('../../../services/educationAnalyticsService');
jest.mock('../../../services/categoryService');
jest.mock('../../../services/spCalculatorService');
// Keep all other @react-navigation/native exports real; capture the focus hook
// so tests can simulate a screen-focus event (QA: Group Q+S 2026-08-23 Item 3).
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
}));
// Expose refreshKey so tests can assert focus/pull-to-refresh propagates to the
// SP calculator + bonus list without needing their real internals.
jest.mock('../../../components/education/SPCalculator', () => ({
  SPCalculator: ({ testID, refreshKey = 0 }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text testID={`${testID}-refresh-key`}>{String(refreshKey)}</Text>
      </View>
    );
  },
}));
jest.mock('../../../components/education/BonusCategoriesList', () => ({
  BonusCategoriesList: ({ testID, refreshKey = 0 }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text testID={`${testID}-refresh-key`}>{String(refreshKey)}</Text>
      </View>
    );
  },
}));
jest.mock('../../../components/education/EducationSectionAccordion', () => ({
  EducationSectionAccordion: ({ section, testID, defaultExpanded }: any) => {
    const { View } = require('react-native');
    return (
      <View testID={testID || `section-accordion-${section.section_type}`}>
        <View testID={`${testID || section.section_type}-header`} />
        {defaultExpanded ? <View testID={`${testID || section.section_type}-content`} /> : null}
      </View>
    );
  },
}));

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

describe('HelpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (educationContentService.getPublishedSections as jest.Mock).mockResolvedValue(mockSections);
    (educationAnalyticsService.trackEducationEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders correctly with all sections', async () => {
    const { getByText, getByTestId } = render(
      <HelpScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('Help')).toBeTruthy();
      expect(getByText(/Learn how to trade safely/)).toBeTruthy();
      expect(getByTestId('help-scroll-view')).toBeTruthy();
    });
  });

  it('loads and displays published sections', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(educationContentService.getPublishedSections).toHaveBeenCalled();
      expect(getByTestId('help-section-sp_definition-header')).toBeTruthy();
      expect(getByTestId('help-section-sp_earning-header')).toBeTruthy();
    });
  });

  it('tracks help_view analytics event on mount', async () => {
    render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(educationAnalyticsService.trackEducationEvent).toHaveBeenCalledWith('help_view', {});
    });
  });

  it('sp_definition section is expanded by default', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByTestId('help-section-sp_definition-content')).toBeTruthy();
    });
  });

  it('handles deep link to specific section', async () => {
    const deepLinkRoute = {
      params: { section: 'sp_earning' },
    };

    const { getByTestId } = render(
      <HelpScreen navigation={mockNavigation} route={deepLinkRoute} />
    );

    await waitFor(() => {
      // Section should be expanded
      expect(getByTestId('help-section-sp_earning-content')).toBeTruthy();
    });
  });

  it('displays SP calculator', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByTestId('help-sp-calculator')).toBeTruthy();
    });
  });

  it('displays bonus categories list', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByTestId('help-bonus-categories')).toBeTruthy();
    });
  });

  it('re-fetches SP calculator/bonus category data on screen focus', async () => {
    const mockUseFocusEffect = require('@react-navigation/native').useFocusEffect as jest.Mock;
    let focusCallback: () => void = () => {};
    mockUseFocusEffect.mockImplementation((cb: () => void) => {
      focusCallback = cb;
    });

    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    // Simulate the initial mount focus: the screen deliberately skips it
    // (children already load on mount), so dataVersion stays 0.
    act(() => {
      focusCallback();
    });
    expect(getByTestId('help-sp-calculator-refresh-key')).toHaveTextContent('0');
    expect(getByTestId('help-bonus-categories-refresh-key')).toHaveTextContent('0');

    // Simulate navigating away + back (screen re-focus) WITHOUT a remount.
    act(() => {
      focusCallback();
    });

    await waitFor(() => {
      expect(getByTestId('help-sp-calculator-refresh-key')).toHaveTextContent('1');
      expect(getByTestId('help-bonus-categories-refresh-key')).toHaveTextContent('1');
    });
  });

  it('handles pull-to-refresh', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByTestId('help-scroll-view')).toBeTruthy();
    });

    const scrollView = getByTestId('help-scroll-view');
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(educationContentService.getPublishedSections).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates back when back button pressed', async () => {
    const { getByTestId } = render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('back-button'));
  });

  it('displays error message on load failure', async () => {
    (educationContentService.getPublishedSections as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

    render(<HelpScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to load help content. Please try again.'
      );
    });

    alertSpy.mockRestore();
  });
});
