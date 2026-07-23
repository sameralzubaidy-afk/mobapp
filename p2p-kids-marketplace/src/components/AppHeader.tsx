/**
 * File: p2p-kids-marketplace/src/components/AppHeader.tsx
 * MODULE-15.1-UI-REDESIGN: App-wide header component
 *
 * Three variants:
 *  - 'main'   : Full greeting header (Home/Dashboard). Avatar + "Good [time], [Name]" on left,
 *               Bell + Profile + optional Logout on right.
 *  - 'tab'    : Root tab screens (Discover, Inbox, Cart). Title in centre, Bell on right,
 *               no back button (tab screens are top-level destinations).
 *  - 'detail' : Slim back-button header (all other authenticated screens).
 *               ← Back on left, title in centre, optional Bell on right.
 *
 * Usage:
 *   // In ScreenLayout (preferred) — do not use AppHeader directly
 *   <ScreenLayout variant="main" showLogout>…</ScreenLayout>
 *   <ScreenLayout variant="tab" title="Discover">…</ScreenLayout>
 *   <ScreenLayout variant="detail" title="Settings">…</ScreenLayout>
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, User, SignOut, CaretLeft } from 'phosphor-react-native';

import { useAuth } from '@/hooks/useAuth';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import Avatar from '@/components/atoms/Avatar';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  /**
   * 'main'   : Full greeting header (Home/Dashboard). Avatar + greeting + bell + profile + optional logout.
   * 'tab'    : Root tab screens (Discover, Inbox, Cart). Title in centre, bell on right, no back button.
   * 'detail' : Secondary/detail screens. ← Back on left, title in centre, bell on right.
   */
  variant: 'main' | 'tab' | 'detail';
  /** Screen title shown in the 'tab' and 'detail' variants' centre */
  title?: string;
  /**
   * Whether to show the notification bell.
   * Default: true. Pass false on checkout / payment screens only
   * (CartCheckoutScreen, SubscriptionPaymentScreen, RequestPayoutScreen).
   */
  showBell?: boolean;
  /**
   * Whether to show the logout button.
   * Default: false. Pass true ONLY on the Home (UserDashboard) screen.
   */
  showLogout?: boolean;
  /** Override the back-button press handler. Default: navigation.goBack(). */
  onBack?: () => void;
}

// ─── Greeting helper ─────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppHeader({
  variant,
  title,
  showBell = true,
  showLogout = false,
  onBack,
}: AppHeaderProps) {
  let navigation: any;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- defensive: AppHeader may render outside NavigationContainer in tests/storybook
    navigation = useNavigation<any>();
  } catch {
    navigation = undefined;
  }
  const { session, logout } = useAuth();

  const userId = session?.user?.id;
  const { unreadCount } = useNotificationBadge(userId);

  const displayName =
    (session?.user as any)?.display_name ||
    session?.user?.email?.split('@')[0] ||
    'User';

  const navigateTo = (routeName: string) => {
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(routeName);
    }
  };

  const handleBack =
    onBack ??
    (() => {
      if (navigation && typeof navigation.goBack === 'function') {
        navigation.goBack();
      }
    });

  const renderIcon = (
    IconComponent: any,
    props: { size: number; color: string; weight?: string }
  ) => {
    if (!IconComponent) {
      return <View style={{ width: props.size, height: props.size }} />;
    }

    return React.createElement(IconComponent, props as any);
  };

  // ── Shared bell button ────────────────────────────────────────────────────
  const renderBell = () => (
    <TouchableOpacity
      style={styles.headerActionBtn}
      onPress={() => navigateTo('Notifications')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Notifications"
      testID="header-notifications-btn"
    >
      {renderIcon(Bell, { size: 22, color: '#1A1A1A', weight: 'bold' })}
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Main variant (Home / UserDashboard) ──────────────────────────────────
  if (variant === 'main') {
    return (
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigateTo('Profile')}
          activeOpacity={0.8}
          accessibilityLabel="View profile"
        >
          <Avatar
            imageUrl={(session?.user as any)?.avatar_url}
            size={42}
            name={displayName}
          />
          <View style={styles.headerGreeting}>
            <Text style={styles.greetingLine}>{getGreeting()},</Text>
            <Text style={styles.displayNameLine} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {showBell && renderBell()}

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigateTo('Profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Profile"
          >
            {renderIcon(User, { size: 22, color: '#1A1A1A', weight: 'regular' })}
          </TouchableOpacity>

          {showLogout && (
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={logout}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Sign out"
            >
              {renderIcon(SignOut, { size: 22, color: '#E85D75', weight: 'regular' })}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Tab variant (root tab screens — no back button) ─────────────────────
  if (variant === 'tab') {
    return (
      <View style={styles.header}>
        {/* Empty left spacer keeps title centred — no back button on tab screens */}
        <View style={styles.headerActionBtn} />

        <Text testID="screen-title" style={styles.detailTitle} numberOfLines={1}>
          {title ?? ''}
        </Text>

        {showBell ? renderBell() : <View style={styles.headerActionBtn} />}
      </View>
    );
  }

  // ── Detail variant (all other authenticated screens) ─────────────────────
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        testID="back-button"
      >
        {renderIcon(CaretLeft, { size: 24, color: '#1A1A1A', weight: 'regular' })}
      </TouchableOpacity>

      <Text testID="screen-title" style={styles.detailTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>

      {/* Right placeholder keeps title centred whether bell is shown or not */}
      {showBell ? renderBell() : <View style={styles.headerActionBtn} />}
    </View>
  );
}

// ─── Styles (pixel-matched to UserDashboardScreen header) ────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F4',
  },

  // ── main variant ──────────────────────────────────────────────────────────
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerGreeting: {
    marginLeft: 10,
    flex: 1,
  },
  greetingLine: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 17,
  },
  displayNameLine: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ── shared icon button ────────────────────────────────────────────────────
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E85D75',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },

  // ── detail variant ────────────────────────────────────────────────────────
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginHorizontal: 8,
  },
});
