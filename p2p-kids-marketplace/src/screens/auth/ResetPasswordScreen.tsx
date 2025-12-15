import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hasResetSession, setHasResetSession] = useState(false);

  // When app opened via deep link from the email, Supabase may include tokens
  // in the fragment (hash). Parse the initial URL to derive access_token/refresh_token
  // or show an error if link contains error params (e.g., otp_expired).
  useEffect(() => {
    const handleInitialUrl = async () => {
      try {
        const url = await (await import('react-native')).Linking.getInitialURL();
        if (!url) return;

        // Split hash (fragment) portion after '#'
        const parts = url.split('#');
        const hash = parts[1] ?? '';

        if (!hash) return;

        const params = new URLSearchParams(hash);
        const error = params.get('error');
        const error_description = params.get('error_description');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (error) {
          // Friendly message for common codes like otp_expired
          if ((error_description || '').toLowerCase().includes('expired')) {
            setLinkError('This reset link has expired. Please request a new password reset email.');
          } else {
            setLinkError(decodeURIComponent(error_description || error));
          }
          return;
        }

        if (access_token) {
          // Set session so supabase.auth.updateUser works
          // supabase.auth.setSession exists in Supabase JS client
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({ access_token, refresh_token });
          if (setErr) {
            console.error('Failed to set session from deep link:', setErr);
            setLinkError('Failed to set auth session from reset link. Please request a new reset email.');
            return;
          }
          setHasResetSession(true);
        }
      } catch (e: any) {
        console.error('Error parsing initial URL for reset token:', e);
      }
    };

    handleInitialUrl();
  }, []);

  useEffect(() => {
    // Log that user arrived from deep link or via in-app navigation
    console.log('ResetPasswordScreen loaded with params:', route.params);

    // If route params contain access_token/refresh_token (navigated from dev helper), set session
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = route.params || {};
      const access_token = params?.access_token;
      const refresh_token = params?.refresh_token;
      const err = params?.error;
      const errDesc = params?.error_description;

      if (err) {
        if ((errDesc || '').toLowerCase().includes('expired')) {
          setLinkError('This reset link has expired. Please request a new password reset email.');
        } else {
          setLinkError(errDesc || err);
        }
      }

      if (access_token) {
        (async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: setErr } = await (supabase.auth as any).setSession({ access_token, refresh_token });
          if (setErr) {
            console.error('Failed to set session from params:', setErr);
            setLinkError('Failed to set auth session from reset link. Please request a new reset email.');
            return;
          }
          setHasResetSession(true);
        })();
      }
    } catch (e) {
      console.error('Failed to handle route params in ResetPasswordScreen', e);
    }
  }, [route.params]);

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return false;
    }

    // Check for at least one uppercase, one lowercase, and one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setErrors({
        password: 'Password must contain uppercase, lowercase, and number',
      });
      return false;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword(password)) {
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting password reset');

      // Ensure we have a valid session from the deep link before attempting
      // to update password. If not, inform the user to request a new link.
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session && !hasResetSession) {
        Alert.alert('No active reset session', 'This link does not provide a valid reset session. Please request a new password reset email.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      } as any);

      if (error) {
        console.error('Password update error:', error);

        Alert.alert(
          'Reset Failed',
          error.message || 'Failed to update password. Please try again.'
        );
      } else {
        console.log('Password reset successful');

        Alert.alert(
          'Success!',
          'Your password has been reset successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to login screen
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' as never }],
                });
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Password reset exception:', error);

      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
            Reset Password
          </Text>
          <Text style={{ fontSize: 16, color: '#666', lineHeight: 24 }}>
            Enter your new password below.
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 }}>
            New Password
          </Text>
          <TextInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors({});
            }}
            placeholder="Enter new password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            editable={!loading}
            style={{
              borderWidth: 1,
              borderColor: errors.password ? '#ff3b30' : '#ddd',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              backgroundColor: loading ? '#f8f9fa' : '#fff',
            }}
          />
          {errors.password && (
            <Text style={{ color: '#ff3b30', fontSize: 12, marginTop: 4 }}>
              {errors.password}
            </Text>
          )}
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 }}>
            Confirm Password
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors({});
            }}
            placeholder="Confirm new password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            editable={!loading}
            style={{
              borderWidth: 1,
              borderColor: errors.confirmPassword ? '#ff3b30' : '#ddd',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              backgroundColor: loading ? '#f8f9fa' : '#fff',
            }}
          />
          {errors.confirmPassword && (
            <Text style={{ color: '#ff3b30', fontSize: 12, marginTop: 4 }}>
              {errors.confirmPassword}
            </Text>
          )}
        </View>

        {linkError ? (
          <View style={{ backgroundColor: '#fff6f6', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#b00020', marginBottom: 8 }}>
              Link Error
            </Text>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 }}>{linkError}</Text>
            <TouchableOpacity
              onPress={() => {
                // Navigate back to Forgot Password to request a new email
                (navigation as any).navigate('ForgotPassword');
              }}
              style={{ padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Request New Reset Email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 }}>
              Password Requirements:
            </Text>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
              • At least 8 characters{'\n'}
              • Contains uppercase letter{'\n'}
              • Contains lowercase letter{'\n'}
              • Contains number
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleResetPassword}
          disabled={loading || !password || !confirmPassword}
          style={{
            backgroundColor: loading || !password || !confirmPassword ? '#ccc' : '#007AFF',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' as never }],
            });
          }}
          disabled={loading}
          style={{ padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: loading ? '#ccc' : '#666', fontSize: 16 }}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
