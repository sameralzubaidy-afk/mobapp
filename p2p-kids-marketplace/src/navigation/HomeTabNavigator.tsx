// File: p2p-kids-marketplace/src/navigation/HomeTabNavigator.tsx
// MODULE-15.1 NAV Option A: 5-tab bottom nav (Home | Discover | [Sell FAB] | Inbox | Me)
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
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  House,
  MagnifyingGlass,
  Tag,
  ChatCircleText,
  UserCircle,
  Package,
} from 'phosphor-react-native';
import UserDashboardScreen from '@/screens/dashboard/UserDashboardScreen';
import DiscoverScreen from '@/screens/home/DiscoverScreen';
import ConversationsListScreen from '@/screens/messaging/ConversationsListScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';

// ─── Sell action sheet ────────────────────────────────────────────────────────
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
        {/* Handle */}
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

// ─── Placeholder — never actually rendered ───────────────────────────────────
function SellPlaceholder() {
  return <View />;
}

const Tab = createBottomTabNavigator();

// ─── Main navigator ───────────────────────────────────────────────────────────
export function HomeTabNavigator({ navigation }: { navigation: any }) {
  const [sellSheetVisible, setSellSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Tab bar total height = 56px icon/label area + safe-area bottom
  const tabBarHeight = 56 + insets.bottom;

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#5DBB8E',
          tabBarInactiveTintColor: '#6B6B6B',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E7EB',
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginBottom: Platform.OS === 'ios' ? 0 : 2,
          },
        }}
      >
        {/* 1 — Home */}
        <Tab.Screen
          name="HomeDash"
          component={UserDashboardScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <House
                size={22}
                color={focused ? '#5DBB8E' : '#6B6B6B'}
                weight={focused ? 'fill' : 'regular'}
              />
            ),
          }}
        />

        {/* 2 — Discover */}
        <Tab.Screen
          name="BrowseTab"
          component={DiscoverScreen}
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => (
              <MagnifyingGlass
                size={22}
                color={focused ? '#5DBB8E' : '#6B6B6B'}
                weight={focused ? 'fill' : 'regular'}
              />
            ),
          }}
        />

        {/* 3 — Sell (raised FAB, never stays active, shows action sheet) */}
        <Tab.Screen
          name="SellTab"
          component={SellPlaceholder}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setSellSheetVisible(true);
            },
          }}
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={styles.sellFab}>
                <Tag size={26} color="#FFFFFF" weight="regular" />
              </View>
            ),
          }}
        />

        {/* 4 — Inbox */}
        <Tab.Screen
          name="InboxTab"
          component={ConversationsListScreen}
          options={{
            title: 'Inbox',
            tabBarIcon: ({ focused }) => (
              <ChatCircleText
                size={22}
                color={focused ? '#5DBB8E' : '#6B6B6B'}
                weight={focused ? 'fill' : 'regular'}
              />
            ),
          }}
        />

        {/* 5 — Me */}
        <Tab.Screen
          name="MeTab"
          component={ProfileScreen}
          options={{
            title: 'Me',
            tabBarIcon: ({ focused }) => (
              <UserCircle
                size={22}
                color={focused ? '#5DBB8E' : '#6B6B6B'}
                weight={focused ? 'fill' : 'regular'}
              />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Sell action sheet — rendered outside Tab.Navigator so it overlays everything */}
      <SellActionSheet
        visible={sellSheetVisible}
        onClose={() => setSellSheetVisible(false)}
        onSingleItem={() => {
          setSellSheetVisible(false);
          // Short delay lets the sheet animate out before the new screen pushes
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

export default HomeTabNavigator;

const styles = StyleSheet.create({
  // ── Sell FAB ──────────────────────────────────────────────────────────────
  sellFab: {
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
  // ── Action sheet overlay ─────────────────────────────────────────────────
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
