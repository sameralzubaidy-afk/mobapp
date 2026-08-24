/**
 * File: p2p-kids-marketplace/src/components/listing/SPEarningsPreview.tsx
 * MODULE-04 LISTING-V3-011: SP Earnings Preview Component
 * Task: LISTING-V3-011 - SP earnings preview for single & bulk listing
 *
 * Purpose: Show real-time SP earnings estimate for single item listing
 * UX Decisions implemented:
 * - Decision 1: Show only when "Accept SP" toggle is ON (always visible for education)
 * - Decision 2: Real-time calculation with 300ms debounce
 * - Decision 3: Placeholder when no category selected
 * - Decision 5: Tooltip with "What is SP?" + "Learn More" link
 * - Decision 6: Free users see grayed-out estimate + upgrade CTA
 * - Decision 9: "Other" category shows 1.10x default + disclaimer
 * - Decision 10: Disclaimer with (i) icon tooltip
 *
 * @see BRD US-SUB-002: SP earnings preview requirement
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CheckCircle, Coins, Info, LockSimple, WarningCircle } from 'phosphor-react-native';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCategorySPCache } from '../../hooks/useCategorySPCache';
import {
  calculateEarnedSP,
  calculateMaxSpendSP,
  formatSP,
  formatMultiplier,
} from '../../utils/spCalculations';
import { formatDollarAmount } from '../../utils/formatPrice';
import { SPInfoTooltip } from '../modals/SPInfoTooltip';

const DEBOUNCE_MS = 300;

export interface SPEarningsPreviewProps {
  categoryId: string | null;
  price: number;
  isSubscriber: boolean;
  onLearnMore?: () => void;
  onUpgradePress?: () => void;
  testID?: string;
}

/**
 * SP Earnings Preview Component
 * Shows real-time SP estimate based on category + price
 */
