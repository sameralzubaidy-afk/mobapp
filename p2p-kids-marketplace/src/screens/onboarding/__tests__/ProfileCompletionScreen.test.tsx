import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileCompletionScreen from '../ProfileCompletionScreen';
import { supabase } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn(),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test/avatar.jpg' } }),
      }),
    },
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

describe('ProfileCompletionScreen FLOW-02', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('renders FLOW-02 test IDs', () => {
    const { getByTestId } = render(<ProfileCompletionScreen />);

    expect(getByTestId('profile-completion-screen')).toBeTruthy();
    expect(getByTestId('avatar-upload-button')).toBeTruthy();
    expect(getByTestId('display-name-label')).toBeTruthy();
    expect(getByTestId('display-name-input')).toBeTruthy();
    expect(getByTestId('bio-label')).toBeTruthy();
    expect(getByTestId('bio-input')).toBeTruthy();
    expect(getByTestId('save-profile-button')).toBeTruthy();
  });

  it('updates char counters on input', async () => {
    const { getByTestId } = render(<ProfileCompletionScreen />);

    fireEvent.changeText(getByTestId('display-name-input'), 'Sam');
    fireEvent.changeText(getByTestId('bio-input'), 'Hello world');

    await waitFor(() => {
      expect(getByTestId('display-name-char-count').props.children.join('')).toContain('3/50');
      expect(getByTestId('bio-char-count').props.children.join('')).toContain('11/200');
    });
  });
});
