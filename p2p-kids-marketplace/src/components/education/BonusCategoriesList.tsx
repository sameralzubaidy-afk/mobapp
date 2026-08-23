// FILE: p2p-kids-marketplace/src/components/education/BonusCategoriesList.tsx
// MODULE-18 EDU-005: Bonus categories list (sp_earning_multiplier > 1.10)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getBonusCategories } from '../../services/spCalculatorService';
import type { BonusCategory } from '../../types/education';
import { BonusCategoryBadge } from './BonusCategoryBadge';

interface BonusCategoriesListProps {
  testID?: string;
  /**
   * Bump this to re-fetch bonus categories (e.g. on screen focus or
   * pull-to-refresh) so an admin's multiplier change is reflected without a
   * full remount. QA: Group Q+S 2026-08-23 Item 3.
   */
  refreshKey?: number;
}

export function BonusCategoriesList({
  testID = 'bonus-categories-list',
  refreshKey = 0,
}: BonusCategoriesListProps) {
  const [categories, setCategories] = useState<BonusCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBonusCategories();
  }, [refreshKey]);

  const loadBonusCategories = async () => {
    try {
      setLoading(true);
      const cats = await getBonusCategories();
      setCategories(cats);
    } catch (error) {
      console.error('[BonusCategoriesList] Load error:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Only block on the FIRST load. On refreshKey re-fetches keep the existing
  // data visible (no spinner flash) and swap in the fresh rates when they land.
  if (loading && categories.length === 0) {
    return (
      <View style={styles.loadingContainer} testID={`${testID}-loading`}>
        <ActivityIndicator size="small" color="#5DBB8E" />
      </View>
    );
  }

  if (categories.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No bonus categories available at this time.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.sectionTitle}>Bonus Categories</Text>
      <Text style={styles.sectionSubtitle}>
        These categories earn extra Swap Points when you sell items!
      </Text>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={styles.categoryRow}
            testID={`${testID}-item-${item.id}`}
            accessible={true}
            accessibilityLabel={`${item.name}. Bonus category. Earns ${item.sp_earning_multiplier} times Swap Points.`}
            accessibilityRole="text"
          >
            <Text style={styles.categoryIcon}>{item.icon || '📦'}</Text>
            <View style={styles.categoryInfo}>
              <View style={styles.categoryNameRow}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <BonusCategoryBadge
                  iconUrl={item.bonus_badge_icon_url}
                  testID={`${testID}-badge-${item.id}`}
                />
              </View>
              <Text style={styles.earnRate}>
                Earn {item.sp_earning_multiplier.toFixed(2)}× SP
              </Text>
            </View>
          </View>
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    marginBottom: 12,
  },
  listContent: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 8,
  },
  earnRate: {
    fontSize: 13,
    color: '#5DBB8E',
    fontWeight: '500',
  },
});
