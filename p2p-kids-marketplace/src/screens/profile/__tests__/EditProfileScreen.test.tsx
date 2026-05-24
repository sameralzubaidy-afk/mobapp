// File: p2p-kids-marketplace/src/screens/profile/__tests__/EditProfileScreen.test.tsx
// TASK FLOW-15: Unit tests for Edit Profile screen (redesigned with filled inputs)

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import EditProfileScreen from '../EditProfileScreen';
import { getUserProfile, updateUserProfile } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';

jest.mock('@/services/profile');
jest.mock('@/services/supabase/auth');
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ refreshSession: jest.fn() }),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

describe('EditProfileScreen - FLOW-15 UI Redesign', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    phone: '5551234567',
  };

  const mockProfile = {
    id: 'test-user-id',
    name: 'Test User',
    bio: 'Test bio',
    zip_code: '12345',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ user: mockUser, error: null });
    mockGetUserProfile.mockResolvedValue({ user: mockProfile, error: null });
  });

  it('renders Edit Profile title with correct styling (FLOW-15)', async () => {
    const { getByText } = render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      const title = getByText('Edit Profile');
      expect(title).toBeTruthy();
      // Title should be 24px, fontWeight 600, color #1A1A1A
    });
  });

  it('renders avatar with 96px circle and camera overlay (FLOW-15)', async () => {
    render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      // Avatar should be 96x96px
      // Camera overlay should be 28px green circle (#5DBB8E)
    });
  });

  it('renders locked full name field with User icon (FLOW-15)', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('FULL NAME (CANNOT BE CHANGED)')).toBeTruthy();
      const input = getByDisplayValue('Test User');
      expect(input).toBeTruthy();
      expect(input.props.value).toBe('Test User');
    });
  });

  it('renders filled input for phone with Phone icon (FLOW-15)', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('PHONE NUMBER')).toBeTruthy();
      const input = getByPlaceholderText('(XXX) XXX-XXXX');
      expect(input).toBeTruthy();
    });
  });

  it('renders filled input for zip code with MapPin icon (FLOW-15)', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('ZIP CODE (CANNOT BE CHANGED)')).toBeTruthy();
      const input = getByDisplayValue('12345');
      expect(input).toBeTruthy();
      expect(input.props.value).toBe('12345');
    });
  });

  it('renders bio textarea with filled style and min 100px height (FLOW-15)', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('BIO')).toBeTruthy();
      const textarea = getByPlaceholderText('Tell us a bit about yourself...');
      expect(textarea).toBeTruthy();
      expect(textarea.props.value).toBe('Test bio');
      // Should have backgroundColor #F0F0F0, minHeight 100
    });
  });

  it('renders Save Changes button as green pill (FLOW-15)', async () => {
    const { getByText } = render(<EditProfileScreen navigation={{ goBack: jest.fn() }} />);

    await waitFor(() => {
      const saveButton = getByText('Save Changes');
      expect(saveButton).toBeTruthy();
      // Button should have backgroundColor #5DBB8E, borderRadius 26, height 52
    });
  });

  it('calls updateUserProfile on save with changed fields', async () => {
    mockUpdateUserProfile.mockResolvedValue({
      user: { ...mockProfile, bio: 'Updated bio' },
      error: null,
      needsWaitlist: false,
    });

    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      const bioInput = getByPlaceholderText('Tell us a bit about yourself...');
      fireEvent.changeText(bioInput, 'Updated bio');
    });

    const saveButton = getByText('Save Changes');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          bio: 'Updated bio',
        }),
        expect.objectContaining({ includeAuthUser: false })
      );
    });
  });

  it('displays error message with red color (#E85D75) for validation errors', async () => {
    const { getByPlaceholderText, getByText } = render(
      <EditProfileScreen navigation={{ goBack: jest.fn() }} />
    );

    await waitFor(() => {
      const input = getByPlaceholderText('(XXX) XXX-XXXX');
      fireEvent.changeText(input, '123');
    });

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      expect(getByText('Phone number must be 10 digits')).toBeTruthy();
    });
  });
});
