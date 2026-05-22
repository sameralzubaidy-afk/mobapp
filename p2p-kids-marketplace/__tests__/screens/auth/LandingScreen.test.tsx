import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import LandingScreen from '@/screens/auth/LandingScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(
      <NavigationContainer>
        <LandingScreen />
      </NavigationContainer>
    );

  it('renders app branding and core CTAs', () => {
    const { getByText, getByTestId } = renderScreen();

    expect(getByText('Pass It Up')).toBeTruthy();
    expect(getByText('Get Started')).toBeTruthy();
    expect(getByText('Log In')).toBeTruthy();
    expect(getByTestId('app-logo')).toBeTruthy();
  });

  it('renders legal footer links', () => {
    const { getByText } = renderScreen();

    expect(getByText('Terms')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('navigates to Signup when Get Started is pressed', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('landing-signup-button'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('navigates to Login when Log In is pressed', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('landing-login-button'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to legal screens from footer links', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Terms'));
    fireEvent.press(getByText('Privacy Policy'));

    expect(mockNavigate).toHaveBeenCalledWith('TermsOfService');
    expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
  });
});
