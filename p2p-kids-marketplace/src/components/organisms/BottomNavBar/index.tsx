/**
 * File: p2p-kids-marketplace/src/components/organisms/BottomNavBar/index.tsx
 * MODULE-15.1 FLOW-16: Redesigned with Phosphor icons + Whisk design system
 * VISUAL ONLY — all handlers, modal logic, and navigation unchanged.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  GearSix,
  House,
  List,
  MagnifyingGlass,
  ShoppingCart,
  Storefront,
} from 'phosphor-react-native';

interface BottomNavBarProps {
  showHelp?: boolean;
}

type PhosphorIcon = typeof House;

// ─── Nav Item ─────────────────────────────────────────────────────────────────

const NavItem = ({
  Icon,
  label,
  routeName: _routeName,
  onPress,
  badgeCount,
  active,
}: {
  Icon: PhosphorIcon;
  label: string;
  routeName?: string;
  onPress?: () => void;
  badgeCount?: number;
  active: boolean;
}) => {
  const iconColor = active ? '#5DBB8E' : '#6B6B6B';

  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      activeOpacity={0.7}
      testID={'nav-' + label.replace(/\s+/g, '-').toLowerCase()}
    >
      <View style={styles.iconWrapper}>
        <Icon size={22} weight={active ? 'fill' : 'regular'} color={iconColor} />
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

// ─── Bottom Nav Bar ───────────────────────────────────────────────────────────

export default function BottomNavBar({ showHelp = true }: BottomNavBarProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const [sellSheetVisible, setSellSheetVisible] = React.useState(false);

  const handleStartSellFlow = React.useCallback(
    (targetRoute: 'ItemCreate' | 'BulkListingCreate') => {
      setSellSheetVisible(false);
      (navigation as any).navigate(targetRoute, { showPhotoSourcePrompt: true });
    },
    [navigation]
  );

  const isActive = (routeName: string) => route.name === routeName;
  const nav = (routeName: string) => (navigation as any).navigate(routeName);

  return (
    <View style={styles.container}>
      <NavItem Icon={House}           label="Home"     routeName="Home"       active={isActive('Home')}        onPress={() => nav('Home')} />
      <NavItem Icon={MagnifyingGlass} label="Discover" routeName="Discover"   active={isActive('Discover')}    onPress={() => nav('Discover')} />
      <NavItem Icon={ShoppingCart}    label="Cart"     routeName="Cart"       active={isActive('Cart')}        onPress={() => nav('Cart')} />
      <NavItem Icon={Storefront}      label="Sell"     active={false}          onPress={() => setSellSheetVisible(true)} />
      <NavItem Icon={List}            label="My Items" routeName="MyListings"  active={isActive('MyListings')} onPress={() => nav('MyListings')} />
      {showHelp && (
        <NavItem Icon={GearSix} label="Settings" active={isActive('Settings')} onPress={() => nav('Settings')} />
      )}

      {/* Sell Options Sheet — logic unchanged */}
      <Modal
        transparent
        animationType="slide"
        visible={sellSheetVisible}
        onRequestClose={() => setSellSheetVisible(false)}
        testID="sell-options-sheet"
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSellSheetVisible(false)}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sell</Text>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => handleStartSellFlow('ItemCreate')}
              testID="sell-option-list-one-item"
            >
              <Text style={styles.sheetButtonTitle}>List One Item</Text>
              <Text style={styles.sheetButtonMeta}>Snap a photo or choose from your library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => handleStartSellFlow('BulkListingCreate')}
              testID="sell-option-bulk-upload"
            >
              <Text style={styles.sheetButtonTitle}>Bulk Upload</Text>
              <Text style={styles.sheetButtonMeta}>
                Add from camera or library and group into items
              </Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 64,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#E85D75',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B6B6B',
    textAlign: 'center',
  },
  labelActive: {
    color: '#5DBB8E',
    fontWeight: '600',
  },
  // ── Sell Sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.25)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sheetButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  sheetButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sheetButtonMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  sheetCancelButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  sheetCancelText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B6B6B',
  },
});
