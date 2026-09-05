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
 * - frozen: Info-blue banner (cannot spend until renewed) — info #5B8FB9
 * - suspended: Error-red banner (admin-imposed ban, contact support) — error #E85D75
 * - grace_period: Warning-amber banner (90-day grace, renew to keep points) — warning #FFA726
 * - inactive: No banner shown (user has no wallet)
 *
 * Colors are the canonical Pass-It-Up semantic tokens (docx/design-system-passitup.md §6:
 * info #5B8FB9 / error #E85D75 / warning #FFA726) with the app-standard soft-tint banner
 * idiom used by ManageKidsClubScreen infoBox/warningBox (#EBF4F9 / #FFF3E0 tints, neutral
 * title/body text, colored left border + icon). QA Task 31-M finding 4 flagged the prior
 * Tailwind palette chips (#DBEAFE / #FEE2E2 / #FEF3C7).
 */
const WalletWarningBanner: React.FC<WalletWarningBannerProps> = ({ walletState }) => {
  // Don't show banner for active or inactive states
  if (walletState === 'active' || walletState === 'inactive') {
    return null;
  }

  const config = getWarningConfig(walletState);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bgColor, borderLeftColor: config.accentColor },
      ]}
    >
      <Text style={[styles.icon, { color: config.accentColor }]}>{config.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: config.titleColor }]}>{config.title}</Text>
        <Text style={[styles.message, { color: config.messageColor }]}>{config.message}</Text>
      </View>
    </View>
  );
};

function getWarningConfig(state: WalletState) {
  // Semantic banner palette (design-system-passitup.md §6 + ManageKidsClubScreen idiom).
  const info = { bgColor: '#EBF4F9', accentColor: '#5B8FB9' }; // info tint + info 500
  const error = { bgColor: '#FFF0F2', accentColor: '#E85D75' }; // error tint + error 500
  const warning = { bgColor: '#FFF3E0', accentColor: '#FFA726' }; // warning tint + warning 500
  // Neutral text on tints keeps contrast AA-clean (same as ManageKidsClub infoBox/warningBox).
  const titleColor = '#1A1A1A'; // neutral 900
  const messageColor = '#6B6B6B'; // neutral 700

  switch (state) {
    case 'frozen':
      return {
        icon: '⚠️',
        title: 'Swap Points Frozen',
        message: 'Your Swap Points are frozen. Renew your subscription to use them again.',
        ...info,
        titleColor,
        messageColor,
      };
    case 'suspended':
      return {
        icon: '🚫',
        title: 'Wallet Suspended',
        message: 'Your SP wallet has been suspended. Please contact support for assistance.',
        ...error,
        titleColor,
        messageColor,
      };
    case 'grace_period':
      return {
        icon: '⏳',
        title: 'Grace Period Active',
        message: 'You can keep spending existing Swap Points, but you won\'t earn new ones until you renew.',
        ...warning,
        titleColor,
        messageColor,
      };
    default:
      return {
        icon: 'ℹ️',
        title: 'Wallet Status Unknown',
        message: 'Please refresh to see your current wallet status.',
        bgColor: '#F7F7F7', // neutral 50
        accentColor: '#999999', // neutral 500
        titleColor,
        messageColor,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
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
