// File: p2p-kids-marketplace/src/screens/profile/LinkedAccountsScreen.tsx
// MODULE-03 AUTH-V3-004: Linked Accounts Management Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { EnvelopeSimple, Info, Key, GoogleLogo, FacebookLogo, AppleLogo, Link as LinkIcon } from 'phosphor-react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  getLinkedProviders,
  unlinkSocialAccount,
  countLoginMethods,
} from '@/services/accountService';
import { initiateSocialLogin } from '@/services/oauthService';
import PasswordReauthModal from '@/components/auth/PasswordReauthModal';
import type { OAuthProvider, LinkedProvider } from '@/types/auth-v3';
import { EmailMismatchError, LastLoginMethodError } from '@/types/auth-v3-errors';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

export default function LinkedAccountsScreen({ navigation: _navigation }: any) {
  const { user } = useAuth();
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [loginMethodCount, setLoginMethodCount] = useState<number>(0);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [linkingProvider, setLinkingProvider] = useState<OAuthProvider | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<OAuthProvider | null>(null);
  const [isReauthVisible, setIsReauthVisible] = useState(false);

  const allProviders: OAuthProvider[] = ['google', 'facebook', 'apple'];

  const loadLinkedAccounts = React.useCallback(async () => {
    try {
      setLoading(true);
      const userId = user?.user_id || user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load linked providers
      const providers = await getLinkedProviders();
      setLinkedProviders(providers);

      // Count login methods
      const count = await countLoginMethods(userId);
      setLoginMethodCount(count);

      // Check if user has password
      // Password counts as a login method if count > number of OAuth providers
      const hasPasswordMethod = count > providers.length;
      setHasPassword(hasPasswordMethod);
    } catch (error) {
      console.error('[LinkedAccounts] Failed to load linked accounts:', error);
      Alert.alert('Error', 'Failed to load linked accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLinkedAccounts();
  }, [loadLinkedAccounts]);

  const handleLinkAccount = async (provider: OAuthProvider) => {
    try {
      setLinkingProvider(provider);

      // If user has password, show password re-auth modal first
      if (hasPassword) {
        setIsReauthVisible(true);
      } else {
        // No password - proceed with OAuth flow
        await performLinking(provider);
      }
    } catch (error) {
      console.error('[LinkedAccounts] Link error:', error);
      setLinkingProvider(null);
    }
  };

  const handleReauthConfirm = async (password: string) => {
    setIsReauthVisible(false);
    if (linkingProvider) {
      await performLinking(linkingProvider, password);
    }
  };

  const handleReauthCancel = () => {
    setIsReauthVisible(false);
    setLinkingProvider(null);
  };

  const performLinking = async (provider: OAuthProvider, _password?: string) => {
    try {
      // Initiate OAuth flow
      const { url } = await initiateSocialLogin(provider);

      // In production, open OAuth URL and handle callback
      // For testing, simulate successful linking
      console.log(`[LinkedAccounts] OAuth URL: ${url}`);

      Alert.alert(
        'OAuth Flow',
        `In production, this would open ${provider} sign-in. For testing, use the manual test guide.`,
        [{ text: 'OK', onPress: () => setLinkingProvider(null) }]
      );

      // Reload linked accounts after successful link
      // await loadLinkedAccounts();
    } catch (error) {
      if (error instanceof EmailMismatchError) {
        Alert.alert(
          'Email Mismatch',
          `The email on your ${provider} account doesn't match your account email. Please use a different ${provider} account or contact support.`
        );
      } else {
        Alert.alert('Error', `Failed to link ${provider} account. Please try again.`);
      }
    }
  };

  const handleUnlinkAccount = async (provider: OAuthProvider) => {
    try {
      // Check if this would leave user with no login methods
      if (loginMethodCount <= 1) {
        Alert.alert(
          'Cannot Unlink',
          'You must keep at least one login method. Add another method first (password or another social account).',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(
        'Unlink Account',
        `Are you sure you want to unlink your ${provider} account? You can always link it again later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlink',
            style: 'destructive',
            onPress: async () => {
              try {
                setUnlinkingProvider(provider);
                await unlinkSocialAccount(provider);
                Alert.alert('Success', `${provider} account unlinked successfully`);
                await loadLinkedAccounts();
              } catch (error) {
                console.error('[LinkedAccounts] Unlink error:', error);

                if (error instanceof LastLoginMethodError) {
                  Alert.alert(
                    'Cannot Unlink',
                    'You must keep at least one login method. Add another method first.'
                  );
                } else {
                  Alert.alert('Error', `Failed to unlink ${provider} account. Please try again.`);
                }
              } finally {
                setUnlinkingProvider(null);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[LinkedAccounts] Unlink error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const getProviderIcon = (provider: OAuthProvider) => {
    switch (provider) {
      case 'google':   return GoogleLogo;
      case 'facebook': return FacebookLogo;
      case 'apple':    return AppleLogo;
      default:         return LinkIcon;
    }
  };

  const getProviderName = (provider: OAuthProvider): string => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'facebook':
        return 'Facebook';
      case 'apple':
        return 'Apple';
      default:
        return provider;
    }
  };

  const isProviderLinked = (provider: OAuthProvider): boolean => {
    return linkedProviders.some((p) => p.provider === provider);
  };

  const getProviderEmail = (provider: OAuthProvider): string | undefined => {
    return linkedProviders.find((p) => p.provider === provider)?.providerEmail;
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Linked Accounts">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading linked accounts...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Linked Accounts">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Email Card (Readonly) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Address</Text>
            <View style={styles.providerCard}>
              <View style={styles.providerIconContainer}>
                <EnvelopeSimple size={24} color="#3B82F6" weight="regular" />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>Account Email</Text>
                <Text style={styles.providerStatus}>{user?.email || 'No email set'}</Text>
              </View>
              <View style={styles.readonlyBadge}>
                <Text style={styles.readonlyBadgeText}>Readonly</Text>
              </View>
            </View>
          </View>

          {/* Info card */}
          <View style={styles.infoCard}>
            <Info size={20} color="#3B82F6" weight="regular" />
            <Text style={styles.infoText}>
              Link multiple accounts to sign in using any of them. You must keep at least one login
              method.
            </Text>
          </View>

          {/* Password status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Password</Text>
            <View style={styles.providerCard}>
              <View style={styles.providerIconContainer}>
                <Key size={24} color="#3B82F6" weight="regular" />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>Password</Text>
                <Text style={styles.providerStatus}>
                  {hasPassword ? 'Password ✓ set' : 'No password set'}
                </Text>
              </View>
              {!hasPassword && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Alert.alert('Coming Soon', 'Set password feature coming soon')}
                  testID="set-password-button"
                >
                  <Text style={styles.actionButtonText}>Set Password</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Social providers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Accounts</Text>
            {allProviders.map((provider) => {
              const linked = isProviderLinked(provider);
              const email = getProviderEmail(provider);
              const isLinking = linkingProvider === provider;
              const isUnlinking = unlinkingProvider === provider;

              return (
                <View key={provider} style={styles.providerCard} testID={`provider-${provider}`}>
                  <View style={styles.providerIconContainer}>
                    {isLinking || isUnlinking ? (
                      <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (() => {
                      const ProviderIcon = getProviderIcon(provider);
                      return <ProviderIcon size={24} color="#3B82F6" weight="regular" />;
                    })()}
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{getProviderName(provider)}</Text>
                    <Text style={styles.providerStatus}>
                      {linked ? `Linked • ${email || 'No email'}` : 'Not linked'}
                    </Text>
                  </View>
                  {!isLinking && !isUnlinking && (
                    <TouchableOpacity
                      style={[styles.actionButton, linked && styles.actionButtonDanger]}
                      onPress={() =>
                        linked ? handleUnlinkAccount(provider) : handleLinkAccount(provider)
                      }
                      testID={`${provider}-${linked ? 'unlink' : 'link'}-button`}
                    >
                      <Text
                        style={[styles.actionButtonText, linked && styles.actionButtonTextDanger]}
                      >
                        {linked ? 'Unlink' : 'Link'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Login methods count */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Active login methods: {loginMethodCount}</Text>
          </View>
        </ScrollView>

        {/* Modals */}
        <PasswordReauthModal
          visible={isReauthVisible}
          onConfirm={handleReauthConfirm}
          onCancel={handleReauthCancel}
          testID="link-password-reauth"
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  readonlyBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  readonlyBadgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  providerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  providerStatus: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  actionButtonTextDanger: {
    color: '#FFFFFF',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
