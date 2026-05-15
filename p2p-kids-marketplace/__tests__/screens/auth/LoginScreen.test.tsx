// File: p2p-kids-marketplace/__tests__/screens/auth/LoginScreen.test.tsx
// MODULE-15.1: Auth Login Screen Unit Tests
// FLOW-01: Authentication & Session Management

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import LoginScreen from '@/screens/auth/LoginScreen';
import { loginWithContext } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';

// Mock dependencies
jest.mock('@/services/auth');
jest.mock('@/hooks/useAuth');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const mockLoginWithContext = loginWithContext as jest.MockedFunction<typeof loginWithContext>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginScreen', () => {
  const mockSetSession = jest.fn();
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      setSession: mockSetSession,
      session: null,
      user: null,
      logout: jest.fn(),
    } as any);
    
    jest.mock('@react-navigation/native', () => ({
      ...jest.requireActual('@react-navigation/native'),
      useNavigation: () => ({
        navigate: mockNavigate,
        goBack: jest.fn(),
      }),
    }));
  });

  describe('Rendering', () => {
    it('should render login form with email and password inputs', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      expect(getByPlaceholderText(/email/i)).toBeTruthy();
      expect(getByPlaceholderText(/password/i)).toBeTruthy();
    });

    it('should render login button', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      expect(getByTestId('login-submit-button')).toBeTruthy();
    });

    it('should render forgot password link with correct color (#5DBB8E)', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const forgotLink = getByText('Forgot password?');
      expect(forgotLink).toBeTruthy();
      expect(forgotLink.props.style).toMatchObject({
        color: '#5DBB8E',
      });
    });

    it('should render social login buttons', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      expect(getByTestId('social-login-buttons')).toBeTruthy();
    });

    it('should render signup link', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      expect(getByText(/don't have an account/i)).toBeTruthy();
      expect(getByText('Sign Up')).toBeTruthy();
    });
  });

  describe('Form Interaction', () => {
    it('should update email input value', () => {
      const { getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'test@example.com');
      
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('should update password input value', () => {
      const { getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const passwordInput = getByPlaceholderText(/password/i);
      fireEvent.changeText(passwordInput, 'password123');
      
      expect(passwordInput.props.value).toBe('password123');
    });

    it('should toggle password visibility when eye icon is pressed', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const passwordInput = getByPlaceholderText(/password/i);
      const toggleButton = getByTestId('password-toggle-button');
      
      expect(passwordInput.props.secureTextEntry).toBe(true);
      
      fireEvent.press(toggleButton);
      
      expect(passwordInput.props.secureTextEntry).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Login Failed',
          expect.stringContaining('email')
        );
      });
    });

    it('should show error when email is invalid', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'invalid-email');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Login Failed',
          expect.stringContaining('invalid')
        );
      });
    });

    it('should show error when password is empty', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      fireEvent.changeText(emailInput, 'test@example.com');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Login Failed',
          expect.stringContaining('password')
        );
      });
    });
  });

  describe('Login Submission', () => {
    it('should call loginWithContext with correct credentials', async () => {
      mockLoginWithContext.mockResolvedValue({
        user: { id: '123', email: 'test@example.com' },
        subscription_status: 'active',
        available_points: 100,
      } as any);
      
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      const passwordInput = getByPlaceholderText(/password/i);
      
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockLoginWithContext).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should call setSession on successful login', async () => {
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        subscription_status: 'active',
        available_points: 100,
      };
      
      mockLoginWithContext.mockResolvedValue(mockSession as any);
      
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      const passwordInput = getByPlaceholderText(/password/i);
      
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockSetSession).toHaveBeenCalledWith(mockSession);
      });
    });

    it('should show loading state while logging in', async () => {
      mockLoginWithContext.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      const passwordInput = getByPlaceholderText(/password/i);
      
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(submitButton.props.disabled).toBe(true);
      });
    });

    it('should handle login error and show alert', async () => {
      mockLoginWithContext.mockRejectedValue(new Error('Invalid credentials'));
      
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      const passwordInput = getByPlaceholderText(/password/i);
      
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      
      const submitButton = getByTestId('login-submit-button');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Login Failed',
          expect.stringContaining('Invalid')
        );
      });
    });
  });

  describe('Design System Compliance (MODULE-15.1)', () => {
    it('should use filled input style (no borderWidth)', () => {
      const { getByPlaceholderText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const emailInput = getByPlaceholderText(/email/i);
      expect(emailInput.props.style.borderWidth).toBeFalsy();
    });

    it('should use correct input background color (#F0F0F0)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const inputWrapper = getByTestId('email-input-wrapper');
      expect(inputWrapper.props.style).toMatchObject({
        backgroundColor: '#F0F0F0',
      });
    });

    it('should use correct input height (52px)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const inputWrapper = getByTestId('email-input-wrapper');
      expect(inputWrapper.props.style.height).toBe(52);
    });

    it('should use correct input border radius (12px)', () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const inputWrapper = getByTestId('email-input-wrapper');
      expect(inputWrapper.props.style.borderRadius).toBe(12);
    });

    it('should use uppercase label style', () => {
      const { getByText } = render(
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      );
      
      const label = getByText('EMAIL');
      expect(label.props.style).toMatchObject({
        fontSize: 13,
        textTransform: 'uppercase',
        color: '#6B6B6B',
      });
    });
  });
});
