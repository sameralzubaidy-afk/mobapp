// File: p2p-kids-marketplace/src/screens/auth/LandingScreen.tsx
// MODULE-03 AUTH-V2-003: Landing Screen (Pre-Login & Post-Login)

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { AuthSession } from '@/types/user';

type NavigationProp = NativeStackNavigationProp<any>;

export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const { session, refreshSession, setSession } = useAuth();

  const handleSkipAuth = () => {
    if (!__DEV__) {
      (navigation as any).navigate('Login');
      return;
    }

    const now = new Date().toISOString();
    const mockSession: AuthSession = {
      user: {
        id: '00000000-0000-0000-0000-000000000002',
        user_id: '00000000-0000-0000-0000-000000000001',
        email: 'dev.maestro@example.com',
        name: 'Dev Maestro User',
        display_name: 'Dev Maestro User',
        profile_completed: true,
        onboarding_completed: true,
        onboarding_completed_at: now,
        phone_verified: true,
        parental_consent_verified: true,
        created_at: now,
        updated_at: now,
      },
      subscription_status: 'free',
      can_spend_sp: false,
      available_points: 0,
      pending_points: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      wallet_state: 'inactive', // ADMIN-V2-003
    };

    setSession(mockSession);
  };

  // Refresh session when screen comes into focus
  useEffect(() => {
    if (isFocused && session) {
      if (session.user?.user_id === '00000000-0000-0000-0000-000000000001') {
        return;
      }
      refreshSession();
    }
  }, [isFocused, session, refreshSession]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo / Icon */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🤝</Text>
          <Text style={styles.appName}>Kids P2P Marketplace</Text>
        </View>

        {/* Tagline */}
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>
            A safe space for kids to trade, learn, and grow together
          </Text>
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🔒</Text>
            <Text style={styles.featureText}>Safe & Secure</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🌟</Text>
            <Text style={styles.featureText}>Earn Points</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🏆</Text>
            <Text style={styles.featureText}>Build Reputation</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => (navigation as any).navigate('Signup')}
            testID="landing-signup-button"
          >
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => (navigation as any).navigate('Login')}
            testID="landing-login-button"
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

          {/* Test button to skip auth */}
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleSkipAuth}
            testID="landing-skip-auth-button"
          >
            <Text style={styles.testButtonText}>Skip Auth (Test)</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.footerLink}
              onPress={() => (navigation as any).navigate('TermsOfService')}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              style={styles.footerLink}
              onPress={() => (navigation as any).navigate('PrivacyPolicy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  taglineContainer: {
    marginBottom: 48,
  },
  tagline: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 16,
  },
  signupButton: {
    height: 56,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loginButton: {
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  testButton: {
    height: 44,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    marginTop: 40,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
