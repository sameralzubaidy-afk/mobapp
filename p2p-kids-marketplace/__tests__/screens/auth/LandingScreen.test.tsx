// File: p2p-kids-marketplace/__tests__/screens/auth/LandingScreen.test.tsx
// MODULE-15.1: Auth Landing Screen Unit Tests
// FLOW-01: Authentication & Session Management

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import LandingScreen from '@/screens/auth/LandingScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the landing screen with white background', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const container = getByTestId('landing-container');
      expect(container.props.style).toMatchObject({
        backgroundColor: '#FFFFFF',
      });
    });

    it('should render the app name "Pass It Up"', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByText('Pass It Up')).toBeTruthy();
    });

    it('should render the tagline', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByText(/buy, sell, and trade/i)).toBeTruthy();
    });

    it('should render the emoji logo (🤝)', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByText('🤝')).toBeTruthy();
    });

    it('should render Get Started button with correct styles', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const button = getByTestId('landing-signup-button');
      expect(button.props.style).toMatchObject({
        height: 52,
        borderRadius: 26,
        backgroundColor: '#5DBB8E',
      });
    });

    it('should render Log In button', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByTestId('landing-login-button')).toBeTruthy();
    });

    it('should render feature highlights', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByText('Safe & Secure')).toBeTruthy();
      expect(getByText('Earn Points')).toBeTruthy();
      expect(getByText('Local First')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to Signup when Get Started is pressed', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const signupButton = getByTestId('landing-signup-button');
      fireEvent.press(signupButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('Signup');
    });

    it('should navigate to Login when Log In is pressed', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const loginButton = getByTestId('landing-login-button');
      fireEvent.press(loginButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('should navigate to Terms when Terms link is pressed', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const termsLink = getByText('Terms');
      fireEvent.press(termsLink);
      
      expect(mockNavigate).toHaveBeenCalledWith('TermsOfService');
    });

    it('should navigate to Privacy Policy when Privacy link is pressed', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const privacyLink = getByText('Privacy Policy');
      fireEvent.press(privacyLink);
      
      expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
    });
  });

  describe('Design System Compliance (MODULE-15.1)', () => {
    it('should use correct primary button height (52px)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const button = getByTestId('landing-signup-button');
      expect(button.props.style.height).toBe(52);
    });

    it('should use pill-shaped border radius (26px = height/2)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const button = getByTestId('landing-signup-button');
      expect(button.props.style.borderRadius).toBe(26);
    });

    it('should use correct primary color (#5DBB8E)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const button = getByTestId('landing-signup-button');
      expect(button.props.style.backgroundColor).toBe('#5DBB8E');
    });

    it('should use white background (#FFFFFF)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const container = getByTestId('landing-container');
      expect(container.props.style.backgroundColor).toBe('#FFFFFF');
    });

    it('should use 24px horizontal padding', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      const content = getByTestId('landing-scroll-content');
      expect(content.props.style.paddingHorizontal).toBe(24);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible testID for signup button', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByTestId('landing-signup-button')).toBeTruthy();
    });

    it('should have accessible testID for login button', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LandingScreen />
        </NavigationContainer>
      );
      
      expect(getByTestId('landing-login-button')).toBeTruthy();
    });
  });
});
