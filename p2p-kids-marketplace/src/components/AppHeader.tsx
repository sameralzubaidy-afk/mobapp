/**
 * File: p2p-kids-marketplace/src/components/AppHeader.tsx
 * MODULE-15.1-UI-REDESIGN: App-wide header component
 *
 * Three variants:
 *  - 'main'   : Home header. Read-only node/market chip on left; right cluster =
 *               Bell + Chat + Avatar (Profile). No logout icon in the header
 *               (logout lives in Profile/Settings).
 *  - 'tab'    : Root tab screens (Discover, Messages, Cart). Title in centre,
 *               Bell + Chat on right, no back button.
 *  - 'detail' : Slim back-button header (all other authenticated screens).
 *               Back on left, title in centre, Bell + Chat on right.
 *
 * The header chat icon uses the same shared CountBadge + unread-message count
 * source across ALL variants so the chat affordance is visually unified.
 *
 * Usage:
 *   // In ScreenLayout (preferred) — do not use AppHeader directly
 *   <ScreenLayout variant="main">…</ScreenLayout>
 *   <ScreenLayout variant="tab" title="Discover">…</ScreenLayout>
 *   <ScreenLayout variant="detail" title="Settings">…</ScreenLayout>
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChatCircleText, CaretLeft, MapPin } from 'phosphor-react-native';

import { useAuth } from '@/hooks/useAuth';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import { useUnreadMessagesBadge } from '@/hooks/useUnreadMessagesBadge';
import CountBadge from '@/components/ui/CountBadge';
import Avatar from '@/components/atoms/Avatar';
import { resolveAvatarUrl } from '@/services/profile';
import { colors, borderRadius } from '@/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  /**
   * 'main'   : Home header. Read-only node chip on left; Bell + Chat + Avatar on right.
   * 'tab'    : Root tab screens (Discover, Messages, Cart). Title in centre, Bell + Chat on right.
   * 'detail' : Secondary/detail screens. Back on left, title in centre, Bell + Chat on right.
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
  /** Override the back-button press handler. Default: navigation.goBack(). */
  onBack?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppHeader({
  variant,
  title,
  showBell = true,
  onBack,
}: AppHeaderProps) {
  let navigation: any;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- defensive: AppHeader may render outside NavigationContainer in tests/storybook
    navigation = useNavigation<any>();
  } catch {
    navigation = undefined;
  }
  const { session } = useAuth();

  const userId = session?.user?.id;
  const { unreadCount } = useNotificationBadge(userId);
  const { unreadCount: chatUnreadCount } = useUnreadMessagesBadge(userId);

  const displayName =
    (session?.user as any)?.display_name ||
    session?.user?.email?.split('@')[0] ||
    'User';

  // Read-only node/market context (registered at onboarding). Fixed — there is
  // no in-header mechanism to change it and no navigation attached to the chip.
  const nodeName =
    (session?.user as any)?.node?.name ||
    (session?.user as any)?.node?.city ||
    'Local Market';

  // Resolve the avatar to a displayable URL. `profiles.avatar_url` can be a
  // storage PATH (e.g. 'user-avatars/<uuid>.jpg') rather than a full URL, and
  // <Avatar> requires a URL or it falls back to initials — so resolve it via the
  // same helper used by Profile/EditProfile/review (keep consumers consistent).
  // Only the main (Home) variant renders the avatar, so skip the lookup elsewhere.
  const rawAvatarUrl = (session?.user as any)?.avatar_url;
  const shouldResolveAvatar = variant === 'main';
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!shouldResolveAvatar || !rawAvatarUrl) {
      setResolvedAvatarUrl(null);
      return;
    }
    resolveAvatarUrl(rawAvatarUrl)
      .then((url) => {
        if (active) setResolvedAvatarUrl(url);
      })
      .catch(() => {
        if (active) setResolvedAvatarUrl(null);
      });
    return () => {
      active = false;
    };
  }, [rawAvatarUrl, shouldResolveAvatar]);

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

  // ── Shared bell button (count badge via shared CountBadge) ────────────────
  const renderBell = () => (
    <TouchableOpacity
      style={styles.headerActionBtn}
      onPress={() => navigateTo('Notifications')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Notifications"
      testID="header-notifications-btn"
    >
      {renderIcon(Bell, { size: 22, color: '#1A1A1A', weight: 'bold' })}
      <CountBadge count={unreadCount} top={4} right={4} withRing testID="header-notifications-badge" />
    </TouchableOpacity>
  );

  // ── Shared chat/messages button (same icon + badge on ALL variants) ──────
  // Opens the Messages screen (same destination the bottom-nav Inbox tab used).
  const renderChat = () => (
    <TouchableOpacity
      style={styles.headerActionBtn}
      onPress={() => navigateTo('InboxTab')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Messages"
      testID="header-chat-btn"
    >
      {renderIcon(ChatCircleText, { size: 22, color: '#1A1A1A', weight: 'bold' })}
      <CountBadge count={chatUnreadCount} top={4} right={4} withRing testID="header-chat-badge" />
    </TouchableOpacity>
  );

  // ── Main variant (Home / UserDashboard) ──────────────────────────────────
  if (variant === 'main') {
    return (
      <View style={styles.header}>
        {/* Left: read-only node/market chip — display only, NOT tappable */}
        <View style={styles.nodeChip} testID="header-node-chip">
          <MapPin size={14} color={colors.primary[500]} weight="fill" />
          <Text style={styles.nodeChipText} numberOfLines={1}>
            {nodeName}
          </Text>
        </View>

        {/* Right cluster: bell + chat + avatar (avatar → Profile) */}
        <View style={styles.headerActions}>
          {showBell && renderBell()}
          {renderChat()}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigateTo('Profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            testID="header-profile-btn"
          >
            <Avatar
              imageUrl={resolvedAvatarUrl ?? undefined}
              size={36}
              name={displayName}
            />
          </TouchableOpacity>
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

        <View style={styles.headerActions}>
          {showBell ? renderBell() : <View style={styles.headerActionBtn} />}
          {renderChat()}
        </View>
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

      {/* Right cluster keeps title reasonably centred; chat always present */}
      <View style={styles.headerActions}>
        {showBell ? renderBell() : <View style={styles.headerActionBtn} />}
        {renderChat()}
      </View>
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
  nodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.neutral[100],
  },
  nodeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
