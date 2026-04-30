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

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCategorySPCache } from '../../hooks/useCategorySPCache';
import { calculateEarnedSP, formatSP, formatMultiplier } from '../../utils/spCalculations';
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
  const { getMultiplier, getCategoryName, loading: cacheLoading, error: cacheError } = useCategorySPCache();
  const [showTooltip, setShowTooltip] = useState(false);

  // Debounce price to avoid excessive recalculations while typing
  const debouncedPrice = useDebouncedValue(price, DEBOUNCE_MS);

  // Calculate SP estimate
  const estimate = useMemo(() => {
    if (!categoryId) {
      return null; // No category selected
    }

    if (debouncedPrice <= 0 || !Number.isFinite(debouncedPrice)) {
      return null; // Invalid price
    }

    const multiplier = getMultiplier(categoryId);
    const sp = calculateEarnedSP(debouncedPrice, multiplier);

    return {
      sp,
      multiplier,
      isOtherCategory: categoryId === 'other' || getCategoryName(categoryId).toLowerCase() === 'other',
    };
  }, [categoryId, debouncedPrice, getMultiplier, getCategoryName]);

  // Loading state while cache initializes
  if (cacheLoading) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading SP rates...</Text>
        </View>
      </View>
    );
  }

  // Cache error - show fallback
  if (cacheError && !estimate) {
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
          <Text style={styles.placeholderIcon}>💡</Text>
          <Text style={styles.placeholderText}>Select a category to see estimated SP earnings</Text>
        </View>
      </View>
    );
  }

  // Placeholder: Price not entered
  if (!estimate || estimate.sp === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>💵</Text>
          <Text style={styles.placeholderText}>Enter a price above to see SP estimate</Text>
        </View>
      </View>
    );
  }

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
        >
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>i</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Estimate display */}
      <View style={[styles.estimateContainer, !isSubscriber && styles.estimateContainerLocked]}>
        {isSubscriber ? (
          <View style={styles.estimateRow} testID="sp-estimate-subscriber">
            <Text style={styles.checkmark}>✅</Text>
            <Text style={styles.estimateLabel}>You'll earn:</Text>
            <Text style={styles.estimateValue}>{formatSP(estimate.sp)}</Text>
          </View>
        ) : (
          <View testID="sp-estimate-free-user">
            <View style={styles.estimateRow}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={[styles.estimateLabel, styles.textGrayed]}>You'll earn:</Text>
              <Text style={[styles.estimateValue, styles.textGrayed]}>{formatSP(estimate.sp)}</Text>
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
            <Text style={styles.disclaimerIcon}>⚠️</Text>
            <Text style={styles.disclaimerText}>
              Base rate - may change after admin approval
            </Text>
          </View>
        )}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerRow}>
        <TouchableOpacity
          onPress={() => setShowTooltip(true)}
          accessibilityLabel="Tap for more info about SP estimate"
          testID="disclaimer-info-icon"
        >
          <View style={styles.disclaimerInfoIcon}>
            <Text style={styles.disclaimerInfoIconText}>i</Text>
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
    backgroundColor: '#F8F9FA',
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
    color: '#666666',
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
    fontSize: 24,
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
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
    color: '#000000',
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  checkmark: {
    fontSize: 18,
    marginRight: 8,
  },
  lockIcon: {
    fontSize: 18,
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
    color: '#007AFF',
  },
  textGrayed: {
    color: '#999999',
  },
  lockSubtext: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 26,
    fontStyle: 'italic',
  },
  multiplierText: {
    fontSize: 13,
    color: '#666666',
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
    fontSize: 16,
    marginRight: 6,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#FF9500',
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
    backgroundColor: '#999999',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  disclaimerInfoIconText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disclaimerSmall: {
    fontSize: 11,
    color: '#888888',
    fontStyle: 'italic',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
