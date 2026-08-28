/**
 * File: p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx
 *
 * Persistent floating-pill bottom nav. Rendered ONCE at the root authenticated
 * stack level (in AppNavigator.tsx) so every screen sees the same bar.
 *
 * Tabs: Home | Discover | [Sell FAB] | Trades | Cart
 *
 * Navigation behaviour:
 *   – Home     → root Stack 'Home' (renders HomeTabNavigator)
 *   – Discover → root Stack 'Discover' (full-screen screen)
 *   – Trades   → root Stack 'TradeList' (TradeListScreen — Active/History)
 *   – Cart     → root Stack 'Cart' (full-screen CartScreen)
 *   – Sell FAB → opens action sheet (List One Item / Bulk Upload / Cancel)
 *
 * Badges (shared CountBadge component, each fed its own count source):
 *   – Trades → useTradesBadge (active trades: any status not completed/cancelled)
 *   – Basket → useCartContext().cartCount
 * (The unread-message badge that used to live on the Inbox tab now lives on the
 *  header chat icon — see useUnreadMessagesBadge in AppHeader.)
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState, NavigationState } from '@react-navigation/native';
import { House, MagnifyingGlass, Tag, Receipt, ShoppingCart, Package } from 'phosphor-react-native';
import { useCartContext } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useTradesBadge } from '@/hooks/useTradesBadge';
import CountBadge from '@/components/ui/CountBadge';
import { trackEvent } from '@/services/analytics';
import { NAV_EVENTS } from '@/constants/analytics-events';
import { colors, borderRadius, shadows, spacing, componentSpacing } from '@/theme';

// Full-screen focused-task forms where the floating pill nav must NOT render.
// The pill is positioned ABSOLUTE at the bottom of the screen and floats OVER
// the stack content, so it occludes bottom-anchored CTAs on these screens.
// ItemCreate is a root Stack screen (not inside the tab navigator) reached via
// the `p2pkidsmarketplace://create-item` deep link or the Sell FAB — QA E05
// measured 0px scroll at max scroll because the Publish button sat behind the
// pill. The pill hides here so the form's own sticky CTA is reachable.
// TODO(REFACTOR): BulkListingCreate is the same class of full-screen form and
// may need the same treatment — not included to keep this fix scoped.
const TAB_BAR_HIDDEN_ROUTES = new Set<string>(['ItemCreate']);

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
        <TouchableOpacity
          style={styles.sheetOption}
          onPress={onSingleItem}
          activeOpacity={0.7}
          testID="sell-option-list-one-item"
        >
          <View style={styles.sheetOptionRow}>
            <Tag size={20} color={colors.neutral[900]} weight="regular" />
            <View style={styles.sheetOptionTextWrap}>
              <Text style={styles.sheetOptionTitle}>List One Item</Text>
              <Text style={styles.sheetOptionSubtitle}>
                Snap a photo or choose from your library
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Bulk Upload */}
        <TouchableOpacity
          style={styles.sheetOption}
          onPress={onBulkUpload}
          activeOpacity={0.7}
          testID="sell-option-bulk-upload"
        >
          <View style={styles.sheetOptionRow}>
            <Package size={20} color={colors.neutral[900]} weight="regular" />
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
  const tabTestId = `tab-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
      testID={tabTestId}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View>
        <Icon size={22} color={color} weight={active ? 'fill' : 'regular'} />
        <CountBadge count={badgeCount ?? 0} testID={`${tabTestId}-badge`} />
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Active tab helper ────────────────────────────────────────────────────────
// Exported so the route→tab mapping can be unit-tested directly (all branches),
// in addition to being exercised through the rendered component.

export function computeActiveTab(state: NavigationState | undefined): string | null {
  if (!state) return null;

  const route = state.routes[state.index];
  if (!route) return null;

  const name = route.name;

  if (name === 'Home' || name === 'HomeDash') return 'Home';
  if (name === 'Discover') return 'Discover';
  if (
    name === 'TradeList' ||
    name === 'TradeTimeline' ||
    name === 'TradeDetail' ||
    name === 'TradeSuccess' ||
    name === 'TradeDispute' ||
    name === 'ReviewOffer' ||
    name === 'TradeInitiation'
  ) {
    return 'Trades';
  }
  if (name === 'Cart' || name === 'CartCheckout') return 'Cart';

  // Walk back to find which tab the current detail screen belongs to
  for (let i = state.routes.length - 1; i >= 0; i--) {
    const r = state.routes[i].name;
    if (r === 'Home' || r === 'HomeDash') return 'Home';
    if (r === 'Discover') return 'Discover';
    if (
      r === 'TradeList' ||
      r === 'TradeTimeline' ||
      r === 'TradeDetail' ||
      r === 'TradeSuccess' ||
      r === 'TradeDispute' ||
      r === 'ReviewOffer' ||
      r === 'TradeInitiation'
    ) {
      return 'Trades';
    }
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

  const { activeCount: activeTradeCount } = useTradesBadge(userId);

  const navState = useNavigationState((s: NavigationState) => s);
  const activeTab = computeActiveTab(navState);

  // Do not render the floating pill on full-screen form routes (ItemCreate) —
  // it would occlude the form's bottom-anchored CTA. See TAB_BAR_HIDDEN_ROUTES.
  if (TAB_BAR_HIDDEN_ROUTES.has(navState?.routes?.[navState.index]?.name)) {
    return null;
  }

  const navigateToTab = (routeName: string, eventName?: string) => {
    if (eventName) {
      trackEvent(eventName);
    }
    navigation.navigate(routeName);
  };

  return (
    <>
      {/* Floating pill bar.
          barBackground is a separate clipped layer so (a) the white fill is cut
          to the pill on all four corners and (b) the raised FAB — a sibling, not
          inside the clipped bounds — is never cut. The drop shadow stays on the
          bar itself (a view can't combine overflow:hidden + shadow on iOS).

          The bar is positioned ABSOLUTE at the bottom of the screen so it floats
          OVER the stack content: content scrolls behind/around the pill and no
          opaque full-width strip renders behind it. The bar wrapper itself stays
          fully transparent — only the inner barBackground (the pill) is opaque. */}
      <View
        style={[
          styles.bar,
          {
            // Float the pill above the home-indicator safe area (no flush dock).
            bottom: insets.bottom > 0 ? insets.bottom + spacing.sm : spacing.sm,
          },
        ]}
      >
        <View style={styles.barBackground} pointerEvents="none" />

        {/* Left group (flex:1) — equal width to the right group about the FAB */}
        <View style={styles.group}>
          {/* 1 — Home */}
          <TabItem
            Icon={House}
            label="Home"
            active={activeTab === 'Home'}
            onPress={() => navigateToTab('Home', NAV_EVENTS.HOME_TAB_TAPPED)}
          />

          {/* 2 — Discover */}
          <TabItem
            Icon={MagnifyingGlass}
            label="Discover"
            active={activeTab === 'Discover'}
            onPress={() => navigateToTab('Discover', NAV_EVENTS.DISCOVER_TAB_TAPPED)}
          />
        </View>

        {/* Center FAB slot (fixed width) — keeps both groups symmetric about it */}
        <View style={styles.fabSlot} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fabHit}
            onPress={() => {
              trackEvent(NAV_EVENTS.SELL_FAB_TAPPED);
              setSellSheetVisible(true);
            }}
            activeOpacity={0.85}
            testID="tab-sell"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Sell"
          >
            <View style={styles.fab}>
              <Tag size={26} color="#FFFFFF" weight="regular" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Right group (flex:1) — equal width to the left group */}
        <View style={styles.group}>
          {/* 4 — Trades (active-trades badge; excludes completed/cancelled) */}
          <TabItem
            Icon={Receipt}
            label="Trades"
            active={activeTab === 'Trades'}
            badgeCount={activeTradeCount}
            onPress={() => navigateToTab('TradeList', NAV_EVENTS.TRADES_TAB_TAPPED)}
          />

          {/* 5 — Basket */}
          <TabItem
            Icon={ShoppingCart}
            label="Basket"
            active={activeTab === 'Cart'}
            badgeCount={cartCount}
            onPress={() => navigateToTab('Cart', NAV_EVENTS.BASKET_TAB_TAPPED)}
          />
        </View>
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
  // ── Floating pill bar ──────────────────────────────────────────────────────
  // Uniform pill radius on ALL four corners + drop shadow on the container.
  // position:absolute lifts the pill OUT of normal flow so it floats OVER the
  // stack content (which now extends behind it) instead of occupying its own
  // opaque full-width strip. left/right pin the floating margins; bottom is
  // applied inline from the safe-area inset.
  bar: {
    position: 'absolute',
    left: componentSpacing.pageMargin, // 16
    right: componentSpacing.pageMargin, // 16
    bottom: 0, // overridden inline with the safe-area inset
    flexDirection: 'row',
    alignItems: 'center',
    // Floating margins — the pill does NOT span the full device width.
    borderRadius: borderRadius.pill, // uniform on every corner
    // Balanced vertical padding (spacing.sm each) so the icon+label block is
    // vertically centered inside the pill, not pushed toward the top edge.
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent', // outer wrapper is never opaque — only the pill (barBackground) is
    ...shadows.level2, // drop shadow on the container — not clipped by any parent
  },
  // Clipped white fill — separate layer (overflow:hidden + shadow can't coexist
  // on one view on iOS). Clips the background to the same pill shape.
  barBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    backgroundColor: colors.neutral.white,
  },
  // ── Tab groups (symmetric flex:1 width on each side of the FAB) ────────────
  group: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  // ── FAB (fixed-width center slot; raised above the pill, separate layer) ───
  fabSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabHit: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22, // raise the FAB + touch target above the pill (bar has no overflow → not clipped)
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8C42',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
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
    backgroundColor: colors.neutral[200],
    marginBottom: 16,
  },
  // Design-system palette (docx/design-system-passitup.md): border #E0E0E0,
  // background-light #F0F0F0, primary text #1A1A1A, secondary #6B6B6B.
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600', // Heading 3 per design system
    color: colors.neutral[900],
    marginBottom: 16,
  },
  sheetOption: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
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
    color: colors.neutral[900],
    marginBottom: 4,
  },
  sheetOptionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.neutral[700],
  },
  sheetCancel: {
    backgroundColor: colors.neutral[100],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral[700],
  },
});
