// File: p2p-kids-marketplace/src/screens/notifications/NotificationCenterScreen.tsx
// MODULE-14 TASK NOTIF-V2-006: In-App Notification Center
// MODULE-14 TASK NOTIF-V2-008: Notification Deep Linking
// MODULE-15.1 FLOW-17: Notifications redesign with Whisk design system

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ShoppingCart,
  CurrencyCircleDollar,
  Warning,
  Bell,
  Gift,
  Trophy,
  IdentificationCard,
  Notification,
  ArrowLeft,
  Handshake,
  ChatCircle,
  Tag,
  LockOpen,
  Lock,
  Crown,
  StarFour,
  TrendUp,
  Confetti,
  CheckCircle,
  XCircle,
  Hourglass,
  Package,
} from 'phosphor-react-native';

import { useAuth } from '@/hooks/useAuth';
import { RootStackParamList } from '@/navigation/types';
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
  type UserNotification,
} from '@/services/referralNotifications';
import {
  getFallbackRoute,
  logDeepLinkNavigation,
  parseNotificationDeepLink,
  type DeepLinkTarget,
  type NotificationDeepLinkData,
} from '@/services/deepLink';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 20;

// MODULE-15.1 FLOW-17: Type-specific icon colors
interface NotificationIconConfig {
  Icon: React.ComponentType<any>;
  backgroundColor: string;
  iconColor: string;
}

// ── Color palette ──────────────────────────────────────────────────────────
const COLORS = {
  green:  { backgroundColor: '#E8F5F0', iconColor: '#5DBB8E' },  // positive / active / new
  red:    { backgroundColor: '#FEE2E2', iconColor: '#E85D75' },  // negative / rejected / failed
  amber:  { backgroundColor: '#FEF3C7', iconColor: '#F59E0B' },  // warning / pending
  gold:   { backgroundColor: '#FEF3C7', iconColor: '#D97706' },  // rewards / achievements
  purple: { backgroundColor: '#EDE9FE', iconColor: '#7C3AED' },  // subscription / premium
  grey:   { backgroundColor: '#F7F7F7', iconColor: '#6B6B6B' },  // neutral / system
};

// ── Type-level icon map (checked FIRST, highest specificity) ──────────────
const TYPE_ICONS: Record<string, NotificationIconConfig> = {
  // ── Trade ──
  trade_request: {
    Icon: ShoppingCart,
    ...COLORS.green,
  },
  trade_accepted: {
    Icon: Handshake,
    ...COLORS.green,
  },
  trade_rejected: {
    Icon: XCircle,
    ...COLORS.red,
  },
  trade_declined: {
    Icon: XCircle,
    ...COLORS.red,
  },
  trade_cancelled: {
    Icon: XCircle,
    ...COLORS.red,
  },
  trade_completed: {
    Icon: Confetti,
    ...COLORS.green,
  },
  trade_completion_requested: {
    Icon: Hourglass,
    ...COLORS.amber,
  },
  trade_message: {
    Icon: ChatCircle,
    ...COLORS.green,
  },

  // ── Listings ──
  listing_approved: {
    Icon: Tag,
    ...COLORS.green,
  },
  listing_rejected: {
    Icon: Tag,
    ...COLORS.red,
  },
  listing_expired: {
    Icon: Tag,
    ...COLORS.amber,
  },

  // ── ID Verification (use app green palette, not corporate blue) ──
  id_badge_submission: {
    Icon: IdentificationCard,
    ...COLORS.amber,
  },
  id_verification_submission: {
    Icon: IdentificationCard,
    ...COLORS.amber,
  },
  id_badge_approved: {
    Icon: IdentificationCard,
    ...COLORS.green,
  },
  id_verification_approved: {
    Icon: IdentificationCard,
    ...COLORS.green,
  },
  id_badge_rejected: {
    Icon: IdentificationCard,
    ...COLORS.red,
  },
  id_verification_rejected: {
    Icon: IdentificationCard,
    ...COLORS.red,
  },

  // ── Swap Points ──
  sp_earned: {
    Icon: CurrencyCircleDollar,
    ...COLORS.green,
  },
  sp_spent: {
    Icon: CurrencyCircleDollar,
    ...COLORS.amber,
  },
  sp_balance_low: {
    Icon: Warning,
    ...COLORS.amber,
  },
  sp_wallet_frozen: {
    Icon: Lock,
    ...COLORS.grey,
  },
  sp_released: {
    Icon: LockOpen,
    ...COLORS.green,
  },

  // ── Subscription ──
  subscription_renewed: {
    Icon: Crown,
    ...COLORS.green,
  },
  subscription_cancelled: {
    Icon: Crown,
    ...COLORS.red,
  },
  subscription_reactivated: {
    Icon: Crown,
    ...COLORS.purple,
  },
  payment_failed: {
    Icon: Warning,
    ...COLORS.red,
  },
  grace_period_ending: {
    Icon: Hourglass,
    ...COLORS.amber,
  },

  // ── Badges & Leaderboard ──
  badge_awarded: {
    Icon: Trophy,
    ...COLORS.gold,
  },
  badge_milestone: {
    Icon: StarFour,
    ...COLORS.gold,
  },
  leaderboard_rank_up: {
    Icon: TrendUp,
    ...COLORS.green,
  },
};

