const fs = require('fs');
const path = require('path');

const newContent = `// File: p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, useSPWallet } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { useSubscription } from '@/hooks/useSubscription';
import RecommendationsCarousel from '../../components/organisms/RecommendationsCarousel';
import Avatar from '../../components/atoms/Avatar';
import { idBadgeService } from '@/services/idBadge';
import { TrialReminderBanner } from '../../components/TrialReminderBanner';
import GracePeriodBanner from '../../components/GracePeriodBanner';
import { PaymentFailureBanner } from '../../components/subscription/PaymentFailureBanner';
import { ResumeDraftBanner } from '../../components/molecules/ResumeDraftBanner';
import { getActiveDrafts } from '@/services/draftService';
import { ItemDraft } from '@/types/listing';

import CategorySelector from '../../components/molecules/CategorySelector';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import { LoadingSpinner } from '@/components/ui';

// Phosphor Icons
import {
  Bell,
  Package,
  ArrowsLeftRight,
  MagnifyingGlass,
  Handshake,
  ChatText,
  CreditCard,
  CaretRight
} from 'phosphor-react-native';

type NavigationProp = NativeStackNavigationProp<any>;

export default function UserDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const { session, refreshSession, isLoading } = useAuth();
  const {
    subscription: subscriptionSummary,
    loading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useSubscription();
  const wallet = useSPWallet();

  const subscription = {
    status: subscriptionSummary?.status ?? 'free',
    canSpendSP: subscriptionSummary?.can_spend_sp ?? false,
  };

  const [refreshing, setRefreshing] = useState(false);
  const [daysUntilExpiry] = useState<number | null>(null);
  const [graceEndDate, setGraceEndDate] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [isDraftBannerDismissed, setIsDraftBannerDismissed] = useState(false);
  const hasRefreshedRef = useRef(false);

  const loadSubscriptionTimeline = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end_date, current_period_end, grace_ends_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      if (data.status === 'trial' && data.trial_end_date) {
        setGraceEndDate(null);
        return;
      }
      if (data.status === 'active' && data.current_period_end) {
        setGraceEndDate(null);
        return;
      }
      if ((data.status === 'grace' || data.status === 'grace_period') && data.grace_ends_at) {
        setGraceEndDate(data.grace_ends_at);
        return;
      }
      setGraceEndDate(null);
    } catch (error) {
      console.warn('[Dashboard] Failed to load subscription timeline:', error);
      setGraceEndDate(null);
    }
  };

  const loadVerificationStatus = async () => {
    if (session?.user?.id) {
      try {
        const status = await idBadgeService.getVerificationStatus(session.user.id);
        setVerificationStatus(status?.status || null);
      } catch (error) {
        console.warn('[Dashboard] Failed to load verification status:', error);
      }
    }
  };

  const loadDrafts = async () => {
    if (session?.user?.id) {
      try {
        const activeDrafts = await getActiveDrafts(session.user.id);
        setDrafts(activeDrafts);
      } catch (error) {
        console.warn('[Dashboard] Failed to load drafts:', error);
        setDrafts([]);
      }
    }
  };

  const handleResumeDraft = (draftId: string, isBulk: boolean) => {
    if (isBulk) {
      navigation.navigate('BulkListingCreate', { draftId });
    } else {
      navigation.navigate('ItemCreate', { draftId });
    }
  };

  const handleDismissDraftBanner = () => {
    setIsDraftBannerDismissed(true);
  };

  useEffect(() => {
    if (isFocused) {
      loadVerificationStatus();
      loadSubscriptionTimeline();
      loadDrafts();
      setIsDraftBannerDismissed(false);
    }
  }, [isFocused]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession(),
        refetchSubscription(),
        loadVerificationStatus(),
        loadSubscriptionTimeline(),
      ]);
    } catch (error) {
      console.error('[Dashboard] Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadVerificationStatus();
      loadSubscriptionTimeline();
    }
  }, [isFocused, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFocused) {
      if (!hasRefreshedRef.current) {
        Promise.all([refreshSession(), refetchSubscription()]).catch((error) => {
          console.warn('[Dashboard] Focus refresh failed:', error);
        });
        hasRefreshedRef.current = true;
      }
    } else {
      hasRefreshedRef.current = false;
    }
  }, [isFocused, refreshSession, refetchSubscription]);

  if (isLoading || subscriptionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <LoadingSpinner />
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
      case 'trial': return '#FF9500';
      case 'active': return '#34C759';
      case 'grace_period':
      case 'grace': return '#FF3B30';
      case 'cancelled':
      case 'canceled':
      case 'free':
      default: return '#8E8E93';
    }
  };

  const getSubscriptionLabel = () => {
    switch (subscription.status) {
      case 'trial': return 'Kids Club+ Trial';
      case 'active': return 'Kids Club+ Active';
      case 'grace_period':
      case 'grace': return 'Grace Period';
      case 'cancelled':
      case 'canceled': return 'Canceled';
      default: return 'Free User';
    }
  };

  const displayName = session.user.display_name || session.user.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        
        {/* Header - Fixed At Top */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatarContainer}>
              <Avatar
                imageUrl={session.user.avatar_url}
                size={40}
                verificationStatus={verificationStatus as any}
                name={displayName}
              />
            </View>
            <View>
              <Text style={styles.greetingText}>Hello,</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('NotificationCenter')}
          >
            <Bell size={24} color="#1A1A1A" weight="bold" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* SP Wallet Strip */}
          {subscription.canSpendSP && (
            <View style={styles.spStrip}>
              <View>
                <Text style={styles.spStripTitle}>My Balance</Text>
                <View style={styles.spStripValueRow}>
                  <Text style={styles.spStripValue}>{wallet.available}</Text>
                  <Text style={styles.spStripCurrency}>🔄 SP</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.spStripBtn}
                onPress={() => navigation.navigate('SpWallet')}
              >
                <Text style={styles.spStripBtnText}>Wallet</Text>
                <CaretRight size={16} color="#111" weight="bold" />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Actions Grid (2x3) */}
          <View style={styles.quickActionsContainer}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('ItemCreate')}>
                <View style={styles.iconCircle}>
                  <Package size={24} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.actionLabel}>Sell</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('Trading')}>
                <View style={styles.iconCircle}>
                  <ArrowsLeftRight size={24} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.actionLabel}>Trade</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('Discover')}>
                <View style={styles.iconCircle}>
                  <MagnifyingGlass size={24} color="#FFFFFF" weight="bold" />
                </View>
                <Text style={styles.actionLabel}>Discover</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('MyTrades')}>
                <View style={styles.iconCircle}>
                  <Handshake size={24} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.actionLabel}>My Trades</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('Conversations')}>
                <View style={styles.iconCircle}>
                  <ChatText size={24} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.actionLabel}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={() => navigation.navigate('PayoutSettings')}>
                <View style={styles.iconCircle}>
                  <CreditCard size={24} color="#FFFFFF" weight="fill" />
                </View>
                <Text style={styles.actionLabel}>Payouts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LISTING-V3-007: Resume Draft Banner */}
          {!isDraftBannerDismissed && drafts.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <ResumeDraftBanner
                drafts={drafts}
                onResume={handleResumeDraft}
                onDismiss={handleDismissDraftBanner}
              />
            </View>
          )}

          {/* Trial Reminder Banner */}
          <TrialReminderBanner />

          {/* SUB-018: Payment Failure Handling Banner */}
          <PaymentFailureBanner subscription={subscriptionSummary} loading={subscriptionLoading} />

          {/* MODULE-11 SUB-009: Grace Period Countdown Banner */}
          {(subscription.status === 'grace' || subscription.status === 'grace_period') &&
            graceEndDate &&
            (() => {
              const gracePeriodEndsAt = graceEndDate;
              const daysRemaining = Math.ceil(
                (new Date(gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return daysRemaining > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <GracePeriodBanner
                    gracePeriodEndsAt={gracePeriodEndsAt}
                    daysRemaining={daysRemaining}
                  />
                </View>
              ) : null;
            })()}

          {/* DISCOVERY-V2-003: Category Browsing */}
          <View style={{ marginBottom: 24 }}>
            <CategorySelector />
          </View>

          {/* DISCOVERY-V2-002: Personalized Recommendations */}
          <View style={styles.recommendationsSection}>
            <RecommendationsCarousel limit={10} />
          </View>

          {/* Subscription Summary Details */}
          <TouchableOpacity
            style={styles.subscriptionSummaryCard}
            onPress={() => navigation.navigate('SubscriptionStatus')}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardSectionTitle}>Subscription</Text>
              <View
                style={[styles.subscriptionBadge, { backgroundColor: getSubscriptionBadgeColor() }]}
              >
                <Text style={styles.badgeText}>{getSubscriptionLabel()}</Text>
              </View>
            </View>

            {(subscription.status === 'free' ||
              subscription.status === 'canceled' ||
              subscription.status === 'cancelled') && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => navigation.navigate('SubscriptionPlans')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Kids Club+</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    fontFamily: 'Nunito-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    marginRight: 12,
  },
  greetingText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito-Regular',
  },
  userName: {
    fontSize: 18,
    color: '#1A1A1A',
    fontFamily: 'Nunito-Bold',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  spStrip: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#5DBB8E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  spStripTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    fontFamily: 'Nunito-Medium',
    marginBottom: 4,
  },
  spStripValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spStripValue: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: 'Nunito-ExtraBold',
    marginRight: 6,
  },
  spStripCurrency: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Nunito-Bold',
  },
  spStripBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spStripBtnText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Nunito-Bold',
    marginRight: 4,
  },

  quickActionsContainer: {
    marginBottom: 28,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionTile: {
    width: '30%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    color: '#1A1A1A',
    fontFamily: 'Nunito-Medium',
    textAlign: 'center',
  },
  recommendationsSection: {
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardSectionTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: 'Nunito-Bold',
  },
  subscriptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
  },
  upgradeButton: {
    backgroundColor: '#5DBB8E',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
  },
});
`

fs.writeFileSync(path.join(process.cwd(), 'p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx'), newContent);
console.log('UserDashboardScreen rewritten successfully.');
