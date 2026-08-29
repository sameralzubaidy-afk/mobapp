/**
 * File: p2p-kids-marketplace/src/components/listing/CategorySelectModal.tsx
 * MODULE-04 LISTING-V3-008: Category Select Modal
 * Task: LISTING-V3-008 - Full-screen category selection with search
 * Updated: ADMIN-V3-007 - Show bonus badges
 *
 * Features:
 * - Search categories
 * - Recent 3 categories
 * - All active categories list (no item counts)
 * - Bonus badges for sp_earning_multiplier > 1.10
 * - "Other" option with custom input
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BonusBadge } from '../shared/BonusBadge';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  icon_url?: string | null;
  bonus_badge_icon_url?: string | null;
  sp_earning_multiplier?: number | null;
  item_count?: number;
}

export interface CategorySelectModalProps {
  visible: boolean;
  categories: Category[];
  recent: Category[];
  onSelect: (category: Category) => void;
  onSelectOther: (customName: string) => void;
  onClose: () => void;
  testID?: string;
}

export function CategorySelectModal({
  visible,
  categories,
  recent,
  onSelect,
  onSelectOther,
  onClose,
  testID = 'category-select-modal',
}: CategorySelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectOther = () => {
    if (customCategory.trim().length > 0) {
      onSelectOther(customCategory.trim());
      setCustomCategory('');
      setShowOtherInput(false);
    }
  };

  const renderCategory = ({ item }: { item: Category }) => {
    // Bonus badge is shown only for categories with SP earn multiplier strictly greater than 1.10.
    // This matches the product rule used in admin and marketplace logic (MODULE-12 V3).
    const showBonusBadge = Number(item.sp_earning_multiplier ?? 1.1) > 1.1;

    return (
      <TouchableOpacity
        accessible
        style={styles.categoryItem}
        onPress={() => {
          onSelect(item);
          setSearchQuery('');
        }}
        accessibilityLabel={`Select category: ${item.name}`}
        accessibilityRole="button"
        testID={`category-${item.id}`}
      >
        {item.icon_url ? (
          <Image
            source={{ uri: item.icon_url }}
            style={styles.categoryIconImage}
            resizeMode="cover"
          />
        ) : item.icon && item.icon.trim().length > 0 ? (
          <Text style={styles.categoryIcon}>{item.icon}</Text>
        ) : (
          <Text style={styles.categoryIcon}>📦</Text>
        )}

        <View style={styles.categoryTextRow}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {showBonusBadge && (
            <BonusBadge
              iconUrl={item.bonus_badge_icon_url}
              size="small"
              style={styles.bonusBadgeContainer}
              testID={`bonus-badge-${item.id}`}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Category</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close category selection"
            accessibilityRole="button"
            testID="close-modal"
            accessible
          >
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        </View>

        <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
          style={styles.searchInput}
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search categories"
          testID="category-search-input"
        />

        {!showOtherInput && recent.length > 0 && searchQuery === '' && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.recentList}>
              {recent.map((cat) => (
                <TouchableOpacity
                  accessible
                  accessibilityRole="button"
                  key={cat.id}
                  style={styles.recentChip}
                  onPress={() => onSelect(cat)}
                  accessibilityLabel={`Select recent category: ${cat.name}`}
                  testID={`recent-${cat.id}`}
                >
                  <Text style={styles.recentChipText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!showOtherInput ? (
          <FlatList
            data={filteredCategories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No categories found</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.otherInputContainer}>
            <Text style={styles.otherLabel}>Enter custom category name:</Text>
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              style={styles.otherInput}
              placeholder="e.g., Baby Gear, Sports Equipment"
              value={customCategory}
              onChangeText={setCustomCategory}
              autoFocus
              maxLength={100}
              accessibilityLabel="Custom category name"
              testID="custom-category-input"
            />
            <Text style={styles.otherHint}>This will be sent to admin for review</Text>
            <View style={styles.otherActions}>
              <TouchableOpacity
                style={styles.otherCancelButton}
                onPress={() => {
                  setShowOtherInput(false);
                  setCustomCategory('');
                }}
                testID="cancel-other"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Cancel other"
              >
                <Text style={styles.otherCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.otherSubmitButton,
                  customCategory.trim().length === 0 && styles.otherSubmitButtonDisabled,
                ]}
                onPress={handleSelectOther}
                disabled={customCategory.trim().length === 0}
                testID="submit-other"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Submit other"
              >
                <Text style={styles.otherSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showOtherInput && (
          <TouchableOpacity
            style={styles.otherButton}
            onPress={() => setShowOtherInput(true)}
            accessibilityLabel="Select other category not in list"
            accessibilityRole="button"
            testID="other-button"
            accessible
          >
            <Text style={styles.otherButtonText}>+ Other (Custom Category)</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    fontSize: 36,
    color: '#999999',
    lineHeight: 36,
    width: 36,
    textAlign: 'center',
  },
  searchInput: {
    margin: 16,
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  recentSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 12,
  },
  recentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E8F5F0',
    borderRadius: 16,
  },
  recentChipText: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryIconImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  categoryTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bonusBadgeContainer: {
    marginLeft: 8,
  },
  bonusBadgeFallback: {
    marginLeft: 8,
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
  },
  otherButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  otherInputContainer: {
    padding: 16,
  },
  otherLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  otherInput: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  otherHint: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 24,
  },
  otherActions: {
    flexDirection: 'row',
    gap: 12,
  },
  otherCancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5DBB8E',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5DBB8E',
  },
  otherSubmitButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherSubmitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  otherSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
