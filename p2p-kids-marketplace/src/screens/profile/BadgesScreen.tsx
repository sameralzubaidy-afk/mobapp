// filepath: p2p-kids-marketplace/src/screens/profile/BadgesScreen.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { getUserBadges, getAllBadges } from '../../services/badges';
import { UserBadge, Badge } from '../../types/badge';
import { useAuth } from '../../hooks/useAuth';

const BadgesScreen = ({ navigation }: any) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uBadges, aBadges] = await Promise.all([
        getUserBadges(userId!),
        getAllBadges()
      ]);
      setUserBadges(uBadges);
      setAllBadges(aBadges);
    } catch (error) {
      console.error('Error loading badges screen:', error);
    } finally {
      setLoading(false);
    }
  };

  const isBadgeEarned = (badgeId: string) => {
    return userBadges.some(ub => ub.badge_id === badgeId);
  };

  const renderBadgeItem = ({ item }: { item: Badge }) => {
    const earned = isBadgeEarned(item.id);
    const userBadgeInfo = userBadges.find(ub => ub.badge_id === item.id);

    return (
      <View style={[styles.badgeCard, !earned && styles.lockedBadgeCard]}>
        <View style={[styles.iconContainer, !earned && styles.lockedIconContainer]}>
          <Text style={styles.badgeEmoji}>{earned ? '🏅' : '🔒'}</Text>
        </View>
        <Text style={styles.badgeName}>{item.name}</Text>
        <Text style={styles.badgeDescription} numberOfLines={2}>{item.description}</Text>
        {earned && userBadgeInfo && (
          <Text style={styles.awardedDate}>
            Earned {new Date(userBadgeInfo.awarded_at).toLocaleDateString()}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          You have earned <Text style={styles.statsHighlight}>{userBadges.length}</Text> out of <Text style={styles.statsHighlight}>{allBadges.length}</Text> badges
        </Text>
      </View>

      <FlatList
        data={allBadges}
        renderItem={renderBadgeItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
      />
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
  statsContainer: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#1E40AF',
  },
  statsHighlight: {
    fontWeight: 'bold',
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
  },
  badgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lockedBadgeCard: {
    opacity: 0.7,
    backgroundColor: '#F3F4F6',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedIconContainer: {
    backgroundColor: '#E5E7EB',
  },
  badgeEmoji: {
    fontSize: 30,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  awardedDate: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
});

export default BadgesScreen;
