// filepath: p2p-kids-marketplace/src/screens/profile/BadgesScreen.tsx
// TASK FLOW-15: UI Redesign - Badges with Phosphor icons

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal } from 'react-native';
import { Medal, Lock } from 'phosphor-react-native';
import { getUserBadges, getAllBadges } from '../../services/badges';
import { captureException } from '@/services/errorReporter';
import { UserBadge, Badge } from '../../types/badge';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

interface BadgeModalData extends Badge {
  earned?: boolean;
  userBadgeInfo?: UserBadge;
}

const BadgesScreen = ({ navigation: _navigation }: any) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<BadgeModalData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uBadges, aBadges] = await Promise.all([getUserBadges(userId!), getAllBadges()]);
      setUserBadges(uBadges);
      setAllBadges(aBadges);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'BadgesScreen', action: 'load_badges' },
      });
    } finally {
      setLoading(false);
    }
  };

  const isBadgeEarned = (badgeId: string) => {
    return userBadges.some((ub) => ub.badge_id === badgeId);
  };

  // DEV-TASK-96 (QA tooling): stable kebab-case tile id from a badge name so
  // the QA agent can target a specific grid tile in one AX-tree read. Badge
  // tiles were AX-invisible (image+label) → every earned/locked assertion
  // degenerated into screenshot→OCR→pixel-scan. Not user-facing.
  const badgeTileId = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'badge';

  const renderBadgeItem = ({ item }: { item: Badge }) => {
    const earned = isBadgeEarned(item.id);
    const userBadgeInfo = userBadges.find((ub) => ub.badge_id === item.id);

    return (
      <TouchableOpacity
        style={[styles.badgeCell, earned ? styles.earnedBadgeCell : styles.lockedBadgeCell]}
        onPress={() => {
          setSelectedBadge({ ...item, earned, userBadgeInfo });
          setModalVisible(true);
        }}
        // DEV-TASK-96 (QA tooling): per-tile testID + AX label (BP-53) so QA
        // can assert badge name + earned/locked state from the tree in one read.
        testID={`badge-tile-${badgeTileId(item.name)}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${earned ? 'earned' : 'locked'}`}
      >
        {item.icon_url ? (
          <Image source={{ uri: item.icon_url }} style={styles.badgeImage} resizeMode="contain" />
        ) : (
          <Medal size={28} color={earned ? '#F59E0B' : '#CCCCCC'} weight="regular" />
        )}
        <Text style={earned ? styles.earnedBadgeLabel : styles.lockedBadgeLabel}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <ScreenLayout variant="detail" title="My Badges">
      <FlatList
        data={allBadges}
        renderItem={renderBadgeItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.badgeGrid}
      />

      {/* Badge Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        // DEV-TASK-96 (QA tooling): let the modal's Close surface as its own AX
        // element (BP-53 — accessible containers group their children).
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
          // BP-53: the overlay must not group its children or the Close button
          // below never surfaces in the iOS AX tree.
          accessible={false}
        >
          <View style={styles.modalContent}>
            {selectedBadge && !selectedBadge.earned && (
              <Lock size={24} color="#CCCCCC" weight="regular" style={{ marginBottom: 16 }} />
            )}
            <Text style={styles.modalTitle}>{selectedBadge?.name}</Text>
            <Text style={styles.modalDescription}>
              {selectedBadge?.earned
                ? selectedBadge.description
                : selectedBadge?.description || 'Keep going to unlock this badge!'}
            </Text>
            {selectedBadge?.earned && selectedBadge?.userBadgeInfo && (
              <Text style={styles.modalUnlockDate}>
                Unlocked: {new Date(selectedBadge.userBadgeInfo.awarded_at).toLocaleDateString()}
              </Text>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              // DEV-TASK-96 (QA tooling): the badge-detail Close previously had
              // NO testID at all — QA had to OCR + pixel-scan the green pill.
              testID="badge-detail-close-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#F0F0F0',
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
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  listContent: {
    padding: 16,
  },
  badgeGrid: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeCell: {
    width: '30%',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  earnedBadgeCell: {
    backgroundColor: '#FFF9EC',
  },
  lockedBadgeCell: {
    backgroundColor: '#F7F7F7',
    opacity: 0.6,
  },
  badgeImage: {
    width: 28,
    height: 28,
  },
  earnedBadgeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  lockedBadgeLabel: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalUnlockDate: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BadgesScreen;