export function SPEarningsPreview({
  categoryId,
  price,
  isSubscriber,
  onLearnMore,
  onUpgradePress,
  testID = 'sp-earnings-preview',
}: SPEarningsPreviewProps) {
  const {
    getMultiplier,
    getCategoryName,
    getSpendingCapPercent,
    loading: cacheLoading,
    error: cacheError,
  } = useCategorySPCache();
  const [showTooltip, setShowTooltip] = useState(false);

  // Debounce price to avoid excessive recalculations while typing
  const debouncedPrice = useDebouncedValue(price, DEBOUNCE_MS);

  // Calculate SP estimate (seller earn) + buyer max-SP cap for the selected category.
  // The cap % is read live from the category's DB-configured `sp_spending_cap_percent`
  // (via the same cached category fetch used for the earn multiplier), so admin
  // changes to either value propagate without an app update.
  const estimate = useMemo(() => {
    if (!categoryId) {
      return null; // No category selected
    }

    const multiplier = getMultiplier(categoryId);
    const capPercent = getSpendingCapPercent(categoryId);
    const isOtherCategory =
      categoryId === 'other' || getCategoryName(categoryId).toLowerCase() === 'other';

    if (debouncedPrice <= 0 || !Number.isFinite(debouncedPrice)) {
      // No price yet — the buyer-cap line can still show the category's cap % only
      // (never a nonsensical $0 figure).
      return { sp: 0, multiplier, capPercent, maxBuyerSP: 0, hasPrice: false, isOtherCategory };
    }

    return {
      sp: calculateEarnedSP(debouncedPrice, multiplier),
      multiplier,
      capPercent,
      // Buyer-side limit — same formula the backend enforces at checkout
      // (Math.floor(price * capPercent / 100)).
      maxBuyerSP: calculateMaxSpendSP(debouncedPrice, capPercent),
      hasPrice: true,
      isOtherCategory,
    };
  }, [categoryId, debouncedPrice, getMultiplier, getCategoryName, getSpendingCapPercent]);

  // Loading state while cache initializes
  if (cacheLoading) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading SP rates...</Text>
        </View>
      </View>
    );
  }

  // Cache error - show fallback (only when we cannot resolve any category data)
  if (cacheError && !categoryId) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ SP rates unavailable (network issue)</Text>
        </View>
      </View>
    );
  }

  // Placeholder: No category selected
  if (!categoryId) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.placeholderContainer}>
          <Info size={20} color="#6B6B6B" weight="regular" style={styles.placeholderIcon} />
          <Text style={styles.placeholderText}>Select a category to see estimated SP earnings</Text>
        </View>
      </View>
    );
  }

  // Type guard: `estimate` is null only when categoryId is null (handled above),
  // so from here on it is guaranteed non-null for the main display.
  if (!estimate) {
    return null;
  }

  // Placeholder: Price not entered
  const showEarnEstimate = estimate.hasPrice && estimate.sp > 0;

  // Main estimate display
  return (
    <View style={styles.container} testID={testID}>
      {/* Header with info icon */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Swap Points Estimate</Text>
        <TouchableOpacity
          onPress={() => setShowTooltip(true)}
          accessibilityLabel="What are Swap Points? Tap to learn more"
          accessibilityRole="button"
          testID="sp-info-icon"
          accessible
        >
          <View style={styles.infoIcon}>
            <Info size={14} color="#FFFFFF" weight="bold" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Estimate display */}
      <View style={[styles.estimateContainer, !isSubscriber && styles.estimateContainerLocked]}>
        {showEarnEstimate ? (
          <>
            {isSubscriber ? (
              <View style={styles.estimateRow} testID="sp-estimate-subscriber">
                <CheckCircle size={18} color="#5DBB8E" weight="fill" style={styles.statusIcon} />
                <Text style={styles.estimateLabel}>You'll earn:</Text>
                <Text style={styles.estimateValue}>{formatSP(estimate.sp)}</Text>
              </View>
            ) : (
              <View testID="sp-estimate-free-user">
                <View style={styles.estimateRow}>
                  <LockSimple size={18} color="#9A9A9A" weight="fill" style={styles.statusIcon} />
                  <Text style={[styles.estimateLabel, styles.textGrayed]}>You'll earn:</Text>
                  <Text style={[styles.estimateValue, styles.textGrayed]}>
                    {formatSP(estimate.sp)}
                  </Text>
                </View>
                <Text style={styles.lockSubtext}>(Upgrade to Kids Club+ to unlock)</Text>
              </View>
            )}

            {/* Multiplier display */}
            <Text style={styles.multiplierText}>
              {formatMultiplier(estimate.multiplier)} multiplier for this category
            </Text>

            {/* "Other" category disclaimer */}
            {estimate.isOtherCategory && (
              <View style={styles.disclaimerContainer} testID="other-category-disclaimer">
                <WarningCircle
                  size={16}
                  color="#CA8A04"
                  weight="fill"
                  style={styles.disclaimerIcon}
                />
                <Text style={styles.disclaimerText}>
                  Base rate - may change after admin approval
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholderRow} testID="sp-price-placeholder">
            <Info size={20} color="#6B6B6B" weight="regular" style={styles.placeholderIcon} />
            <Text style={styles.placeholderText}>Enter a price above to see SP estimate</Text>
          </View>
        )}
      </View>

      {/* Buyer max-SP cap line (J15): what a BUYER could pay with SP for this
          category — distinct from the seller-earn line above. The cap % comes
          from the category's DB `sp_spending_cap_percent`, never hardcoded. */}
      <View style={styles.buyerCapContainer} testID="buyer-cap-line">
        <Coins size={16} color="#F59E0B" weight="fill" style={styles.buyerCapIcon} />
        <Text style={styles.buyerCapText}>
          {estimate.hasPrice && estimate.maxBuyerSP > 0
            ? `Buyers can pay up to ${formatSP(
                estimate.maxBuyerSP
              )} toward this ${formatDollarAmount(debouncedPrice)} price with Swap Points`
            : `Buyers can pay up to ${estimate.capPercent}% of the price with Swap Points`}
        </Text>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerRow}>
        <TouchableOpacity
          onPress={() => setShowTooltip(true)}
          accessibilityLabel="Tap for more info about SP estimate"
          testID="disclaimer-info-icon"
          accessible
          accessibilityRole="button"
        >
          <View style={styles.disclaimerInfoIcon}>
            <Info size={10} color="#FFFFFF" weight="bold" />
          </View>
        </TouchableOpacity>
        <Text style={styles.disclaimerSmall}>
          *Estimated based on list price. Actual SP may vary.
        </Text>
      </View>

      {/* Free user upgrade CTA */}
      {!isSubscriber && onUpgradePress && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgradePress}
          accessibilityLabel="Upgrade to Kids Club Plus to earn Swap Points"
          accessibilityRole="button"
          testID="upgrade-cta"
          accessible
        >
          <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
        </TouchableOpacity>
      )}

      {/* Tooltip */}
      <SPInfoTooltip
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        onLearnMore={onLearnMore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B6B6B',
    marginLeft: 8,
  },
  errorContainer: {
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  placeholderIcon: {
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  // Buyer max-SP cap line (J15): visually distinct gold-tinted row so it is never
  // confused with the seller-earn estimate above it.
  buyerCapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#F5E3B8',
  },
  buyerCapIcon: {
    marginRight: 8,
  },
  buyerCapText: {
    fontSize: 13,
    color: '#7A5C00',
    flex: 1,
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  estimateContainerLocked: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D0D0D0',
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIcon: {
    marginRight: 8,
  },
  estimateLabel: {
    fontSize: 15,
    color: '#333333',
    marginRight: 8,
  },
  estimateValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5DBB8E',
  },
  textGrayed: {
    color: '#999999',
  },
  lockSubtext: {
    fontSize: 13,
    color: '#6B6B6B',
    marginLeft: 26,
    fontStyle: 'italic',
  },
  multiplierText: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 4,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  disclaimerIcon: {
    marginRight: 6,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#CA8A04',
    flex: 1,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  disclaimerInfoIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6B6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  disclaimerSmall: {
    fontSize: 11,
    color: '#7A7A7A',
    fontStyle: 'italic',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
