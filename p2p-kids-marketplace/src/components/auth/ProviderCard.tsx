// File: p2p-kids-marketplace/src/components/auth/ProviderCard.tsx
// MODULE-03 AUTH-V3-008: Per-provider card showing linked/unlinked state

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OAuthProvider } from '@/types/auth-v3';

interface ProviderCardProps {
  provider: OAuthProvider;
  isLinked: boolean;
  providerEmail?: string;
  linkedAt?: string;
  onLink: () => void;
  onUnlink: () => void;
  isLoading?: boolean;
  testID?: string;
}

const PROVIDER_CONFIG = {
  google: {
    name: 'Google',
    icon: 'logo-google' as const,
    color: '#DB4437',
  },
  facebook: {
    name: 'Facebook',
    icon: 'logo-facebook' as const,
    color: '#4267B2',
  },
  apple: {
    name: 'Apple',
    icon: 'logo-apple' as const,
    color: '#000000',
  },
};

/**
 * Provider card for linked accounts screen
 * Shows provider name, linked status, email if linked, and link/unlink action
 */
export default function ProviderCard({
  provider,
  isLinked,
  providerEmail,
  linkedAt,
  onLink,
  onUnlink,
  isLoading = false,
  testID,
}: ProviderCardProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon} size={24} color={config.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.providerName}>{config.name}</Text>
          {isLinked && providerEmail && (
            <Text style={styles.email} numberOfLines={1}>
              {providerEmail}
            </Text>
          )}
          {isLinked && linkedAt && (
            <Text style={styles.linkedAt}>
              Linked {new Date(linkedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        <TouchableOpacity
          style={[styles.button, isLinked ? styles.unlinkButton : styles.linkButton]}
          onPress={isLinked ? onUnlink : onLink}
          accessibilityRole="button"
          accessibilityLabel={isLinked ? `Unlink ${config.name}` : `Link ${config.name}`}
          testID={`${testID}-action`}
        >
          <Text style={[styles.buttonText, isLinked ? styles.unlinkText : styles.linkText]}>
            {isLinked ? 'Unlink' : 'Link'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  linkedAt: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  linkButton: {
    backgroundColor: '#3B82F6',
  },
  unlinkButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    color: '#FFFFFF',
  },
  unlinkText: {
    color: '#DC2626',
  },
});
