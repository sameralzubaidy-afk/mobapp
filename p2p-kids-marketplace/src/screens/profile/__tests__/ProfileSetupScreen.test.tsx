import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileSetupScreen from '../ProfileSetupScreen';
import { setupUserProfile, uploadProfileAvatar } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    refreshSession: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/services/profile', () => ({
  setupUserProfile: jest.fn(),
  uploadProfileAvatar: jest.fn(),
}));

jest.mock('@/services/supabase/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/services/waitlist', () => ({
  upsertZipWaitlist: jest.fn(),
}));

// Bundled assets aren't loaded by Jest, so resolve the dev avatar fixture's
// bundled image to a stable file URI. (jest-expo's Image mock exposes
// resolveAssetSource as a real function, hence the spyOn.)
const resolveAssetSourceSpy = jest
  .spyOn(Image, 'resolveAssetSource')
  .mockReturnValue({ uri: 'file:///dev/avatar.png', scale: 1, width: 1, height: 1 } as any);

describe('ProfileSetupScreen FLOW-02', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (uploadProfileAvatar as jest.Mock).mockResolvedValue({
      url: null,
      path: null,
      error: null,
    });

    (getCurrentUser as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {},
      },
      error: null,
    });

    (setupUserProfile as jest.Mock).mockResolvedValue({
      error: null,
      needsWaitlist: false,
    });
  });

  it('renders FLOW-02 test IDs', () => {
    const { getByTestId } = render(<ProfileSetupScreen navigation={{}} />);

    expect(getByTestId('profile-setup-screen')).toBeTruthy();
    expect(getByTestId('avatar-upload-button')).toBeTruthy();
    expect(getByTestId('display-name-label')).toBeTruthy();
    expect(getByTestId('profile-setup-display-name-input')).toBeTruthy();
    expect(getByTestId('zip-code-label')).toBeTruthy();
    expect(getByTestId('zip-code-input')).toBeTruthy();
    expect(getByTestId('bio-label')).toBeTruthy();
    expect(getByTestId('profile-setup-bio-input')).toBeTruthy();
    expect(getByTestId('complete-setup-button')).toBeTruthy();
  });

  it('shows validation errors when required fields are missing', async () => {
    const { getByTestId } = render(<ProfileSetupScreen navigation={{}} />);

    fireEvent.press(getByTestId('complete-setup-button'));

    await waitFor(() => {
      expect(getByTestId('display-name-error')).toBeTruthy();
      expect(getByTestId('zip-code-error')).toBeTruthy();
    });
  });

  it('dev-set-avatar injects a bundled avatar and updates the preview (__DEV__ only)', () => {
    const { getByTestId } = render(<ProfileSetupScreen navigation={{}} />);

    // The dev fixture must be exposed for automation to reach it.
    expect(getByTestId('dev-set-avatar')).toBeTruthy();

    fireEvent.press(getByTestId('dev-set-avatar'));

    // The fixture resolves the bundled asset and injects it as the avatar.
    expect(resolveAssetSourceSpy).toHaveBeenCalled();
  });
});
