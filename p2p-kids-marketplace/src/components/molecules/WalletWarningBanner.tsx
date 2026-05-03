// File: p2p-kids-marketplace/src/components/molecules/WalletWarningBanner.tsx
// ADMIN-V2-003: SP Wallet State Warning Banner (P2 UX Enhancement)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type WalletState = 'active' | 'frozen' | 'suspended' | 'grace_period' | 'inactive';

interface WalletWarningBannerProps {
  walletState: WalletState;
}

/**
 * WalletWarningBanner displays state-specific warnings for non-active wallet states.
 * Used in WalletScreen and CheckoutScreen to communicate wallet restrictions to users.
 *
 * Visibility Rules:
 * - active: No banner shown (normal operation)
 * - frozen: Blue banner (subscription in grace period, cannot spend)
 * - suspended: Red banner (admin-imposed ban, contact support)
 * - grace_period: Yellow banner (90-day grace, renew to keep points)
 * - inactive: No banner shown (user has no wallet)
 */
const WalletWarningBanner: React.FC<WalletWarningBannerProps> = ({ walletState }) => {
  // Don't show banner for active or inactive states
  if (walletState === 'active' || walletState === 'inactive') {
    return null;
  }

  const config = getWarningConfig(walletState);

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      <Text style={[styles.icon, { color: config.iconColor }]}>{config.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: config.textColor }]}>{config.title}</Text>
        <Text style={[styles.message, { color: config.textColor }]}>{config.message}</Text>
      </View>
    </View>
  );
};

function getWarningConfig(state: WalletState) {
  switch (state) {
    case 'frozen':
      return {
        icon: '⚠️',
        title: 'Swap Points Frozen',
        message:
          'Your subscription is in grace period. Renew your subscription to restore SP access.',
        bgColor: '#DBEAFE', // blue-100
        iconColor: '#1E40AF', // blue-800
        textColor: '#1E3A8A', // blue-900
      };
    case 'suspended':
      return {
        icon: '🚫',
        title: 'Wallet Suspended',
        message: 'Your SP wallet has been suspended. Please contact support for assistance.',
        bgColor: '#FEE2E2', // red-100
        iconColor: '#991B1B', // red-800
        textColor: '#7F1D1D', // red-900
      };
    case 'grace_period':
      return {
        icon: '⏳',
        title: 'Grace Period Active',
        message: 'You have 90 days to renew your subscription and keep your Swap Points.',
        bgColor: '#FEF3C7', // yellow-100
        iconColor: '#92400E', // yellow-800
        textColor: '#78350F', // yellow-900
      };
    default:
      return {
        icon: 'ℹ️',
        title: 'Wallet Status Unknown',
        message: 'Please refresh to see your current wallet status.',
        bgColor: '#F3F4F6', // gray-100
        iconColor: '#374151', // gray-700
        textColor: '#1F2937', // gray-800
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 2,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default WalletWarningBanner;
