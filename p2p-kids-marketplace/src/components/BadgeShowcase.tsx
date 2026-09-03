// File: p2p-kids-marketplace/src/components/BadgeShowcase.tsx

import React, { useCallback, useEffect, useState } from 'react';
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
import { CaretRight, Medal } from 'phosphor-react-native';
import { getUserBadges } from '../services/badges';
import { UserBadge } from '../types/badge';

interface BadgeShowcaseProps {
  userId: string;
  /**
   * Optional refresh trigger (increment to force a reload). Lets a parent (e.g.
   * ProfileScreen) re-fetch badges when a celebration modal dismisses, so the
   * "My Badges (N)" count reflects a just-awarded badge immediately.
   * DT97 (Item 5-2). Omitted (default 0) it is a no-op for other callers.
   */
  refreshToken?: number;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({ userId, refreshToken = 0 }) => {
  const navigation = useNavigation<any>();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBadges = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserBadges(userId);
      setBadges(data);
    } catch (error) {
      console.error('Error loading badges for showcase:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, refreshToken]);

  const handleNavigateToBadges = () => {
    navigation.navigate('Badges');
  };

  // DEV-TASK-96 (QA tooling): kebab-case tile id for the showcase strip badges
  // (they were plain Views inside an accessible card → grouped out of the AX
  // tree, so QA had to OCR the strip). Not user-facing.
  const showcaseTileId = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'badge';

  if (loading) {
    return <ActivityIndicator size="small" color="#5DBB8E" style={styles.loader} />;
  }

  if (badges.length === 0) {
    return (
      <TouchableOpacity
        style={styles.container}
        testID="badge-showcase"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Badge showcase"
        onPress={handleNavigateToBadges}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>My Badges (0)</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No badges earned yet. Start trading to earn badges.</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const renderBadge = ({ item }: { item: UserBadge }) => {
    const badgeName = item.badge?.name || 'Milestone';
    return (
      // DEV-TASK-96 (QA tooling): per-badge AX tile (BP-53). Each strip badge
      // is its own accessible button (navigates to My Badges like the card
      // itself), so QA can read which badges the showcase shows in one tree
      // pass instead of OCR-ing the horizontal strip.
      <TouchableOpacity
        style={styles.badgeItem}
        onPress={handleNavigateToBadges}
        activeOpacity={0.7}
        testID={`badge-showcase-${showcaseTileId(badgeName)}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={badgeName}
      >
        <View style={styles.iconContainer}>
          {item.badge?.icon_url ? (
            <Image source={{ uri: item.badge.icon_url }} style={styles.badgeIcon} />
          ) : (
            <Medal size={28} color="#F59E0B" weight="fill" />
          )}
        </View>
        <Text style={styles.badgeName} numberOfLines={1}>
          {badgeName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      testID="badge-showcase"
      onPress={handleNavigateToBadges}
      activeOpacity={0.7}
      // DEV-TASK-96 (QA tooling): the whole card stays touch-tappable, but it
      // must NOT group its children (accessible=false) or the "My Badges (N)"
      // count text and each badge tile below would be hidden from the AX tree
      // (QA previously had to OCR the count + strip names).
      accessible={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Badges ({badges.length})</Text>
        <CaretRight size={24} color="#5DBB8E" weight="bold" />
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
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  loader: {
    marginVertical: 20,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B6B6B',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    gap: 16,
    marginBottom: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 84,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF9EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  badgeIcon: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  badgeName: {
    fontSize: 13,
    color: '#1A1A1A',
    textAlign: 'center',
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 12,
    color: '#5DBB8E',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
});
