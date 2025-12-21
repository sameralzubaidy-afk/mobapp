/**
 * File: p2p-kids-marketplace/src/components/organisms/BottomNavBar/index.tsx
 * Reusable bottom navigation bar for all authenticated screens
 * Shows consistent navigation across all dashboard screens
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface BottomNavBarProps {
  /**
   * Whether to show the help icon
   * @default true
   */
  showHelp?: boolean;
}

export default function BottomNavBar({ showHelp = true }: BottomNavBarProps) {
  const navigation = useNavigation();
  const route = useRoute();

  // Determine if a nav item is active
  const isActive = (routeName: string) => {
    return route.name === routeName;
  };

  const NavItem = ({
    emoji,
    label,
    routeName,
    onPress,
  }: {
    emoji: string;
    label: string;
    routeName?: string;
    onPress?: () => void;
  }) => {
    const active = routeName ? isActive(routeName) : false;
    const handlePress = onPress || (() => {
      if (routeName) {
        (navigation as any).navigate(routeName);
      }
    });

    return (
      <TouchableOpacity
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={handlePress}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <NavItem emoji="🏠" label="Home" routeName="UserDashboard" />
      <NavItem emoji="🛍️" label="Browse" routeName="BrowseItems" />
      <NavItem emoji="📝" label="Create" routeName="CreateListing" />
      <NavItem emoji="📋" label="My Items" routeName="MyListings" />
      <NavItem emoji="👤" label="Profile" routeName="Profile" />
      {showHelp && (
        <NavItem
          emoji="⚙️"
          label="Settings"
          onPress={() => (navigation as any).navigate('Profile')}
        />
      )}
      {showHelp && (
        <NavItem
          emoji="❓"
          label="Help"
          onPress={() => {
            alert('Help & Support - coming soon');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 70,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#F0F0F0',
  },
  emoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  labelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
