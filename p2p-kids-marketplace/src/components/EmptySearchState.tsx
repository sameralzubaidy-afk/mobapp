// File: p2p-kids-marketplace/src/components/EmptySearchState.tsx
// FLOW-26 Screen 2/6: Empty Search Results

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MagnifyingGlass } from 'phosphor-react-native';

interface EmptySearchStateProps {
  query?: string;
}

const EmptySearchState: React.FC<EmptySearchStateProps> = ({ query }) => {
  return (
    <View style={styles.container} testID="empty-search-state">
      <MagnifyingGlass size={56} color="#E0E0E0" testID="empty-search-icon" />
      
      <Text style={styles.title} testID="empty-search-title">
        {query ? `No results for "${query}"` : 'No results found'}
      </Text>
      
      <Text style={styles.subtitle} testID="empty-search-subtitle">
        Try different keywords or filters
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default EmptySearchState;
