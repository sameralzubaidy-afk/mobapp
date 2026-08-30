/**
 * File: p2p-kids-marketplace/src/screens/home/DiscoverHeader.tsx
 * DISCOVER-REDESIGN: Discover-screen-local header composition.
 *
 * Replaces the shared AppHeader on the Discover tab ONLY. This local
 * composition is required because the shared Header has no bookmark/saved icon
 * support and the scope rule forbids modifying AppHeader's default
 * props/behavior (Home/Inbox/Profile headers must render unchanged).
 *
 * Right cluster (design-system.md §6.1 Icon Button — 44×44, icon 24px):
 *   - Bookmark (Saved) → navigates to the Favorites route
 *   - Notifications bell (existing behavior + CountBadge dot)
 *   - Chat (existing behavior, kept for tab parity)
 *
 * Title is H1 (design-system.md §3.2) — kept as the existing "Discover" text.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Heart, Bell, ChatCircleText } from 'phosphor-react-native';

import { useAuth } from '@/hooks/useAuth';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import { useUnreadMessagesBadge } from '@/hooks/useUnreadMessagesBadge';
import CountBadge from '@/components/ui/CountBadge';
import { ds, dsType } from '@/theme/discoveryTokens';

export default function DiscoverHeader() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { unreadCount } = useNotificationBadge(userId);
  const { unreadCount: chatUnreadCount } = useUnreadMessagesBadge(userId);

  const navigateTo = (routeName: string) => {
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={styles.header}>
      {/* Empty left spacer keeps the title centred (matches AppHeader tab variant) */}
      <View style={styles.headerActionBtn} />

      <Text testID="screen-title" style={styles.title} numberOfLines={1}>
        Discover
      </Text>

      <View style={styles.headerActions}>
        {/* Favorites (heart) → Favorites — DT-63 (QA Task 7 M20): the header used
            a bookmark labeled "Saved items" while every other favorites surface in
            the app (item-card heart overlay, Favorites empty state, dashboard tile,
            cart "View Favorites →") uses a heart. Aligned to heart + "View Favorites"
            for app-internal consistency and to match the canonical QA guide. */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigateTo('Favorites')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="View Favorites"
          testID="discover-header-favorites"
        >
          <Heart size={24} color={ds.neutral[700]} weight="regular" />
        </TouchableOpacity>

        {/* Notifications bell (existing behavior) */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigateTo('Notifications')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          testID="header-notifications-btn"
        >
          <Bell size={22} color={ds.neutral[700]} weight="bold" />
          <CountBadge
            count={unreadCount}
            top={4}
            right={4}
            withRing
            testID="header-notifications-badge"
          />
        </TouchableOpacity>

        {/* Chat (kept for tab parity — same behavior as AppHeader) */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigateTo('InboxTab')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Messages"
          testID="header-chat-btn"
        >
          <ChatCircleText size={22} color={ds.neutral[700]} weight="bold" />
          <CountBadge
            count={chatUnreadCount}
            top={4}
            right={4}
            withRing
            testID="header-chat-badge"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: ds.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: ds.neutral[100],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ds.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    flex: 1,
    ...dsType.h1, // H1 (32/40/700) — design-system.md §3.2
    color: ds.neutral[900],
    textAlign: 'center',
    marginHorizontal: 8,
  },
});
