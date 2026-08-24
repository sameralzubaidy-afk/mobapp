import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileSetupScreen from '../ProfileSetupScreen';
import { setupUserProfile, uploadProfileAvatar } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    refreshSession: jest.fn().mockResolvedValue(undefined),
  }),
}));

// The dev avatar fixture copies the bundled asset into the app cache via
// expo-file-system/legacy so its URI is a local file:// path that
// uploadProfileAvatar → ImageManipulator can actually read (a raw Metro asset
// URL would make the upload silently fail and avatar_url stay null).
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock-cache/',
  copyAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => {}),
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

  it('dev-set-avatar copies the bundled asset to a cache file:// URI usable by ImageManipulator (__DEV__ only)', async () => {
    const { getByTestId, UNSAFE_getByType } = render(<ProfileSetupScreen navigation={{}} />);

    // The dev fixture must be exposed for automation to reach it.
    expect(getByTestId('dev-set-avatar')).toBeTruthy();

    fireEvent.press(getByTestId('dev-set-avatar'));

    // The fixture must hand the avatar pipeline a LOCAL cache file path (like a
    // real expo-image-picker result), NOT the raw Metro/bundled asset URL, so
    // uploadProfileAvatar → ImageManipulator can read it. The spy resolves the
    // asset to a file:// source, so the fixture copies it into the cache dir.
    await waitFor(() => {
      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'file:///dev/avatar.png',
          to: expect.stringMatching(/^file:\/\/\/mock-cache\/dev-avatar-\d+\.png$/),
        })
      );

      // localImageUri (the avatar preview source) is the copied cache path,
      // not the raw asset URL.
      const avatarImage = UNSAFE_getByType(Image);
      expect(avatarImage.props.source.uri).toMatch(/^file:\/\/\/mock-cache\/dev-avatar-\d+\.png$/);
      expect(avatarImage.props.source.uri).not.toBe('file:///dev/avatar.png');
    });
  });

  it('dev-set-avatar downloads a Metro asset URL to a cache file:// URI (Expo Go branch)', async () => {
    // Expo Go resolves bundled assets to http://<metro>/assets/... URLs, which
    // cannot be read by ImageManipulator — the fixture must download them into
    // the cache so the URI stays uploadable.
    resolveAssetSourceSpy.mockReturnValueOnce({
      uri: 'http://localhost:8081/assets/adaptive-icon.png',
      scale: 1,
      width: 1,
      height: 1,
    } as any);

    const { getByTestId, UNSAFE_getByType } = render(<ProfileSetupScreen navigation={{}} />);

    fireEvent.press(getByTestId('dev-set-avatar'));

    await waitFor(() => {
      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        'http://localhost:8081/assets/adaptive-icon.png',
        expect.stringMatching(/^file:\/\/\/mock-cache\/dev-avatar-\d+\.png$/)
      );

      // The Metro URL must NOT leak into localImageUri — only the cache path.
      const avatarImage = UNSAFE_getByType(Image);
      expect(avatarImage.props.source.uri).toMatch(/^file:\/\/\/mock-cache\/dev-avatar-\d+\.png$/);
    });
  });
});
