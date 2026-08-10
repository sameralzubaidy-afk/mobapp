/**
 * File: p2p-kids-marketplace/src/screens/subscription/JoinKidsClubScreen.tsx
 * R7 — Web-First Subscription Purchase (Option A)
 *
 * In-app "Join Kids Club" prompt (journey Step 2 + Step 3).
 * This screen contains ZERO purchase UI — no price cards, no "Subscribe"
 * button, no Stripe, no App Store / Play Store billing trigger. It explains
 * the membership value prop and redirects the parent to passitup.com where
 * Stripe Checkout (hosted, PCI SAQ-A) completes the purchase in the external
 * browser (App Store Guideline 3.1.3 compliant).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Sparkle, Coins, Receipt, ArrowSquareOut } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { JoinKidsClubButton } from '@/components/subscription/JoinKidsClubButton';
import { useAuth } from '@/hooks/useAuth';

const BENEFITS = [
  {
    icon: Coins,
    title: 'Earn Swap Points on every sale',
    body: 'Active members earn SP when their items sell — the more you sell, the more you save on future purchases.',
  },
  {
    icon: Receipt,
    title: 'Pay a flat $1.49 fee instead of a percentage',
    body: 'Members pay one flat $1.49 safety & platform fee per checkout, instead of the free-user percentage fee.',
  },
  {
    icon: Sparkle,
    title: 'Spend SP on purchases (up to 50%)',
    body: 'Use your earned Swap Points to cover up to half of an item’s price at checkout.',
  },
];

export default function JoinKidsClubScreen() {
  const { user } = useAuth();

  return (
    <ScreenLayout variant="detail" title="Kids Club+" showBell={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        testID="join-kids-club-screen"
      >
        {/* Value proposition */}
        <Text style={styles.headline}>Get more out of every trade</Text>
        <Text style={styles.subheadline}>
          Kids Club+ is a membership that rewards the way you buy and sell on Pass It Up.
        </Text>

        {BENEFITS.map((benefit, index) => {
          const Icon = benefit.icon;
          return (
            <View key={index} style={styles.benefitRow}>
              <View style={styles.iconWrap}>
                <Icon size={22} color="#5DBB8E" weight="fill" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitBody}>{benefit.body}</Text>
              </View>
            </View>
          );
        })}

        {/* Web-only redirect messaging (Step 3) */}
        <View style={styles.webCard}>
          <View style={styles.webCardHeader}>
            <ArrowSquareOut size={18} color="#5DBB8E" weight="bold" />
            <Text style={styles.webCardTitle}>Membership is managed on the web</Text>
          </View>
          <Text style={styles.webCardBody}>
            Complete your Kids Club+ membership on our website. It takes about a minute, and you
            can pay with a card, Apple Pay, or Google Pay.
          </Text>
          <Text style={styles.webCardBody}>
            Your benefits unlock automatically in the app right after you subscribe.
          </Text>
        </View>

        {/* Single non-purchase CTA */}
        <View style={styles.ctaWrap}>
          <JoinKidsClubButton emailHint={user?.email} />
        </View>

        <Text style={styles.footnote}>
          No charge in the app. You'll be taken to passitup.com to complete your membership securely.
        </Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 48 },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
    marginTop: 6,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(93,187,142,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  benefitTextWrap: { flex: 1 },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  benefitBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    marginTop: 2,
  },
  webCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  webCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  webCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
    marginLeft: 8,
  },
  webCardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#166534',
    marginBottom: 6,
  },
  ctaWrap: {
    marginTop: 28,
  },
  footnote: {
    marginTop: 14,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
