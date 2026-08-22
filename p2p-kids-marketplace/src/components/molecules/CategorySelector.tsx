/**
 * File: p2p-kids-marketplace/src/components/molecules/CategorySelector.tsx
 * MODULE-05-DISCOVERY-V2: Category Browsing
 *
 * Horizontal scrollable category selector for the Home Feed.
 */

import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const CATEGORIES = [
  { name: 'Toys', icon: '🧸' },
  { name: 'Games', icon: '🎮' },
  { name: 'Books', icon: '📚' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Electronics', icon: '💻' },
  { name: 'Art & Crafts', icon: '🎨' },
];

export default function CategorySelector({ showTitle = true }: { showTitle?: boolean }) {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.sectionTitle}>Browse Categories</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.name}
            testID={`category-tile-${cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            style={styles.categoryItem}
            onPress={() => (navigation as any).navigate('CategoryBrowse', { category: cat.name })}
            accessible
            accessibilityRole="button"
            accessibilityLabel={cat.name}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  categoryItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  icon: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
  },
});
