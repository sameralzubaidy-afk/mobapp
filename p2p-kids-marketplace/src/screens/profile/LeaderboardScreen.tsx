// filepath: p2p-kids-marketplace/src/screens/profile/LeaderboardScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getBadgeLeaderboard, LeaderboardEntry } from '../../services/badges';

const LeaderboardScreen = ({ navigation }: any) => {
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
      console.error('[LeaderboardScreen] Error loading leaderboard:', errorMsg);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Badge Leaderboard</Text>
        <View style={{ width: 60 }} />
      </View>

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  descriptionContainer: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#1E40AF',
    textAlign: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    marginBottom: 8,
  },
  retryButton: {
    padding: 8,
    backgroundColor: '#DC2626',
    borderRadius: 6,
    alignSelf: 'flex-start',
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
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topThreeItem: {
    backgroundColor: '#FEF3C7',
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
    color: '#6B7280',
  },
  topThreeRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B45309',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  topThreeUserName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#92400E',
  },
  badgeCount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
});

export default LeaderboardScreen;
