// File: p2p-kids-marketplace/src/screens/trade/TradeV2ComponentsPreviewScreen.tsx

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { AutoCompleteBanner, OfferCountdownPill } from '@/components/trade';

export default function TradeV2ComponentsPreviewScreen() {
  const now = Date.now();
  const createdAt = new Date(now - 12 * 60 * 60 * 1000).toISOString();
  const offerExpiresSoon = new Date(now + 90 * 60 * 1000).toISOString();
  const offerExpiresLater = new Date(now + 15 * 60 * 60 * 1000).toISOString();
  const autoCompleteAt = new Date(now + 22 * 60 * 60 * 1000).toISOString();

  return (
    <ScreenLayout variant="detail" title="Trade V2 Preview">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>OfferCountdownPill</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Critical (under 2h)</Text>
          <OfferCountdownPill
            offerExpiresAt={offerExpiresSoon}
            createdAt={createdAt}
            testID="preview-offer-countdown-critical"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Normal</Text>
          <OfferCountdownPill
            offerExpiresAt={offerExpiresLater}
            createdAt={createdAt}
            testID="preview-offer-countdown-normal"
          />
        </View>

        <Text style={styles.sectionTitle}>AutoCompleteBanner</Text>
        <View style={styles.card}>
          <AutoCompleteBanner
            autoCompleteAt={autoCompleteAt}
            status="in_progress"
            testID="preview-auto-complete-banner"
          />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});
