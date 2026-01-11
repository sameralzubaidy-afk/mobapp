// File: p2p-kids-marketplace/src/components/BadgeShowcase.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { getUserBadges } from '../services/badges';
import { UserBadge } from '../types/badge';

interface BadgeShowcaseProps {
  userId: string;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({ userId }) => {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const data = await getUserBadges(userId);
      setBadges(data);
    } catch (error) {
      console.error('Error loading badges for showcase:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="small" color="#3B82F6" style={styles.loader} />;
  }

  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No badges earned yet. Start trading to earn badges!</Text>
      </View>
    );
  }

  const renderBadge = ({ item }: { item: UserBadge }) => (
    <View style={styles.badgeItem}>
      <View style={styles.iconContainer}>
        {item.badge?.icon_url ? (
          <Image source={{ uri: item.badge.icon_url }} style={styles.badgeIcon} />
        ) : (
          <Text style={styles.badgeEmoji}>🏅</Text>
        )}
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>
        {item.badge?.name || 'Milestone'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Badges ({badges.length})</Text>
      <FlatList
        data={badges}
        renderItem={renderBadge}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    gap: 16,
  },
  badgeItem: {
    alignItems: 'center',
    width: 80,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  badgeIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  badgeEmoji: {
    fontSize: 30,
  },
  badgeName: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    fontWeight: '500',
  },
});
