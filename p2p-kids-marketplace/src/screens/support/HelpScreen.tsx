// FILE: p2p-kids-marketplace/src/screens/support/HelpScreen.tsx
// MODULE-15.1 FLOW-19: Help & Support — FAQ Screen (Visual Redesign)
// FAQs are now fetched from Supabase; falls back to hardcoded data if offline.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  MagnifyingGlass,
  Question,
  CaretRight,
} from 'phosphor-react-native';
import { fetchPublishedFaqs, type FAQ } from '../../services/faqService';
import ScreenLayout from '@/components/ScreenLayout';

interface HelpScreenProps {
  navigation: any;
}

export default function HelpScreen({ navigation }: HelpScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [faqData, setFaqData] = useState<FAQ[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const faqListRef = useRef<FlatList<FAQ>>(null);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    const { faqs, categories: cats } = await fetchPublishedFaqs();
    setFaqData(faqs);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  useEffect(() => {
    faqListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery, selectedCategory]);

  // Filter FAQs based on search and category
  const filteredFAQs = faqData.filter((faq) => {
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFAQPress = (faq: FAQ) => {
    navigation.navigate('FAQDetail', { faq });
  };

  return (
    <ScreenLayout
      variant="detail"
      title="Help & Support"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <MagnifyingGlass size={20} color="#999999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help articles…"
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
            accessibilityLabel="Search help articles"
          />
        </View>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
          testID="category-chips-scroll"
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.chip,
                selectedCategory === category ? styles.chipActive : styles.chipInactive,
              ]}
              onPress={() => setSelectedCategory(category)}
              testID={`category-chip-${category.toLowerCase().replace(/\s/g, '-')}`}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${category}`}
              accessibilityState={{ selected: selectedCategory === category }}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === category ? styles.chipTextActive : styles.chipTextInactive,
                ]}
                numberOfLines={1}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ List / Loading */}
        <View style={styles.listSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5DBB8E" testID="loading-indicator" />
            </View>
          ) : (
            <FlatList
              ref={faqListRef}
              data={filteredFAQs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => handleFAQPress(item)}
                  testID={`faq-row-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={item.question}
                >
                  <Question size={16} color="#5DBB8E" />
                  <Text style={styles.faqText}>{item.question}</Text>
                  <CaretRight size={16} color="#999999" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={(
                <View style={styles.emptyState} testID="empty-state">
                  <Question size={64} color="#E0E0E0" />
                  <Text style={styles.emptyTitle}>No results found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search or category</Text>
                </View>
              )}
              style={styles.faqList}
              contentContainerStyle={filteredFAQs.length === 0 ? styles.emptyContainer : styles.listContent}
              keyboardShouldPersistTaps="handled"
              testID="faq-list"
            />
          )}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 0,
  },
  categoriesScroll: {
    flexGrow: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chip: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#5DBB8E',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    includeFontPadding: false,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: '#444444',
  },
  listSection: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  faqList: {
    flex: 1,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  faqText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    marginTop: 8,
    textAlign: 'center',
  },
});
