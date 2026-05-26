/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeSuccessScreen.tsx
 * TASK FLOW-08-06: Trade Result Screen - Whisk Design System
 *
 * Redesigned with:
 * - Success state: CheckCircle 72px green (#5DBB8E), SP earned badge (#FEF3C7 bg)
 * - Failure state: XCircle 72px red (#E85D75), error message display
 * - Green pill button "View Trade" (success) OR "Try Again" (failure)
 * - "Back to Home" text link
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { CheckCircle, XCircle, Coins } from 'phosphor-react-native';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import ScreenLayout from '@/components/ScreenLayout';

type TradeSuccessRouteProp = RouteProp<RootStackParamList, 'TradeSuccess'>;

export default function TradeSuccessScreen() {
  const route = useRoute<TradeSuccessRouteProp>();
  const navigation = useNavigation<any>();
  const { tradeId } = route.params;

  // Determine state from params (default to success)
  const isSuccess = (route.params as any)?.success !== false;
  const spEarned = (route.params as any)?.spEarned || 0;
  const errorMessage = (route.params as any)?.errorMessage;

  const handlePrimaryAction = () => {
    if (isSuccess) {
      navigation.navigate('TradeTimeline', { tradeId });
    } else {
      // Navigate back to retry
      navigation.goBack();
    }
  };

  return (
    <ScreenLayout variant="detail" title="Trade Complete">
      <View style={styles.content}>
        {/* Icon */}
        {isSuccess ? (
          <CheckCircle size={72} color="#5DBB8E" weight="fill" testID="success-icon" />
        ) : (
          <XCircle size={72} color="#E85D75" weight="fill" testID="failure-icon" />
        )}

        {/* Title */}
        <Text style={[styles.title, !isSuccess && styles.titleError]}>
          {isSuccess ? 'Trade Initiated!' : 'Trade Failed'}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {isSuccess
            ? 'Your trade request has been sent. You can track the status in your trades list.'
            : errorMessage || 'There was a problem initiating the trade. Please try again.'}
        </Text>

        {/* SP Earned Badge (success only) */}
        {isSuccess && spEarned > 0 && (
          <View style={styles.spBadge} testID="sp-earned-badge">
            <Coins size={16} color="#F59E0B" weight="regular" />
            <Text style={styles.spBadgeText}>You'll earn {spEarned} SP when complete</Text>
          </View>
        )}

        {/* Trade ID (success only) */}
        {isSuccess && (
          <Text style={styles.tradeId} testID="trade-id-text">
            Trade ID: {tradeId}
          </Text>
        )}

        {/* Primary Action Button */}
        <Pressable
          style={[styles.primaryButton, !isSuccess && styles.primaryButtonError]}
          onPress={handlePrimaryAction}
          testID="primary-action-button"
        >
          <Text style={styles.primaryButtonText}>
            {isSuccess ? 'View Trade' : 'Try Again'}
          </Text>
        </Pressable>

        {/* Back to Home Link */}
        <Pressable
          style={styles.linkButton}
          onPress={() => navigation.navigate('Home')}
          testID="back-home-button"
        >
          <Text style={styles.linkText}>Back to Home</Text>
        </Pressable>
      </View>
      <PersistentTabBar />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5DBB8E',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  titleError: {
    color: '#E85D75',
  },
  message: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  spBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  spBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  tradeId: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 32,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonError: {
    backgroundColor: '#E85D75',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});

