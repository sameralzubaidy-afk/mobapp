/**
 * File: p2p-kids-marketplace/src/constants/layout.ts
 *
 * FIX-Task-66 item 3 (2026-09-18): single source of truth for the bottom inset a
 * scrollable screen must reserve so its final control is never hidden behind the
 * floating `PersistentTabBar` pill — or behind the circular Sell FAB that protrudes
 * above it.
 *
 * WHY THIS EXISTS (MSG Round 2 findings F3 + F6): the pill and FAB are absolutely
 * positioned OVER the stack content, so every screen needs explicit bottom
 * clearance. `NotificationPreferencesScreen` used a flat `paddingBottom: 32`, which
 * let "Save Quiet Hours" sit inside the FAB's tappable band at max scroll with no
 * way to scroll it clear — tapping the button's own reported centre opened the Sell
 * sheet instead. The same missing-clearance pattern was measured on ~18 other
 * in-scope screens.
 *
 * Before this file the value existed as a literal duplicated in two trade screens
 * and as ad-hoc magic numbers (20/24/32/40/48) in many others.
 *
 * IMPORTANT: always add the device bottom safe-area inset (`insets.bottom`) to these
 * values — the pill is itself offset by that inset.
 */

/**
 * Reserve for a screen whose content ends in a normal control (button, list row)
 * that must stay clear of the floating pill AND the Sell FAB rising above it.
 *
 * 84 is the pre-existing, measured value from `trade/TradeOfferScreen` and
 * `trade/TradeTimelineScreen`: the pill's top sits at roughly
 * `insets.bottom + 72`, and the FAB rises a further ~11–23pt above the pill, so 84
 * clears the FAB rather than only the pill.
 */
export const TAB_BAR_FOOTER_CLEARANCE = 84;

/**
 * Reserve for a screen that must ALSO clear a pinned bar of its own (the Chat
 * composer, a checkout bar, or a frozen-trade banner) sitting directly above the
 * pill. Matches the long-standing `paddingBottom: 120` used by ChatScreen,
 * CartCheckoutScreen, BundleBuilderScreen, ItemDetailScreen and others.
 */
export const TAB_BAR_PINNED_CLEARANCE = 120;

/**
 * Bottom padding a scroll container needs so its final control stays clear of the
 * floating pill + Sell FAB.
 *
 * @param bottomInset device safe-area bottom inset (`useSafeAreaInsets().bottom`)
 * @param extra additional clearance for a screen-local pinned bar
 *              (use `TAB_BAR_PINNED_CLEARANCE - TAB_BAR_FOOTER_CLEARANCE` = 36)
 */
export function tabBarFooterPadding(bottomInset: number, extra = 0): number {
  return bottomInset + TAB_BAR_FOOTER_CLEARANCE + extra;
}
