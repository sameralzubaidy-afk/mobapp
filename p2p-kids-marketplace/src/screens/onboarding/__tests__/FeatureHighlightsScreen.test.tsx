import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FeatureHighlightsScreen from '../FeatureHighlightsScreen';
import { AuthContext } from '@/contexts/AuthContext';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useRoute: () => ({
    params: { userId: 'test-user-id' },
  }),
}));

const authContextValue: any = {
  session: {
    user: {
      id: 'test-user-id',
    },
  },
  user: null,
  isLoading: false,
  isSignout: false,
  error: null,
  setSession: jest.fn(),
  refreshSession: jest.fn(),
  logout: jest.fn(),
  subscribeToSessionChanges: jest.fn(() => jest.fn()),
};

describe('FeatureHighlightsScreen FLOW-02', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders flow test IDs', () => {
    const { getByTestId } = render(
      <AuthContext.Provider value={authContextValue}>
        <FeatureHighlightsScreen />
      </AuthContext.Provider>
    );

    expect(getByTestId('feature-highlights-screen')).toBeTruthy();
    expect(getByTestId('feature-highlights-carousel')).toBeTruthy();
    expect(getByTestId('feature-slide-0')).toBeTruthy();
    expect(getByTestId('feature-title-0')).toBeTruthy();
    expect(getByTestId('pagination-dots')).toBeTruthy();
    expect(getByTestId('next-button')).toBeTruthy();
  });

  it('navigates on Get Started on final slide', () => {
    const { getByTestId } = render(
      <AuthContext.Provider value={authContextValue}>
        <FeatureHighlightsScreen />
      </AuthContext.Provider>
    );

    fireEvent.press(getByTestId('get-started-button-3'));

    expect(mockNavigate).toHaveBeenCalledWith('Welcome', { userId: 'test-user-id' });
  });
});
