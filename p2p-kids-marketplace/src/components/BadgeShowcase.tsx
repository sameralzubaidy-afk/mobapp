// File: p2p-kids-marketplace/src/components/BadgeShowcase.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getUserBadges } from '../services/badges';
import { UserBadge } from '../types/badge';

interface BadgeShowcaseProps {
  userId: string;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({ userId }) => {
  const navigation = useNavigation<any>();
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

  const handleNavigateToBadges = () => {
    navigation.navigate('Badges');
  };

  if (loading) {
    return <ActivityIndicator size="small" color="#3B82F6" style={styles.loader} />;
  }

  if (badges.length === 0) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handleNavigateToBadges}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>My Badges (0)</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No badges earned yet. Start trading to earn badges! →
          </Text>
        </View>
      </TouchableOpacity>
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
    <TouchableOpacity style={styles.container} onPress={handleNavigateToBadges} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title}>My Badges ({badges.length})</Text>
        <Text style={styles.viewAllArrow}>→</Text>
      </View>
      <FlatList
        data={badges}
        renderItem={renderBadge}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
      />
      <Text style={styles.tapHint}>Tap to view all badges</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  viewAllArrow: {
    fontSize: 20,
    color: '#3B82F6',
    fontWeight: 'bold',
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
    marginBottom: 12,
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
  tapHint: {
    fontSize: 11,
    color: '#3B82F6',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
