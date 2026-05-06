import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../WelcomeScreen';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
  useRoute: () => ({
    params: { userId: 'test-user-id' },
  }),
}));

const mockRefreshSession = jest.fn().mockResolvedValue(undefined);

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
  refreshSession: mockRefreshSession,
  logout: jest.fn(),
  subscribeToSessionChanges: jest.fn(() => jest.fn()),
};

describe('WelcomeScreen FLOW-02', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('renders FLOW-02 test IDs', () => {
    const { getByTestId } = render(
      <AuthContext.Provider value={authContextValue}>
        <WelcomeScreen />
      </AuthContext.Provider>
    );

    expect(getByTestId('welcome-screen')).toBeTruthy();
    expect(getByTestId('welcome-headline')).toBeTruthy();
    expect(getByTestId('welcome-description')).toBeTruthy();
    expect(getByTestId('welcome-get-started-button')).toBeTruthy();
  });

  it('submits onboarding completion and refreshes session', async () => {
    const { getByTestId } = render(
      <AuthContext.Provider value={authContextValue}>
        <WelcomeScreen />
      </AuthContext.Provider>
    );

    fireEvent.press(getByTestId('welcome-get-started-button'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockRefreshSession).toHaveBeenCalledWith(false);
    });
  });
});
