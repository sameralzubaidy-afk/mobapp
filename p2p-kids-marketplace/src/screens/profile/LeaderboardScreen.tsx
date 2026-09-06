// filepath: p2p-kids-marketplace/src/screens/profile/LeaderboardScreen.tsx
// MODULE-15.1 FLOW-19: LeaderboardScreen — Pass It Up design system

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { getBadgeLeaderboard, LeaderboardEntry } from '../../services/badges';
import { captureException } from '@/services/errorReporter';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

const LeaderboardScreen = ({ navigation: _navigation }: any) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBadgeLeaderboard(50); // Top 50 users

      // DEBUG: Log the response
      console.log('[LeaderboardScreen] Fetched leaderboard data:', {
        count: data.length,
        topEntry: data[0],
        allEntries: data,
      });

      setLeaderboard(data);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      captureException(err, {
        tags: { screen: 'LeaderboardScreen', action: 'load_leaderboard' },
        extra: { message: errorMsg },
      });
      setError(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  const getMedalEmoji = (rank: number): string => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '🏅';
    }
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 1;
    const isTopThree = rank <= 3;

    return (
      <View style={[styles.leaderboardItem, isTopThree && styles.topThreeItem]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankEmoji}>{getMedalEmoji(rank)}</Text>
          <Text style={[styles.rankText, isTopThree && styles.topThreeRank]}>#{rank}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.userName, isTopThree && styles.topThreeUserName]} numberOfLines={1}>
            {item.display_name || 'Anonymous User'}
          </Text>
          <Text style={styles.badgeCount}>
            {item.badge_count} badge{item.badge_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  // Guard skipped during pull-to-refresh to prevent blank screen flash.
  if (loading && !refreshing) {
    return (
      <ScreenLayout variant="detail" title="Leaderboard">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Leaderboard">
      <View style={styles.descriptionContainer}>
        <Text style={styles.description}>Top traders ranked by total badges earned 🏆</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ Error: {error}</Text>
          <TouchableOpacity onPress={loadLeaderboard} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Badges Yet</Text>
          <Text style={styles.emptyText}>
            Be the first to earn badges and climb the leaderboard!
          </Text>
          <TouchableOpacity onPress={loadLeaderboard} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item, index) => `${item.user_id}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5DBB8E" />
          }
        />
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B6B6B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#5DBB8E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  descriptionContainer: {
    padding: 16,
    backgroundColor: '#E8F3EC',
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#5DBB8E',
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
  },
  errorText: {
    fontSize: 13,
    color: '#E53935',
    marginBottom: 8,
  },
  retryButton: {
    padding: 8,
    backgroundColor: '#5DBB8E',
    borderRadius: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  topThreeItem: {
    backgroundColor: '#FFFBF0',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 70,
  },
  rankEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  topThreeRank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  topThreeUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#92400E',
  },
  badgeCount: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '500',
  },
});

export default LeaderboardScreen;
