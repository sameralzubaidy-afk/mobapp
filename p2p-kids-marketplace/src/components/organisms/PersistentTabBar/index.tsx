/**
 * File: p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx
 *
 * Persistent 5-tab bottom nav bar for stack screens that live OUTSIDE the
 * HomeTabNavigator. Visually identical to the Tab.Navigator bar so users see
 * one consistent footer on every screen in the app.
 *
 * Usage:
 *   <PersistentTabBar />
 *
 * Navigation behaviour:
 *   – Tapping a tab navigates to 'Home' (HomeTabNavigator) → specific tab screen
 *   – Sell FAB opens the same action sheet (List One Item / Bulk Upload / Cancel)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  House,
  MagnifyingGlass,
  Tag,
  ChatCircleText,
  UserCircle,
  Package,
} from 'phosphor-react-native';

// ─── Sell Action Sheet (self-contained modal) ─────────────────────────────────

type SellActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSingleItem: () => void;
  onBulkUpload: () => void;
};

function SellActionSheet({ visible, onClose, onSingleItem, onBulkUpload }: SellActionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Sell</Text>

        {/* List One Item */}
        <TouchableOpacity style={styles.sheetOption} onPress={onSingleItem} activeOpacity={0.7}>
          <Text style={styles.sheetOptionTitle}>List One Item</Text>
          <Text style={styles.sheetOptionSubtitle}>Snap a photo or choose from your library</Text>
        </TouchableOpacity>

        {/* Bulk Upload */}
        <TouchableOpacity style={styles.sheetOption} onPress={onBulkUpload} activeOpacity={0.7}>
          <View style={styles.sheetOptionRow}>
            <Package size={20} color="#1A1A1A" weight="regular" />
            <View style={styles.sheetOptionTextWrap}>
              <Text style={styles.sheetOptionTitle}>Bulk Upload</Text>
              <Text style={styles.sheetOptionSubtitle}>
                Add from camera or library and group into items
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity style={styles.sheetCancel} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

type TabItemProps = {
  Icon: React.ElementType;
  label: string;
  active?: boolean;
  onPress: () => void;
};

function TabItem({ Icon, label, active = false, onPress }: TabItemProps) {
  const color = active ? '#5DBB8E' : '#6B6B6B';
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Icon size={22} color={color} weight={active ? 'fill' : 'regular'} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export type PersistentTabBarActiveTab = 'Home' | 'Discover' | 'Inbox' | 'Me' | null;

interface PersistentTabBarProps {
  /** Optional: highlight one of the 5 tabs. Leave unset for detail screens. */
  activeTab?: PersistentTabBarActiveTab;
}

export function PersistentTabBar({ activeTab }: PersistentTabBarProps = {}) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [sellSheetVisible, setSellSheetVisible] = useState(false);

  const tabBarHeight = 56 + insets.bottom;

  /** Navigate to a specific tab inside the HomeTabNavigator */
  const goToTab = (screenName: string) => {
    navigation.navigate('Home', { screen: screenName });
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            height: tabBarHeight,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          },
        ]}
      >
        {/* 1 — Home */}
        <TabItem
          Icon={House}
          label="Home"
          active={activeTab === 'Home'}
          onPress={() => goToTab('HomeDash')}
        />

        {/* 2 — Discover */}
        <TabItem
          Icon={MagnifyingGlass}
          label="Discover"
          active={activeTab === 'Discover'}
          onPress={() => goToTab('BrowseTab')}
        />

        {/* 3 — Sell FAB (raised green circle, never highlighted) */}
        <TouchableOpacity
          style={styles.fabWrapper}
          onPress={() => setSellSheetVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.fab}>
            <Tag size={26} color="#FFFFFF" weight="regular" />
          </View>
        </TouchableOpacity>

        {/* 4 — Inbox */}
        <TabItem
          Icon={ChatCircleText}
          label="Inbox"
          active={activeTab === 'Inbox'}
          onPress={() => goToTab('InboxTab')}
        />

        {/* 5 — Me */}
        <TabItem
          Icon={UserCircle}
          label="Me"
          active={activeTab === 'Me'}
          onPress={() => goToTab('MeTab')}
        />
      </View>

      {/* Sell action sheet */}
      <SellActionSheet
        visible={sellSheetVisible}
        onClose={() => setSellSheetVisible(false)}
        onSingleItem={() => {
          setSellSheetVisible(false);
          setTimeout(() => navigation.navigate('ItemCreate'), 100);
        }}
        onBulkUpload={() => {
          setSellSheetVisible(false);
          setTimeout(() => navigation.navigate('BulkListingCreate'), 100);
        }}
      />
    </>
  );
}

export default PersistentTabBar;

const styles = StyleSheet.create({
  // ── Bar ─────────────────────────────────────────────────────────────────────
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  // ── Tab items ────────────────────────────────────────────────────────────────
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6B6B',
    marginTop: Platform.OS === 'ios' ? 2 : 3,
  },
  tabLabelActive: {
    color: '#5DBB8E',
  },
  // ── FAB ─────────────────────────────────────────────────────────────────────
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8C42',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 8,
  },
  // ── Sell sheet ───────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  sheetOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 10,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sheetOptionTextWrap: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sheetOptionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  sheetCancel: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B6B6B',
  },
});
