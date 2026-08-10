/**
 * File: p2p-kids-marketplace/src/screens/subscription/PlanComparisonScreen.tsx
 * MODULE-15.1 FLOW-12 Screen 2: Plan Comparison
 * 
 * TASK: Redesign PlanComparisonScreen — VISUAL ONLY
 * DO NOT CHANGE: feature data, plan selection handler, navigation
 * ONLY CHANGE: StyleSheet, icons → Phosphor
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Crown, CrownSimple, CheckCircle, X } from 'phosphor-react-native';
import {
  getSubscriptionPrice,
  getTrialDays,
  getActiveMemberFeeCents,
} from '@/services/adminConfig';
import { TIER_COMPARISON_ROWS } from '@/constants/subscriptionPlans';
import { formatDollarAmount, formatPrice } from '@/utils/formatPrice';
import type { RootStackParamList } from '@/navigation/types';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PlanComparisonScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [monthlyPrice, setMonthlyPrice] = useState<number>(0);
  const [trialDays, setTrialDays] = useState<number>(30);
  // R1 — Tiered Buyer-Fee Engine: flat active-member fee (dynamic from admin_config).
  const [activeMemberFlatCents, setActiveMemberFlatCents] = useState<number>(149);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [price, trial, memberFeeCents] = await Promise.all([
          getSubscriptionPrice(true),
          getTrialDays(true),
          getActiveMemberFeeCents(true),
        ]);

        setMonthlyPrice(price || 0);
        setTrialDays(trial || 30);
        setActiveMemberFlatCents(memberFeeCents);
      } catch (err) {
        console.error('[PlanComparisonScreen] Failed to load config:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const comparisonRows = TIER_COMPARISON_ROWS.map((row) => {
    if (row.key === 'monthly_subscription') {
      return {
        ...row,
        kidsClubPlus: `${formatDollarAmount(monthlyPrice)}/mo`,
      };
    }
    if (row.key === 'trial_period') {
      return {
        ...row,
        kidsClubPlus: `${trialDays} days`,
      };
    }
    if (row.key === 'transaction_fee') {
      // R1 — Tiered Buyer-Fee Engine: free users pay a flat fee on their first
      // trade then a percentage fee after; members pay one flat fee always.
      return {
        ...row,
        name: 'Transaction fee (per trade)',
        free: 'Flat on 1st trade, then %',
        kidsClubPlus: `${formatPrice(activeMemberFlatCents)} flat`,
      };
    }

    return row;
  });

  const handleChoosePlan = (planId: 'free' | 'kids_club_plus') => {
    if (planId === 'free') {
      navigation.goBack();
      return;
    }
    navigation.navigate('JoinKidsClub');
  };

  const renderCell = (value: boolean | string, planType: 'free' | 'kids_club_plus') => {
    const color = planType === 'free' ? '#6B6B6B' : '#5DBB8E';

    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle size={16} color={color} weight="fill" testID={`check-${planType}`} />
      ) : (
        <X size={16} color="#E0E0E0" weight="regular" testID={`x-${planType}`} />
      );
    }
    return (
      <Text style={[styles.cellValueText, { color }]} testID={`value-${planType}`}>
        {value}
      </Text>
    );
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Compare Plans">
        <LoadingSpinner />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Compare Plans">
      <ScrollView style={styles.container}>
        {/* Header with Gradient Background */}
        <View style={styles.headerGradient}>
          <View style={styles.header}>
            <Crown size={40} color="#5DBB8E" weight="fill" />
            <Text style={styles.title}>Choose What Works For You</Text>
            <Text style={styles.subtitle}>Join thousands of parents trading smarter</Text>
          </View>
        </View>

        {/* Value Prop Banner */}
        <View style={styles.valueProposition}>
          <Text style={styles.valuePropText}>
            💡 <Text style={styles.valuePropBold}>Kids Club+</Text> members save an average of $45/month
          </Text>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <View style={[styles.colHeader, styles.featureNameCol]} />

          {/* Free Column Header */}
          <View style={[styles.colHeader, styles.planCol, styles.colHeaderFree]} testID="header-free">
            <CrownSimple size={20} color="#6B6B6B" weight="regular" />
            <Text style={styles.colHeaderText}>Free</Text>
            <Text style={styles.colHeaderPrice}>$0</Text>
            <Text style={styles.colHeaderSubtext}>Forever</Text>
          </View>

          {/* Kids Club+ Column Header with Popular Badge */}
          <View
            style={[styles.colHeader, styles.planCol, styles.colHeaderKidsClub]}
            testID="header-kids-club-plus"
          >
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>POPULAR</Text>
            </View>
            <Crown size={24} color="#5DBB8E" weight="fill" />
            <Text style={[styles.colHeaderText, styles.colHeaderTextKidsClub]}>Kids Club+</Text>
            <Text style={[styles.colHeaderPrice, styles.colHeaderPriceKidsClub]}>
              {formatDollarAmount(monthlyPrice)}
            </Text>
            <Text style={styles.colHeaderSubtextGreen}>/month</Text>
          </View>
        </View>

        {/* Feature Rows */}
        <View style={styles.tableBody}>
          {comparisonRows.map((feature, index) => (
            <View key={index} style={styles.featureRow} testID={`feature-row-${index}`}>
              <View style={styles.featureNameCol}>
                <Text style={styles.featureName}>{feature.name}</Text>
              </View>
              <View style={styles.featureCell}>{renderCell(feature.free, 'free')}</View>
              <View style={[styles.featureCell, styles.featureCellHighlight]}>
                {renderCell(feature.kidsClubPlus, 'kids_club_plus')}
              </View>
            </View>
          ))}
        </View>

        {/* Benefits Highlight Section */}
        <View style={styles.benefitsHighlight}>
          <Text style={styles.benefitsTitle}>Why Upgrade to Kids Club+?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              <Text style={styles.benefitItemText}>
                <Text style={styles.benefitBold}>Trade with PIPs</Text> — help others save while saving yourself
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              <Text style={styles.benefitItemText}>
                <Text style={styles.benefitBold}>Lower fees</Text> — keep more of what you earn
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={20} color="#5DBB8E" weight="fill" />
              <Text style={styles.benefitItemText}>
                <Text style={styles.benefitBold}>{trialDays}-day free trial</Text> — try risk-free, cancel anytime
              </Text>
            </View>
          </View>
        </View>

        {/* CTA Row */}
        <View style={styles.ctaRow}>
          <View style={styles.ctaColumn}>
            <Text style={styles.ctaLabel}>Current</Text>
            <TouchableOpacity
              style={[styles.ctaButton, styles.ctaButtonFree]}
              onPress={() => handleChoosePlan('free')}
              testID="choose-free"
            >
              <Text style={styles.ctaButtonTextFree}>Free Plan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ctaColumn}>
            <Text style={[styles.ctaLabel, styles.ctaLabelPlus]}>Recommended</Text>
            <TouchableOpacity
              style={[styles.ctaButton, styles.ctaButtonKidsClub]}
              onPress={() => handleChoosePlan('kids_club_plus')}
              testID="choose-kids-club-plus"
            >
              <Text style={styles.ctaButtonText} numberOfLines={1} adjustsFontSizeToFit>
                Start {trialDays}-day Trial
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Trust Badge */}
        <View style={styles.trustBadge}>
          <Text style={styles.trustBadgeText}>
            ✓ Cancel anytime · No hidden fees · Safe & secure
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  // Hero Header with Gradient
  headerGradient: {
    backgroundColor: '#F0FDF4', // Subtle green tint
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  // Value Proposition Banner
  valueProposition: {
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#5DBB8E',
  },
  valuePropText: {
    fontSize: 15,
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 22,
  },
  valuePropBold: {
    fontWeight: '700',
    color: '#5DBB8E',
  },
  // Table Header
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  colHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  featureNameCol: {
    flex: 2,
    justifyContent: 'center',
  },
  planCol: {
    flex: 1,
    gap: 4,
  },
  colHeaderFree: {
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  colHeaderKidsClub: {
    borderBottomWidth: 3,
    borderBottomColor: '#5DBB8E',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    marginHorizontal: 4,
    paddingHorizontal: 8,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  colHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 4,
  },
  colHeaderTextKidsClub: {
    color: '#5DBB8E',
  },
  colHeaderPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  colHeaderPriceKidsClub: {
    color: '#5DBB8E',
  },
  colHeaderSubtext: {
    fontSize: 11,
    color: '#999999',
  },
  colHeaderSubtextGreen: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  // Table Body
  tableBody: {
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  featureRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  featureName: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  featureCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCellHighlight: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  cellValueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Benefits Highlight Section
  benefitsHighlight: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F5F0',
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitItemText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  benefitBold: {
    fontWeight: '700',
    color: '#5DBB8E',
  },
  // CTA Row
  ctaRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  ctaColumn: {
    flex: 1,
    gap: 8,
  },
  ctaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ctaLabelPlus: {
    color: '#5DBB8E',
  },
  ctaButton: {
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaButtonFree: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ctaButtonKidsClub: {
    backgroundColor: '#5DBB8E',
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 8,
  },
  ctaButtonTextFree: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  // Trust Badge Footer
  trustBadge: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  trustBadgeText: {
    fontSize: 13,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 20,
  },
});