// ── Category-level fallbacks ────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, NotificationIconConfig> = {
  trades: {
    Icon: ShoppingCart,
    ...COLORS.green,
  },
  sp_events: {
    Icon: CurrencyCircleDollar,
    ...COLORS.amber,
  },
  safety: {
    Icon: Warning,
    ...COLORS.red,
  },
  subscription: {
    Icon: Crown,
    ...COLORS.purple,
  },
  badges: {
    Icon: Trophy,
    ...COLORS.gold,
  },
  referrals: {
    Icon: Gift,
    ...COLORS.green,
  },
  listings: {
    Icon: Package,
    ...COLORS.green,
  },
  system: {
    Icon: Bell,
    ...COLORS.grey,
  },
};

const DEFAULT_ICON: NotificationIconConfig = {
  Icon: Notification,
  ...COLORS.grey,
};

export function getNotificationIconConfig(item: UserNotification): NotificationIconConfig {
  // Type-specific icon takes priority for granular UX
  if (item.type && TYPE_ICONS[item.type]) {
    return TYPE_ICONS[item.type];
  }
  // Fall back to category icon
  return CATEGORY_ICONS[item.category] ?? DEFAULT_ICON;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

// Keep notification IDs unique across pagination + realtime events.
export function mergeNotificationsById(
  primary: UserNotification[],
  secondary: UserNotification[]
): UserNotification[] {
  const seen = new Set<string>();
  const merged = [...primary, ...secondary];

  return merged.filter((notification) => {
    if (seen.has(notification.id)) {
      return false;
    }

    seen.add(notification.id);
    return true;
  });
}

interface NotificationItemProps {
  item: UserNotification;
  onPress: (notification: UserNotification) => void;
}

const NotificationItem = React.memo(function NotificationItem({
  item,
  onPress,
}: NotificationItemProps) {
  const iconConfig = getNotificationIconConfig(item);
  const { Icon, backgroundColor, iconColor } = iconConfig;
  const isUnread = !item.is_read;

  return (
    <TouchableOpacity
      testID={`notification-item-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      // MODULE-15.1 FLOW-17: Unread rows #F7F7F7, read rows white
      style={[styles.notificationItem, isUnread && styles.notificationItemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* MODULE-15.1 FLOW-17: No unread dot indicator - removed */}
      <View style={[styles.iconContainer, { backgroundColor }]}>
        <Icon size={20} color={iconColor} weight="regular" testID={`notification-icon-${item.id}`} />
      </View>

      <View style={styles.contentContainer}>
        <Text
          testID={`notification-title-${item.id}`}
          // MODULE-15.1 FLOW-17: Bold title for unread, regular for read
          style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text
          testID={`notification-body-${item.id}`}
          style={styles.notificationBody}
        >
          {item.body}
        </Text>

        <Text style={styles.notificationTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function NotificationCenterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (!n.is_read ? 1 : 0), 0),
    [notifications]
  );

  const navigateWithTarget = useCallback(
    (target: DeepLinkTarget) => {
      const nav = navigation as any;

      if (target.action === 'reset' && typeof nav.reset === 'function') {
        nav.reset({
          index: 0,
          routes: [{ name: target.route, params: target.params }],
        });
        return;
      }

      if (target.params) {
        nav.navigate(target.route, target.params);
      } else {
        nav.navigate(target.route);
      }
    },
    [navigation]
  );

  const loadNotifications = useCallback(
    async (reset = false) => {
      if (!userId) {
        return;
      }

      const offset = reset ? 0 : offsetRef.current;

      try {
        const result = await getUserNotifications(userId, PAGE_SIZE, offset);

        if (!result.success) {
          setError(result.error ?? 'Failed to load notifications');
          return;
        }

        const data = result.data ?? [];

        if (reset) {
          setNotifications(mergeNotificationsById(data, []));
          offsetRef.current = data.length;
        } else {
          setNotifications((prev) => mergeNotificationsById(prev, data));
          offsetRef.current = offset + data.length;
        }

        setHasMore(data.length === PAGE_SIZE);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadNotifications(true).finally(() => setIsLoading(false));
  }, [userId, loadNotifications]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
      setNotifications((prev) => mergeNotificationsById([newNotification], prev));
    });

    return unsubscribe;
  }, [userId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications(true);
    setIsRefreshing(false);
  }, [loadNotifications]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    await loadNotifications(false);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
  }, [hasMore, loadNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: UserNotification) => {
      if (!userId) {
        return;
      }

      if (!notification.is_read) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );

        await markNotificationAsRead(notification.id, userId);
      }

      const notificationData = {
        ...(notification.data ?? {}),
        type:
          typeof (notification.data ?? {}).type === 'string'
            ? (notification.data ?? {}).type
            : notification.type,
        notification_id:
          typeof (notification.data ?? {}).notification_id === 'string'
            ? (notification.data ?? {}).notification_id
            : notification.id,
      } as NotificationDeepLinkData;
      const target = parseNotificationDeepLink(notificationData);

      logDeepLinkNavigation('in_app', notificationData, target);

      if (target) {
        navigateWithTarget(target);
        return;
      }

      const fallback = getFallbackRoute();
      navigateWithTarget(fallback);
    },
    [navigateWithTarget, userId]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId) {
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );

    await markAllNotificationsAsRead(userId);
  }, [userId]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UserNotification>) => (
      <NotificationItem item={item} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress]
  );

  const keyExtractor = useCallback((item: UserNotification) => item.id, []);

  const listHeader = null;

  const listEmpty = !isLoading ? (
    <View testID="empty-state" style={styles.emptyState}>
      {/* MODULE-15.1 FLOW-17: Bell icon (64px, #E0E0E0) + "You're all caught up!" */}
      <Bell size={64} color="#E0E0E0" weight="regular" testID="empty-icon" />
      <Text style={styles.emptyTitle}>You're all caught up!</Text>
      <Text style={styles.emptyBody}>
        You&apos;ll see trade updates, SP events, badge awards, and more here.
      </Text>
    </View>
  ) : null;

  const listFooter = isLoadingMore ? (
    <ActivityIndicator testID="load-more-indicator" style={styles.footer} color="#5DBB8E" />
  ) : null;

  if (isLoading) {
    return (
      <ScreenLayout variant="detail" title="Notifications">
        {listHeader}
        <View testID="loading-state" style={styles.loadingContainer}>
          <ActivityIndicator testID="loading-indicator" size="large" color="#5DBB8E" />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout variant="detail" title="Notifications">
        {listHeader}
        <View testID="error-state" style={styles.emptyState}>
          <Warning size={64} color="#E85D75" weight="regular" testID="error-icon" />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <TouchableOpacity
            testID="retry-button"
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Notifications">
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
        testID="notification-list"
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Whisk white
  },
  emptyContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF', // Whisk white
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0', // Whisk divider
  },
  backButton: {
    minWidth: 48,
    height: 48,
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A', // Whisk text
  },
  // MODULE-15.1 FLOW-17: "Mark All Read" as text link (NOT button)
  markAllLink: {
    minWidth: 60,
    alignItems: 'flex-end',
    paddingVertical: 4,
  },
  markAllLinkText: {
    fontSize: 13,
    color: '#5DBB8E', // Whisk green
    fontWeight: '500',
  },
  markAllPlaceholder: {
    minWidth: 60,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', // MODULE-15.1 FLOW-17: Read rows white
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0', // Whisk divider
    position: 'relative',
  },
  // MODULE-15.1 FLOW-17: Unread rows #F7F7F7 background
  notificationItemUnread: {
    backgroundColor: '#F7F7F7', // Whisk light gray
  },
  iconContainer: {
    width: 40, // MODULE-15.1 FLOW-17: 40px icon circles
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
    // backgroundColor is set inline per category
  },
  contentContainer: {
    flex: 1,
    paddingRight: 16,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '400', // MODULE-15.1 FLOW-17: Regular weight for read
    color: '#1A1A1A', // Whisk text
    marginBottom: 2,
  },
  // MODULE-15.1 FLOW-17: Bold title for unread
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 13,
    color: '#6B6B6B', // Whisk gray
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9E9E9E', // Lighter gray for timestamps
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B6B6B', // Whisk gray
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A', // Whisk text
    marginTop: 12,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B6B6B', // Whisk gray
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E', // Whisk green
    borderRadius: 12, // Whisk standard radius
    minHeight: 48, // Whisk button height (we use shorter for secondary)
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
  },
});
