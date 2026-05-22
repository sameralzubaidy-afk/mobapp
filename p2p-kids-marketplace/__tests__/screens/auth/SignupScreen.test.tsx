import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import SignupScreen from '@/screens/auth/SignupScreen';
import { signupWithTrial } from '@/services/auth';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('@/services/auth', () => ({
  signupWithTrial: jest.fn(),
}));

jest.mock('@/services/referralCodeV2', () => ({
  ReferralCodeServiceV2: {
    checkCodeExists: jest.fn(),
  },
}));

jest.mock('@/components/auth/SocialLoginButtons', () => ({
  SocialLoginButtons: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID || 'signup-social-buttons'} />;
  },
}));

const mockSignupWithTrial = signupWithTrial as jest.MockedFunction<typeof signupWithTrial>;
const mockCheckCodeExists = ReferralCodeServiceV2
  .checkCodeExists as jest.MockedFunction<typeof ReferralCodeServiceV2.checkCodeExists>;

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockCheckCodeExists.mockResolvedValue(true as any);
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  const renderScreen = () =>
    render(
      <NavigationContainer>
        <SignupScreen />
      </NavigationContainer>
    );

  it('renders required fields and actions', () => {
    const { getByPlaceholderText, getByTestId, getAllByText } = renderScreen();

    expect(getByPlaceholderText('Enter your full name')).toBeTruthy();
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('+1234567890')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm your password')).toBeTruthy();
    expect(getByTestId('signup-submit-button')).toBeTruthy();
    expect(getByTestId('signup-social-buttons')).toBeTruthy();
    expect(getAllByText('Create Account').length).toBeGreaterThan(0);
  });

  it('shows field validation errors when submitting empty form', async () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      expect(getByText('Name must be at least 2 characters')).toBeTruthy();
      expect(getByText('Please enter a valid email address')).toBeTruthy();
      expect(getByText('Please enter a valid phone number (10+ digits)')).toBeTruthy();
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
      expect(getByText('Please enter your date of birth')).toBeTruthy();
    });

    expect(mockSignupWithTrial).not.toHaveBeenCalled();
  });

  it('blocks underage signup with alert', async () => {
    const { getByPlaceholderText, getByTestId } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('Enter your full name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1');
    fireEvent.changeText(getByPlaceholderText('Confirm your password'), 'Password1');
    fireEvent.changeText(getByTestId('signup-dob-picker-day'), '01');
    fireEvent.changeText(getByTestId('signup-dob-picker-month'), '01');
    fireEvent.changeText(getByTestId('signup-dob-picker-year'), '2015');

    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sorry',
        'Sorry, you must be 18 years old to register.'
      );
    });

    expect(mockSignupWithTrial).not.toHaveBeenCalled();
  });

  it('calls signupWithTrial and navigates to PhoneVerification on success', async () => {
    mockSignupWithTrial.mockResolvedValue({
      user: { id: 'user-123' },
      error: null,
    } as any);

    const { getByPlaceholderText, getByTestId } = renderScreen();

    fireEvent.changeText(getByPlaceholderText('Enter your full name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('+1234567890'), '+15551234567');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password1');
    fireEvent.changeText(getByPlaceholderText('Confirm your password'), 'Password1');
    fireEvent.changeText(getByTestId('signup-dob-picker-day'), '20');
    fireEvent.changeText(getByTestId('signup-dob-picker-month'), '05');
    fireEvent.changeText(getByTestId('signup-dob-picker-year'), '1990');

    fireEvent.press(getByTestId('signup-submit-button'));

    await waitFor(() => {
      expect(mockSignupWithTrial).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          phone: '+15551234567',
          dob: '1990-05-20',
          referralCode: '',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('PhoneVerification', {
        userId: 'user-123',
        phone: '+15551234567',
      });
    });
  });
});
