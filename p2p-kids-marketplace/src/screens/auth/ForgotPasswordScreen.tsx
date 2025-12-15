import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';
import { supabase } from '@/services/supabase/client';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSendResetEmail = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Track event (assuming analytics is set up)
      console.log('Password reset requested:', { email });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'p2pkidsmarketplace://reset-password',
      });

      if (error) {
        console.error('Password reset error:', error);

        // Provide actionable guidance to help debug common Auth email failures
        const baseMessage = error.message || 'Failed to send password reset email.';
        let detailMessage = baseMessage;

        // AuthApiError may include a status code; suggest likely causes
        // 4xx => bad request / email not found; 5xx => SMTP or provider issue
        // (status may be undefined in some environments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errAny: any = error;
        // Map common Supabase error messages to friendly hints
        const lm = baseMessage.toLowerCase();
        if (lm.includes('rate limit')) {
          detailMessage = 'You have requested password reset emails too frequently. Please check your inbox (including spam) or try again in a few minutes.';
        } else if (lm.includes('error sending recovery') || errAny?.status >= 500) {
          detailMessage += "\n\nPossible causes:\n• SMTP/email provider not configured in Supabase Auth\n• Redirect URL not allowed in Auth settings\n\nCheck Supabase Auth > Email Settings and Email Logs.";
        } else if (errAny?.status === 400) {
          detailMessage += "\n\nCheck that the email you entered is correct and belongs to an account.";
        } else {
          detailMessage += "\n\nIf this persists, check Supabase Auth email settings and logs.";
        }

        Alert.alert('Reset Email Failed', detailMessage, [
          {
            text: 'Open Supabase Docs',
            onPress: () => Linking.openURL('https://supabase.com/docs/guides/auth/passwords'),
          },
          { text: 'OK' },
        ]);
      } else {
        setEmailSent(true);
        console.log('Password reset email sent successfully');
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

  if (emailSent) {

    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📧</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 12, textAlign: 'center' }}>
            Check Your Email
          </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 }}>
            We've sent a password reset link to{'\n'}
            <Text style={{ fontWeight: '600', color: '#111' }}>{email}</Text>
          </Text>
        </View>

        <View style={{ backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: '#666', lineHeight: 20 }}>
            • Check your inbox and spam folder{'\n'}
            • Click the reset link in the email{'\n'}
            • You'll be redirected to set a new password
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            setEmailSent(false);
            setEmail('');
          }}
          style={{
            backgroundColor: '#fff',
            borderWidth: 2,
            borderColor: '#007AFF',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>
            Send Another Email
          </Text>
        </TouchableOpacity>

        {__DEV__ && (
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: '#333', marginBottom: 6 }}>
              Dev: Paste reset link here to open in simulator
            </Text>
            <TextInput
              value={devResetLink}
              onChangeText={setDevResetLink}
              placeholder="Paste full reset URL here"
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginBottom: 8 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!devResetLink) {
                  Alert.alert('No link', 'Paste the reset link from the email into the field above.');
                  return;
                }
                // Try to open directly (will open Safari/simulator). Also support
                // navigating in-app by extracting tokens and passing them to ResetPassword screen.
                // Defer opening externally until we've tried to resolve tokens programmatically.
                // This avoids opening Safari with a potentially long/tracked URL that Safari may report
                // as "invalid" and confuse the tester.

                // If the link is a Supabase verify URL containing a token query param,
                // try to resolve the redirect server-side to obtain the deep-link
                // that contains the access_token in the fragment. Use redirect:'follow'
                // and also inspect resp.url since some servers expose the final URL there.
                try {
                  const urlObj = new URL(devResetLink);
                  const isVerify = urlObj.pathname.includes('/auth/v1/verify') || urlObj.searchParams.has('token');

                  if (isVerify) {
                    try {
                      const resp = await fetch(devResetLink, { method: 'GET', redirect: 'follow' });
                      console.log('Dev helper fetch resolved url:', resp.url);

                      // Prefer the final response URL; fall back to Location header if present
                      let finalUrl = resp.url;
                      const location = resp.headers.get('location') || resp.headers.get('Location');
                      if (!finalUrl && location) finalUrl = location;

                      if (finalUrl) {
                        try {
                          const resolved = new URL(finalUrl);

                          // First try to extract tokens from the fragment (#...)
                          const frag = resolved.hash ? resolved.hash.substring(1) : null;
                          if (frag) {
                            const params = new URLSearchParams(frag);
                            const access_token = params.get('access_token');
                            const refresh_token = params.get('refresh_token');
                            if (access_token) {
                              (navigation as any).navigate('ResetPassword', { access_token, refresh_token });
                              return;
                            }

                            // If the redirect fragment contains an error (expired/invalid token), surface it to the tester
                            const err = params.get('error') || params.get('error_description');
                            if (err) {
                              const decoded = decodeURIComponent((params.get('error_description') || params.get('error') || '').replace(/\+/g, ' '));
                              Alert.alert('Reset Link Error', decoded || 'The link appears to be invalid or expired.', [
                                { text: 'Open in Safari', onPress: () => Linking.openURL(devResetLink).catch(() => {}) },
                                { text: 'OK' },
                              ]);
                              return;
                            }
                          }

                          // Next try query param token (e.g., ?token=...)
                          const token = resolved.searchParams.get('token');
                          if (token) {
                            // Try to fetch the verify URL again and inspect the final redirected URL
                            try {
                              const verifyResp = await fetch(finalUrl, { method: 'GET', redirect: 'follow' });
                              const afterUrl = verifyResp.url || (verifyResp.headers.get('location') || verifyResp.headers.get('Location'));
                              console.log('Verify fetch resulted in:', afterUrl);
                              if (afterUrl) {
                                const u2 = new URL(afterUrl);
                                const h2 = u2.hash ? u2.hash.substring(1) : null;
                                if (h2) {
                                  const params2 = new URLSearchParams(h2);
                                  const access_token = params2.get('access_token');
                                  const refresh_token = params2.get('refresh_token');
                                  if (access_token) {
                                    (navigation as any).navigate('ResetPassword', { access_token, refresh_token });
                                    return;
                                  }

                                  const err2 = params2.get('error') || params2.get('error_description');
                                  if (err2) {
                                    const decoded = decodeURIComponent((params2.get('error_description') || params2.get('error') || '').replace(/\+/g, ' '));
                                    Alert.alert('Reset Link Error', decoded || 'The link appears to be invalid or expired.', [
                                      { text: 'Open in Safari', onPress: () => Linking.openURL(devResetLink).catch(() => {}) },
                                      { text: 'OK' },
                                    ]);
                                    return;
                                  }
                                }
                              }
                            } catch (e2) {
                              console.warn('Error fetching verify URL to extract fragment:', e2);
                            }
                          }
                        } catch (e) {
                          console.warn('Failed to parse final URL from fetch:', e);
                        }
                      }

                      // If we couldn't extract tokens, fall back to opening the link externally below
                    } catch (fetchErr) {
                      console.warn('Fetch follow redirect failed, falling back to openURL', fetchErr);
                    }
                  }

                  // Parse tokens from hash and navigate in-app for convenience
                  const [, hash] = devResetLink.split('#');
                  if (!hash) {
                    Alert.alert(
                      'Invalid Link',
                      'The provided link does not contain reset tokens. Try opening the email in Safari, copy the full address bar URL (the Supabase verify URL containing `/auth/v1/verify?token=...` or a final link that contains `#access_token=...`) and paste it here.',
                      [
                        { text: 'Open in Safari', onPress: () => Linking.openURL(devResetLink).catch(() => {}) },
                        { text: 'OK' },
                      ]
                    );
                    return;
                  }
                  const params = new URLSearchParams(hash);
                  const access_token = params.get('access_token');
                  const refresh_token = params.get('refresh_token');
                  (navigation as any).navigate('ResetPassword', { access_token, refresh_token });
                } catch (e) {
                  console.error('Failed to parse dev reset link:', e);
                  Alert.alert('Invalid Link', 'The provided link could not be parsed.');
                }
              }}
              style={{ padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Open Reset Link</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#666', fontSize: 16 }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            Forgot Password?
          </Text>
          <Text style={{ fontSize: 16, color: '#666', lineHeight: 24 }}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 8 }}>
            Email Address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loading}
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              backgroundColor: loading ? '#f8f9fa' : '#fff',
            }}
          />
        </View>

        <TouchableOpacity
          onPress={handleSendResetEmail}
          disabled={loading || !email}
          style={{
            backgroundColor: loading || !email ? '#ccc' : '#007AFF',
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
              Send Reset Link
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
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
