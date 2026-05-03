import React from 'react';
import { StyleSheet, View } from 'react-native';
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
}: ItemCardStackProps) {
  return (
    <View style={styles.container} testID="item-card-stack">
      {items.map((item, index) => (
        <BulkItemCard
          key={item.groupId}
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
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
});
