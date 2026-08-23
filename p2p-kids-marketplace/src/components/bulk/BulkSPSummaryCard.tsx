/**
 * File: p2p-kids-marketplace/src/components/bulk/BulkSPSummaryCard.tsx
 * MODULE-04 LISTING-V3-011: Bulk SP Summary Card
 * Task: LISTING-V3-011 - SP earnings preview for single & bulk listing
 *
 * Purpose: Show aggregate SP earnings for bulk listing (total + per-category breakdown)
 * UX Decisions implemented:
 * - Decision 8: Summary card above item list (Option B)
 * - Decision 6: Free users see total but grayed-out + upgrade CTA
 * - Per-category breakdown with multipliers
 *
 * @see BRD US-SUB-002: SP earnings preview requirement
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CaretDown, CaretRight, Info, ListBullets } from 'phosphor-react-native';
import { useCategorySPCache } from '../../hooks/useCategorySPCache';
import { calculateBulkTotalSP, formatSP, formatMultiplier } from '../../utils/spCalculations';
import { SPInfoTooltip } from '../modals/SPInfoTooltip';

export interface BulkSPSummaryCardProps {
  items: {
    category_id: string | null;
    price: number;
    includeInPublish?: boolean;
    accepts_swap_points?: boolean;
  }[];
  isSubscriber: boolean;
  onLearnMore?: () => void;
  onUpgradePress?: () => void;
  testID?: string;
}

/**
 * Bulk SP Summary Card
 * Shows total SP + per-category breakdown for bulk listings
 */
