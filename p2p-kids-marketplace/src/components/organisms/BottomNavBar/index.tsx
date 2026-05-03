/**
 * File: p2p-kids-marketplace/src/components/organisms/BottomNavBar/index.tsx
 * Reusable bottom navigation bar for all authenticated screens
 * Shows consistent navigation across all dashboard screens
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';

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
  const { session } = useAuth();
  const { unreadCount } = useNotificationBadge(session?.user?.id);
  const [sellSheetVisible, setSellSheetVisible] = React.useState(false);

  // Determine if a nav item is active
  const isActive = (routeName: string) => {
    return route.name === routeName;
  };

  const NavItem = ({
    emoji,
    label,
    routeName,
    onPress,
    badgeCount,
  }: {
    emoji: string;
    label: string;
    routeName?: string;
    onPress?: () => void;
    badgeCount?: number;
  }) => {
    const active = routeName ? isActive(routeName) : false;
    const handlePress =
      onPress ||
      (() => {
        if (routeName) {
          (navigation as any).navigate(routeName);
        }
      });

    return (
      <TouchableOpacity
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={handlePress}
        testID={'nav-' + label.replace(/\s+/g, '-').toLowerCase()}
      >
        <View style={styles.emojiWrapper}>
          <Text style={styles.emoji}>{emoji}</Text>
          {typeof badgeCount === 'number' && badgeCount > 0 && (
            <View testID="notification-badge" style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : String(badgeCount)}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <NavItem emoji="🏠" label="Home" routeName="Home" />
      <NavItem emoji="�" label="Discover" routeName="Discover" />
      <NavItem emoji="💰" label="Sell" onPress={() => setSellSheetVisible(true)} />
      <NavItem emoji="📋" label="My Items" routeName="MyListings" />
      <NavItem emoji="🔔" label="Alerts" routeName="Notifications" badgeCount={unreadCount} />
      <NavItem emoji="👤" label="Profile" routeName="Profile" />
      {showHelp && (
        <NavItem
          emoji="⚙️"
          label="Settings"
          onPress={() => (navigation as any).navigate('Settings')}
        />
      )}

      <Modal
        transparent
        animationType="slide"
        visible={sellSheetVisible}
        onRequestClose={() => setSellSheetVisible(false)}
        testID="sell-options-sheet"
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSellSheetVisible(false)}>
          <View style={styles.sheetContainer}>
            <Text style={styles.sheetTitle}>Sell</Text>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                setSellSheetVisible(false);
                (navigation as any).navigate('ItemCreate');
              }}
              testID="sell-option-list-one-item"
            >
              <Text style={styles.sheetButtonTitle}>List One Item</Text>
              <Text style={styles.sheetButtonMeta}>Single photo-first flow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                setSellSheetVisible(false);
                (navigation as any).navigate('BulkListingCreate');
              }}
              testID="sell-option-bulk-upload"
            >
              <Text style={styles.sheetButtonTitle}>Bulk Upload</Text>
              <Text style={styles.sheetButtonMeta}>Up to 30 photos grouped into items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelButton}
              onPress={() => setSellSheetVisible(false)}
              testID="sell-options-cancel"
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  emojiWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  emoji: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sheetButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  sheetButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sheetButtonMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  sheetCancelButton: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
