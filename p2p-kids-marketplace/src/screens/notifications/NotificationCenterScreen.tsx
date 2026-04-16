// File: p2p-kids-marketplace/src/screens/notifications/NotificationCenterScreen.tsx
// MODULE-14 TASK NOTIF-V2-006: In-App Notification Center
// MODULE-14 TASK NOTIF-V2-008: Notification Deep Linking

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 20;

const CATEGORY_ICONS: Record<string, string> = {
  subscription: '💳',
  sp_events: '✨',
  badges: '🏆',
  trades: '💬',
  referrals: '🎁',
  system: '🔔',
  default: '🔔',
};

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
  const icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.default;
  const isUnread = !item.is_read;

  return (
    <TouchableOpacity
      testID={`notification-item-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[styles.notificationItem, isUnread && styles.notificationItemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {isUnread ? <View testID={`unread-indicator-${item.id}`} style={styles.unreadDot} /> : null}
      <View style={styles.iconContainer}>
        <Text style={styles.categoryIcon}>{icon}</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text
          testID={`notification-title-${item.id}`}
          style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text
          testID={`notification-body-${item.id}`}
          style={styles.notificationBody}
          numberOfLines={2}
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

      const notificationData = (notification.data ?? {}) as NotificationDeepLinkData;
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

  const listHeader = (
    <View style={styles.header}>
      <TouchableOpacity
        testID="back-button"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>

      <Text testID="screen-title" style={styles.title}>
        Notifications
      </Text>

      {unreadCount > 0 ? (
        <TouchableOpacity
          testID="mark-all-read-button"
          onPress={handleMarkAllRead}
          style={styles.markAllButton}
        >
          <Text style={styles.markAllButtonText}>Mark all read</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.markAllPlaceholder} />
      )}
    </View>
  );

  const listEmpty = !isLoading ? (
    <View testID="empty-state" style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptyBody}>
        You&apos;ll see trade updates, SP events, badge awards, and more here.
      </Text>
    </View>
  ) : null;

  const listFooter = isLoadingMore ? (
    <ActivityIndicator testID="load-more-indicator" style={styles.footer} color="#007AFF" />
  ) : null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {listHeader}
        <View testID="loading-state" style={styles.loadingContainer}>
          <ActivityIndicator testID="loading-indicator" size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        {listHeader}
        <View testID="error-state" style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="notification-center-screen" style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  markAllButton: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  markAllButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  markAllPlaceholder: {
    minWidth: 60,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  notificationItemUnread: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  unreadDot: {
    position: 'absolute',
    top: 18,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  categoryIcon: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
    paddingRight: 16,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  notificationTitleUnread: {
    fontWeight: '700',
    color: '#000',
  },
  notificationBody: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
  },
});
