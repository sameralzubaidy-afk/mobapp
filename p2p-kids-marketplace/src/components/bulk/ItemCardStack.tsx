import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BulkEditableItem, BulkItemCard } from './BulkItemCard';

interface ItemCardStackProps {
  items: BulkEditableItem[];
  expandedGroupId: string | null;
  onExpand: (groupId: string | null) => void;
  onToggleInclude: (groupId: string, include: boolean) => void;
  onChangeItem: (groupId: string, patch: Partial<BulkEditableItem>) => void;
  onOpenCategoryPicker: (groupId: string) => void;
  canAcceptSP?: boolean;
  checkingSubscription?: boolean;
  onUpgradePress?: () => void;
  /** V3.1 UX overhaul (Decision 11): per-card AI retry */
  onRetryAI?: (groupId: string) => void;
  /** Minimum listing price threshold for price_below_minimum chip text */
  minListingPrice?: number;
  /** DT71 (2026-08-31): dev-only price value + per-item setter for QA below-threshold testing */
  devPriceValue?: string;
  onDevSetPrice?: (index: number) => void;
}

/**
 * V3.1 UX overhaul (Decision 8): vertical, scannable list of bulk items.
 * Replaces the previous horizontal carousel.
 */
export function ItemCardStack({
  items,
  expandedGroupId,
  onExpand,
  onToggleInclude,
  onChangeItem,
  onOpenCategoryPicker,
  canAcceptSP = false,
  checkingSubscription = false,
  onUpgradePress,
  onRetryAI,
  minListingPrice = 0,
  devPriceValue = '3',
  onDevSetPrice,
}: ItemCardStackProps) {
  return (
    <View style={styles.container} testID="item-card-stack">
      {items.map((item, index) => (
        <View key={item.groupId} style={styles.itemWrap}>
          <BulkItemCard
            item={item}
            index={index}
            expanded={expandedGroupId === item.groupId}
            onToggleExpanded={() => onExpand(expandedGroupId === item.groupId ? null : item.groupId)}
            onToggleInclude={(include) => onToggleInclude(item.groupId, include)}
            onChange={(patch) => onChangeItem(item.groupId, patch)}
            onOpenCategoryPicker={() => onOpenCategoryPicker(item.groupId)}
            canAcceptSP={canAcceptSP}
            checkingSubscription={checkingSubscription}
            onUpgradePress={onUpgradePress}
            onRetryAI={onRetryAI ? () => onRetryAI(item.groupId) : undefined}
            minListingPrice={minListingPrice}
          />
          {__DEV__ && onDevSetPrice && (
            <TouchableOpacity
              style={styles.devSetPriceButton}
              onPress={() => onDevSetPrice(index)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Set item ${index + 1} price to ${devPriceValue} (dev only)`}
              testID={`dev-set-bulk-price-${index}`}
            >
              <Text style={styles.devSetPriceText}>Dev: Set Price {devPriceValue}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  itemWrap: {
    marginBottom: 8,
  },
  devSetPriceButton: {
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  devSetPriceText: {
    color: '#2E7D5B',
    fontSize: 12,
    fontWeight: '600',
  },
});
