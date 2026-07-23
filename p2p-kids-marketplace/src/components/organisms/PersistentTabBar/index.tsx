/**
 * File: p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx
 *
 * Persistent 5-tab bottom nav bar. Rendered ONCE at the root authenticated
 * stack level (in AppNavigator.tsx) so every screen sees the same bar.
 *
 * Tabs: Home | Discover | [Sell FAB] | Inbox | Cart
 *
 * Navigation behaviour:
 *   – Home → root Stack 'Home' (renders HomeTabNavigator)
 *   – Discover → root Stack 'Discover' (full-screen screen)
 *   – Inbox → root Stack 'InboxTab' (full-screen ConversationsListScreen)
 *   – Cart → root Stack 'Cart' (full-screen CartScreen)
 *   – Sell FAB → opens action sheet (List One Item / Bulk Upload / Cancel)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState, NavigationState } from '@react-navigation/native';
import {
  House,
  MagnifyingGlass,
  Tag,
  ChatCircleText,
  ShoppingCart,
  Package,
} from 'phosphor-react-native';
import { useCartContext } from '@/contexts/CartContext';
import { getTotalUnreadMessageCount } from '@/services/chat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';

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
        <TouchableOpacity style={styles.sheetOption} onPress={onSingleItem} activeOpacity={0.7} testID="sell-option-list-one-item">
          <Text style={styles.sheetOptionTitle}>List One Item</Text>
          <Text style={styles.sheetOptionSubtitle}>Snap a photo or choose from your library</Text>
        </TouchableOpacity>

        {/* Bulk Upload */}
        <TouchableOpacity style={styles.sheetOption} onPress={onBulkUpload} activeOpacity={0.7} testID="sell-option-bulk-upload">
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
  badgeCount?: number;
};

function TabItem({ Icon, label, active = false, onPress, badgeCount }: TabItemProps) {
  const color = active ? '#5DBB8E' : '#6B6B6B';
  const tabTestId = `tab-${label.toLowerCase()}`;
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7} testID={tabTestId}>
      <View>
        <Icon size={22} color={color} weight={active ? 'fill' : 'regular'} />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : String(badgeCount)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Active tab helper ────────────────────────────────────────────────────────

function computeActiveTab(state: NavigationState | undefined): string | null {
  if (!state) return null;

  const route = state.routes[state.index];
  if (!route) return null;

  const name = route.name;

  if (name === 'Home' || name === 'HomeDash') return 'Home';
  if (name === 'Discover') return 'Discover';
  if (name === 'InboxTab' || name === 'Conversations') return 'Inbox';
  if (name === 'Cart' || name === 'CartCheckout') return 'Cart';

  // Walk back to find which tab the current detail screen belongs to
  for (let i = state.routes.length - 1; i >= 0; i--) {
    const r = state.routes[i].name;
    if (r === 'Home' || r === 'HomeDash') return 'Home';
    if (r === 'Discover') return 'Discover';
    if (r === 'InboxTab') return 'Inbox';
    if (r === 'Cart') return 'Cart';
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PersistentTabBar() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [sellSheetVisible, setSellSheetVisible] = useState(false);
  const { cartCount } = useCartContext();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  const refreshInboxBadge = useCallback(async () => {
    if (!userId) {
      setInboxUnreadCount(0);
      return;
    }
    try {
      const count = await getTotalUnreadMessageCount(userId);
      setInboxUnreadCount(count);
    } catch {
      console.warn('[PersistentTabBar] Failed to refresh inbox badge');
    }
  }, [userId]);

  // Fetch on mount and when user changes
  useEffect(() => {
    refreshInboxBadge();
  }, [refreshInboxBadge]);

  // Re-fetch when app comes to foreground (user may have read messages)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshInboxBadge();
      }
    });
    return () => sub.remove();
  }, [refreshInboxBadge]);

  // Real-time subscription: refresh inbox badge when a new message arrives
  // BP-23: This Realtime callback mirrors the mount-time refreshInboxBadge side effect
  // so new messages arriving while the app is open update the badge immediately
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`inbox-badge-${userId}`);
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      () => {
        // Debounce: avoid re-fetching on every bulk insert
        refreshInboxBadge();
      }
    );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [userId, refreshInboxBadge]);

  const tabBarHeight = 56 + insets.bottom;
  const activeTab = computeActiveTab(useNavigationState((s: NavigationState) => s));

  const navigateToTab = (routeName: string) => {
    // Refresh badge when navigating to inbox (user may read messages there)
    if (routeName === 'InboxTab') {
      refreshInboxBadge();
    }
    navigation.navigate(routeName);
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
          onPress={() => navigateToTab('Home')}
        />

        {/* 2 — Discover */}
        <TabItem
          Icon={MagnifyingGlass}
          label="Discover"
          active={activeTab === 'Discover'}
          onPress={() => navigateToTab('Discover')}
        />

        {/* 3 — Sell FAB (raised orange circle, never highlighted) */}
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
          badgeCount={inboxUnreadCount}
          onPress={() => navigateToTab('InboxTab')}
        />

        {/* 5 — Trade Basket (replaces Me) */}
        <TabItem
          Icon={ShoppingCart}
          label="Trade Basket"
          active={activeTab === 'Cart'}
          badgeCount={cartCount}
          onPress={() => navigateToTab('Cart')}
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
  // ── Badge ────────────────────────────────────────────────────────────────────
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E85D75',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
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