export function BulkSPSummaryCard({
  items,
  isSubscriber,
  onLearnMore,
  onUpgradePress,
  testID = 'bulk-sp-summary-card',
}: BulkSPSummaryCardProps) {
  const { getMultiplier, categoryNames, loading, error } = useCategorySPCache();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const includedItems = useMemo(
    () => items.filter((item) => item.includeInPublish === undefined || item.includeInPublish),
    [items]
  );

  const spEnabledItems = useMemo(
    () =>
      includedItems.filter(
        (item) => item.accepts_swap_points === true && item.category_id && item.price > 0
      ),
    [includedItems]
  );

  const spEnabledCount = spEnabledItems.length;
  const includedCount = includedItems.length;
  const nonAcceptingSPCount = useMemo(
    () => includedItems.filter((item) => item.accepts_swap_points !== true).length,
    [includedItems]
  );

  // Calculate total SP and breakdown from SP-enabled items only
  const summary = useMemo(() => {
    if (loading) return null;

    return calculateBulkTotalSP(spEnabledItems, getMultiplier, categoryNames);
  }, [spEnabledItems, getMultiplier, categoryNames, loading]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.loadingText}>Loading SP rates...</Text>
      </View>
    );
  }

  // Error state
  if (error || !summary) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.errorText}>⚠️ SP rates unavailable</Text>
      </View>
    );
  }

  // No items to publish
  if (includedCount === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.placeholderText}>
          💡 Add items with categories and prices to see SP estimate
        </Text>
      </View>
    );
  }

  // Included items exist, but none are SP-enabled
  if (!summary || spEnabledCount === 0 || summary.totalSP === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.header}>
          <ListBullets size={30} color="#5DBB8E" weight="duotone" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Bulk Listing SP Summary</Text>
          <TouchableOpacity
            onPress={() => setShowTooltip(true)}
            accessibilityLabel="What are Swap Points? Tap to learn more"
            accessibilityRole="button"
            testID="sp-info-icon"
            accessible
          >
            <View style={styles.infoIcon}>
              <Info size={12} color="#FFFFFF" weight="bold" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Included items:</Text>
          <Text style={styles.value}>{includedCount}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>SP-enabled items:</Text>
          <Text style={styles.value}>0</Text>
        </View>

        {nonAcceptingSPCount > 0 && (
          <View style={styles.notAcceptingContainer} testID="non-accepting-sp-items">
            <Text style={styles.notAcceptingText}>
              ⚠️ {nonAcceptingSPCount} {nonAcceptingSPCount === 1 ? 'item is' : 'items are'} set to
              Cash Only
            </Text>
          </View>
        )}

        <Text style={styles.placeholderText}>
          Enable “Accept Swap Points” on item cards to include them in SP totals.
        </Text>

        {!isSubscriber && (
          <View style={styles.lockContainer} testID="free-user-message">
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>
              Upgrade to Kids Club+ to earn these points when items sell
            </Text>
          </View>
        )}

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

        <SPInfoTooltip
          visible={showTooltip}
          onClose={() => setShowTooltip(false)}
          onLearnMore={onLearnMore}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <ListBullets size={30} color="#5DBB8E" weight="duotone" style={styles.headerIcon} />
        <Text style={styles.headerTitle}>Bulk Listing SP Summary</Text>
        <TouchableOpacity
          onPress={() => setShowTooltip(true)}
          accessibilityLabel="What are Swap Points? Tap to learn more"
          accessibilityRole="button"
          testID="sp-info-icon"
          accessible
        >
          <View style={styles.infoIcon}>
            <Info size={12} color="#FFFFFF" weight="bold" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Total items */}
      <View style={styles.row}>
        <Text style={styles.label}>Included items:</Text>
        <Text style={styles.value}>{includedCount}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>SP-enabled items:</Text>
        <Text style={styles.value}>{spEnabledCount}</Text>
      </View>

      {nonAcceptingSPCount > 0 && (
        <View style={styles.notAcceptingContainer} testID="non-accepting-sp-items">
          <Text style={styles.notAcceptingText}>
            ⚠️ {nonAcceptingSPCount} {nonAcceptingSPCount === 1 ? 'item is' : 'items are'} set to
            Cash Only
          </Text>
        </View>
      )}

      {/* Total SP estimate */}
      <View style={[styles.row, styles.rowHighlight]}>
        {isSubscriber ? (
          <>
            <Text style={styles.labelBold}>Total estimated SP:</Text>
            <Text style={styles.valueHighlight} testID="total-sp-subscriber">
              {formatSP(summary.totalSP)}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.labelBold, styles.textGrayed]}>Total estimated SP:</Text>
            <Text style={[styles.valueHighlight, styles.textGrayed]} testID="total-sp-free-user">
              {formatSP(summary.totalSP)}
            </Text>
          </>
        )}
      </View>

      {/* Breakdown toggle */}
      {summary.breakdown.length > 0 && (
        <TouchableOpacity
          style={styles.breakdownToggle}
          onPress={() => setShowBreakdown(!showBreakdown)}
          accessibilityLabel={showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
          accessibilityRole="button"
          testID="breakdown-toggle"
          accessible
        >
          <View style={styles.breakdownToggleRow}>
            {showBreakdown ? (
              <CaretDown size={16} color="#047857" weight="bold" />
            ) : (
              <CaretRight size={16} color="#047857" weight="bold" />
            )}
            <Text style={styles.breakdownToggleText}>Per-category breakdown</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Breakdown list */}
      {showBreakdown && summary.breakdown.length > 0 && (
        <View style={styles.breakdownContainer} testID="sp-breakdown">
          {summary.breakdown.map((cat) => (
            <View key={cat.categoryId} style={styles.breakdownRow}>
              <Text style={styles.breakdownCategory}>
                • {cat.categoryName} ({cat.count} {cat.count === 1 ? 'item' : 'items'}):
              </Text>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownSP}>{formatSP(cat.sp)}</Text>
                <Text style={styles.breakdownMultiplier}>({formatMultiplier(cat.multiplier)})</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Free user messaging */}
      {!isSubscriber && (
        <View style={styles.lockContainer} testID="free-user-message">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockText}>
            Upgrade to Kids Club+ to earn these points when items sell
          </Text>
        </View>
      )}

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

      {/* Subscriber confirmation */}
      {isSubscriber && (
        <View style={styles.confirmationContainer} testID="subscriber-confirmation">
          <Text style={styles.confirmationIcon}>✅</Text>
          <Text style={styles.confirmationText}>
            You'll earn {formatSP(summary.totalSP)} from {spEnabledCount}{' '}
            {spEnabledCount === 1 ? 'SP-enabled item' : 'SP-enabled items'}
          </Text>
        </View>
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
    backgroundColor: '#F5FAF7',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    paddingVertical: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowHighlight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  labelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  valueHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5DBB8E',
  },
  textGrayed: {
    color: '#999999',
  },
  breakdownToggle: {
    paddingVertical: 8,
  },
  breakdownToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#047857',
  },
  breakdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notAcceptingContainer: {
    backgroundColor: '#FFF7E6',
    borderColor: '#F2C66D',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  notAcceptingText: {
    fontSize: 13,
    color: '#8A4B08',
    fontWeight: '500',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownCategory: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownSP: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
    marginRight: 6,
  },
  breakdownMultiplier: {
    fontSize: 12,
    color: '#666666',
  },
  lockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  lockIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  lockText: {
    fontSize: 13,
    color: '#856404',
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
  confirmationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  confirmationIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  confirmationText: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
  },
});
