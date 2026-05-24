/**
 * File: p2p-kids-marketplace/src/components/molecules/IDVerificationCTABanner.tsx
 * Action Items section: ID Verification CTA card (priority 1)
 *
 * Shows when a user has never submitted OR was rejected.
 * Dismissible per-session via "Maybe later" (reappears on next visit to dashboard).
 * Style matches ResumeDraftBanner / GracePeriodBanner design tokens exactly.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { IdentificationCard } from 'phosphor-react-native';

export interface IDVerificationCTABannerProps {
  /** 'none' = never submitted; 'rejected' = last attempt was rejected */
  status: 'none' | 'rejected';
  onVerify: () => void;
  onDismiss: () => void;
  testID?: string;
}

export function IDVerificationCTABanner({
  status,
  onVerify,
  onDismiss,
  testID = 'id-verification-cta-banner',
}: IDVerificationCTABannerProps) {
  const isRejected = status === 'rejected';

  // Left border accent: amber for rejection (warning), blue for first-time nudge
  const accentColor = isRejected ? '#F59E0B' : '#3B82F6';
  const iconBg = isRejected ? '#FEF3C7' : '#EFF6FF';

  const title = isRejected ? 'ID Verification Not Approved' : 'Verify Your Identity';

  const message = isRejected
    ? 'Your last submission was not approved. Please resubmit a clear, well-lit photo of your government-issued ID.'
    : 'Build trust with buyers and sellers. Verify your ID to earn the Trusted Seller badge and boost your listings.';

  const ctaLabel = isRejected ? 'Resubmit ID' : 'Verify Now';

  return (
    <View
      style={[styles.container, { borderLeftColor: accentColor }]}
      testID={testID}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <IdentificationCard size={20} color={accentColor} weight="fill" />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title} testID={`${testID}-title`}>
          {title}
        </Text>
        <Text style={styles.message} testID={`${testID}-message`}>
          {message}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={onVerify}
            accessibilityLabel={ctaLabel}
            testID={`${testID}-cta-button`}
          >
            <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDismiss}
            accessibilityLabel="Dismiss, maybe later"
            testID={`${testID}-maybe-later`}
          >
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  ctaBtn: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissText: {
    fontSize: 13,
    color: '#6B6B6B',
  },
});

