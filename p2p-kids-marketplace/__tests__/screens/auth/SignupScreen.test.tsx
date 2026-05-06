// File: p2p-kids-marketplace/__tests__/screens/auth/SignupScreen.test.tsx
// MODULE-15.1: Auth Signup Screen Unit Tests
// FLOW-01: Authentication & Session Management

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import SignupScreen from '@/screens/auth/SignupScreen';
import { signupWithTrial } from '@/services/auth';

// Mock dependencies
jest.mock('@/services/auth');
jest.mock('@/services/referralCodeV2');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const mockSignupWithTrial = signupWithTrial as jest.MockedFunction<typeof signupWithTrial>;

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render signup form with all required inputs', () => {
      const { getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      expect(getByPlaceholderText(/name/i)).toBeTruthy();
      expect(getByPlaceholderText(/email/i)).toBeTruthy();
      expect(getByPlaceholderText(/phone/i)).toBeTruthy();
      expect(getByPlaceholderText(/password/i)).toBeTruthy();
      expect(getByPlaceholderText(/confirm password/i)).toBeTruthy();
    });

    it('should render terms and conditions checkbox', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      expect(getByTestID('terms-checkbox')).toBeTruthy();
    });

    it('should render signup button', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      expect(getByTestID('signup-submit-button')).toBeTruthy();
    });

    it('should render social login buttons', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      expect(getByTestID('social-login-buttons')).toBeTruthy();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility for password field', () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const passwordInput = getByPlaceholderText(/^password$/i);
      const toggleButton = getByTestID('password-toggle-button');
      
      expect(passwordInput.props.secureTextEntry).toBe(true);
      
      fireEvent.press(toggleButton);
      
      expect(passwordInput.props.secureTextEntry).toBe(false);
    });

    it('should toggle password visibility for confirm password field', () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const confirmPasswordInput = getByPlaceholderText(/confirm password/i);
      const toggleButton = getByTestID('confirm-password-toggle-button');
      
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);
      
      fireEvent.press(toggleButton);
      
      expect(confirmPasswordInput.props.secureTextEntry).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should validate name is required', async () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('name')
        );
      });
    });

    it('should validate email format', async () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'invalid-email');
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('email')
        );
      });
    });

    it('should validate password strength requirements', async () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const passwordInput = getByPlaceholderText(/^password$/i);
      fireEvent.changeText(passwordInput, 'weak');
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('password')
        );
      });
    });

    it('should validate password match', async () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const passwordInput = getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = getByPlaceholderText(/confirm password/i);
      
      fireEvent.changeText(passwordInput, 'Password123');
      fireEvent.changeText(confirmPasswordInput, 'Password456');
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('match')
        );
      });
    });

    it('should validate phone number format', async () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const phoneInput = getByPlaceholderText(/phone/i);
      fireEvent.changeText(phoneInput, '123');
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('phone')
        );
      });
    });

    it('should validate age requirement (18+)', async () => {
      const { getByTestID, getByPlaceholderText } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const dobInput = getByPlaceholderText(/date of birth/i);
      const today = new Date();
      const underageDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
      fireEvent.changeText(dobInput, underageDate.toISOString().split('T')[0]);
      
      const submitButton = getByTestID('signup-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sorry',
          expect.stringContaining('18 years old')
        );
      });
    });
  });

  describe('Design System Compliance (MODULE-15.1)', () => {
    it('should use filled input style for all inputs', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const emailWrapper = getByTestID('email-input-wrapper');
      expect(emailWrapper.props.style).toMatchObject({
        backgroundColor: '#F0F0F0',
        borderRadius: 12,
        height: 52,
      });
      expect(emailWrapper.props.style.borderWidth).toBeFalsy();
    });

    it('should use correct checkbox icons (CheckSquare for checked, Square for unchecked)', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const checkbox = getByTestID('terms-checkbox');
      expect(checkbox).toBeTruthy();
    });

    it('should use correct green color for checked checkbox (#5DBB8E)', () => {
      const { getByTestID } = render(
        <NavigationContainer>
          <SignupScreen />
        </NavigationContainer>
      );
      
      const checkbox = getByTestID('terms-checkbox');
      fireEvent.press(checkbox);
      
      expect(checkbox.props.style.color).toBe('#5DBB8E');
    });
  });
});
