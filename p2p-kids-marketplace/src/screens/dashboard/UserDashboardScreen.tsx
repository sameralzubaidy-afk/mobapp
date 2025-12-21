// File: p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx
// MODULE-09: User Dashboard with Subscription & SP Wallet Stats

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import RecommendationsCarousel from '../../components/organisms/RecommendationsCarousel';
import CategorySelector from '../../components/molecules/CategorySelector';
import BottomNavBar from '../../components/organisms/BottomNavBar';

type NavigationProp = NativeStackNavigationProp<any>;

export default function UserDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const { session, refreshSession, isLoading } = useAuth();
  const subscription = useSubscriptionStatus();
  const wallet = useSPWallet();

  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  // Refresh data when screen comes into focus (but not too frequently)
  useEffect(() => {
    if (isFocused && session) {
      // Debounce: only refresh if last refresh was > 30 seconds ago
      const now = Date.now();
      const lastRefresh = (global as any).lastSessionRefresh || 0;
      
      if (now - lastRefresh > 30000) {
        (global as any).lastSessionRefresh = now;
        refreshSession();
      }
    }
  }, [isFocused, session, refreshSession]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>No session found. Please log in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getSubscriptionBadgeColor = () => {
    switch (subscription.status) {
      case 'trial':
        return '#FF9500'; // Orange
      case 'active':
        return '#34C759'; // Green
      case 'grace':
        return '#FF3B30'; // Red
      case 'canceled':
      case 'free':
      default:
        return '#8E8E93'; // Gray
    }
  };

  const getSubscriptionLabel = () => {
    switch (subscription.status) {
      case 'trial':
        return 'Kids Club+ Trial';
      case 'active':
        return 'Kids Club+ Active';
      case 'grace':
        return 'Grace Period';
      case 'canceled':
        return 'Canceled';
      default:
        return 'Free User';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* DISCOVERY-V2-003: Category Browsing */}
        <View style={{ marginBottom: 20 }}>
          <CategorySelector />
        </View>

        {/* DISCOVERY-V2-002: Personalized Recommendations */}
        <View style={styles.recommendationsSection}>
          <RecommendationsCarousel limit={10} />
        </View>

        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileContent}>
            <View style={styles.avatarContainer}>
              {session.user.avatar_url ? (
                <Image
                  source={{ uri: session.user.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarEmoji}>👤</Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{session.user.name || 'User'}</Text>
              <Text style={styles.userEmail}>{session.user.email}</Text>
            </View>
          </View>
        </View>

        {/* Subscription Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Subscription</Text>
            <View
              style={[
                styles.subscriptionBadge,
                { backgroundColor: getSubscriptionBadgeColor() },
              ]}
            >
              <Text style={styles.badgeText}>{getSubscriptionLabel()}</Text>
            </View>
          </View>

          {subscription.status === 'trial' && daysUntilExpiry !== null && (
            <View style={styles.cardRow}>
              <Text style={styles.label}>Trial Ends In:</Text>
              <Text style={styles.value}>
                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )}

          {subscription.status === 'active' && daysUntilExpiry !== null && (
            <View style={styles.cardRow}>
              <Text style={styles.label}>Renews In:</Text>
              <Text style={styles.value}>
                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )}

          {subscription.status === 'grace' && daysUntilExpiry !== null && (
            <View style={styles.cardRow}>
              <Text style={styles.label}>Grace Period Ends In:</Text>
              <Text style={[styles.value, { color: '#FF3B30' }]}>
                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
              </Text>
            </View>
          )}

          {(subscription.status === 'free' || subscription.status === 'canceled') && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate('SubscriptionChoice')}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
            </TouchableOpacity>
          )}

          {subscription.canSpendSP && (
            <View style={styles.featureBadge}>
              <Text style={styles.featureEmoji}>✨</Text>
              <Text style={styles.featureText}>SP Wallet Unlocked</Text>
            </View>
          )}
        </View>

        {/* Swap Points Wallet Card */}
        {subscription.canSpendSP && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Swap Points Wallet</Text>

            {/* Available Points */}
            <View style={styles.pointsRow}>
              <View style={styles.pointsItem}>
                <Text style={styles.pointsEmoji}>💰</Text>
                <Text style={styles.pointsLabel}>Available</Text>
                <Text style={styles.pointsValue}>{wallet.available}</Text>
              </View>

              <View style={styles.pointsDivider} />

              {/* Pending Points */}
              <View style={styles.pointsItem}>
                <Text style={styles.pointsEmoji}>⏳</Text>
                <Text style={styles.pointsLabel}>Pending</Text>
                <Text style={styles.pointsValue}>{wallet.pending}</Text>
              </View>
            </View>

            {/* Lifetime Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Lifetime Earned</Text>
                <Text style={styles.statValue}>{wallet.lifetime_earned}</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Lifetime Spent</Text>
                <Text style={styles.statValue}>{wallet.lifetime_spent}</Text>
              </View>
            </View>

            {/* Wallet Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.earnButton]}
                onPress={() => {
                  // TODO: Navigate to earn SP flows (sell items, refer, etc.)
                  alert('Earn SP by selling items, referring friends, or completing tasks');
                }}
              >
                <Text style={styles.actionEmoji}>🎁</Text>
                <Text style={styles.actionLabel}>How to Earn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.spendButton]}
                onPress={() => {
                  // TODO: Navigate to spending flow (checkout with SP)
                  alert('Use SP at checkout when buying items (max 50% of price)');
                }}
              >
                <Text style={styles.actionEmoji}>🛍️</Text>
                <Text style={styles.actionLabel}>Spend Points</Text>
              </TouchableOpacity>
            </View>

            {wallet.pending > 0 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>💡 Pending Note</Text>
                <Text style={styles.infoText}>
                  Pending points will be released in 3 days. They're locked while your sale is
                  protected.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* SP Locked for Free Users */}
        {!subscription.canSpendSP && (
          <View style={styles.card}>
            <View style={styles.lockedCard}>
              <Text style={styles.lockedEmoji}>🔒</Text>
              <Text style={styles.lockedTitle}>Swap Points Locked</Text>
              <Text style={styles.lockedText}>
                Upgrade to Kids Club+ to start earning and spending Swap Points
              </Text>
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={() => navigation.navigate('SubscriptionChoice')}
              >
                <Text style={styles.unlockButtonText}>Unlock Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Navigation handled by BottomNavBar below */}
        </ScrollView>
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  
  // Recommendations Section
  recommendationsSection: {
    marginBottom: 20,
    marginHorizontal: -16, // Extend to edges
    paddingHorizontal: 16,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  subscriptionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  featureEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },

  // Points Wallet
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  pointsItem: {
    flex: 1,
    alignItems: 'center',
  },
  pointsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  pointsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  pointsDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  earnButton: {
    backgroundColor: '#F0F0F0',
  },
  spendButton: {
    backgroundColor: '#F0F0F0',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  infoBox: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  // Locked Card
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  lockedEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  unlockButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },


});
