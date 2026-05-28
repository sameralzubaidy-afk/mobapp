// File: p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx
// MODULE-15.1 FLOW-16: Home Dashboard Redesign — Whisk Design System

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Internal hooks / services (unchanged — DO NOT MODIFY logic)
import { useAuth, useSPWallet } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getActiveDrafts } from '@/services/draftService';
import { idBadgeService } from '@/services/idBadge';
import { supabase } from '@/config/supabase';

// Types
import { ItemDraft } from '@/types/listing';

// Shared components (unchanged — DO NOT MODIFY)
import ScreenLayout from '@/components/ScreenLayout';
import CategorySelector from '../../components/molecules/CategorySelector';
import RecommendationsCarousel from '../../components/organisms/RecommendationsCarousel';
import { ResumeDraftBanner } from '../../components/molecules/ResumeDraftBanner';
import { IDVerificationCTABanner } from '../../components/molecules/IDVerificationCTABanner';
import GracePeriodBanner from '../../components/GracePeriodBanner';
import { PaymentFailureBanner } from '../../components/subscription/PaymentFailureBanner';
import { TrialReminderBanner } from '../../components/TrialReminderBanner';
import { LoadingSpinner } from '@/components/ui';

// Phosphor Icons — Whisk Design System
import {
  ChatText,
  Coins,
  CreditCard,
  Handshake,
  List,
  MagnifyingGlass,
  Sparkle,
  Storefront,
  TrendUp,
} from 'phosphor-react-native';

type NavigationProp = NativeStackNavigationProp<any>;

// ─── Helper: time-based greeting ──────────────────────────────────────────────
function _getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Quick Action tile config ──────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { key: 'sell',       label: 'Sell',        Icon: Storefront,      route: 'ItemCreate' },
  { key: 'discover',   label: 'Discover',    Icon: MagnifyingGlass, route: 'Discover' },
  { key: 'myTrades',   label: 'My Trades',   Icon: Handshake,       route: 'TradeList' },
  { key: 'myListings', label: 'My Listings', Icon: List,            route: 'MyListings' },
  { key: 'messages',   label: 'Messages',    Icon: ChatText,        route: 'Conversations' },
  { key: 'payouts',    label: 'Payouts',     Icon: CreditCard,      route: 'PayoutSettings' },
] as const;

// ─── Transaction status label ──────────────────────────────────────────────────
function txStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'PENDING',
    active: 'ACTIVE',
    in_progress: 'IN PROGRESS',
    payment_processing: 'PAYMENT PROCESSING',
    payment_failed: 'PAYMENT FAILED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
    disputed: 'IN DISPUTE',
  };
  return map[status] ?? status.toUpperCase();
}

function txStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: '#FF9500',
    active: '#5DBB8E',
    in_progress: '#5DBB8E',
    payment_processing: '#FF9500',
    payment_failed: '#E85D75',
    completed: '#34C759',
    cancelled: '#8E8E93',
    canceled: '#8E8E93',
    disputed: '#E85D75',
  };
  return map[status] ?? '#8E8E93';
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function UserDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();

  // ── Auth & subscription (NO logic changes) ─────────────────────────────────
  const { session, refreshSession, isLoading, logout: _logout } = useAuth();
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

  // ── Local state ────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [graceEndDate, setGraceEndDate] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [isDraftBannerDismissed, setIsDraftBannerDismissed] = useState(false);
  // ID verification CTA
  const [idVerifStatus, setIdVerifStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('approved');
  const [isIdCtaDismissed, setIsIdCtaDismissed] = useState(false);
  // Action Items section: show all toggle
  const [showAllCtas, setShowAllCtas] = useState(false);
  const [sellSheetVisible, setSellSheetVisible] = useState(false);
  const [recentTrade, setRecentTrade] = useState<{
    id: string;
    title: string;
    status: string;
  } | null>(null);
  const hasRefreshedRef = useRef(false);

  // ── Data loaders (NO logic changes) ────────────────────────────────────────
  const loadSubscriptionTimeline = useCallback(async () => {
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
      if ((data.status === 'grace' || data.status === 'grace_period') && data.grace_ends_at) {
        setGraceEndDate(data.grace_ends_at);
      } else {
        setGraceEndDate(null);
      }
    } catch {
      setGraceEndDate(null);
    }
  }, [session?.user?.id]);

  const loadIdVerificationStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const result = await idBadgeService.getVerificationStatus(session.user.id);
      setIdVerifStatus(result.status);
    } catch {
      // Fail safe: don't nag user if check fails
      setIdVerifStatus('approved');
    }
  }, [session?.user?.id]);

  const loadDrafts = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setDrafts(await getActiveDrafts(session.user.id));
    } catch {
      setDrafts([]);
    }
  }, [session?.user?.id]);

  const loadRecentTrade = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('trades')
        .select('id, status, listing_id, listing:items(title)')
        .or(`buyer_id.eq.${session.user.id},seller_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const listingTitle =
          (data.listing as unknown as { title?: string } | null)?.title ?? 'Trade';
        setRecentTrade({ id: data.id, title: listingTitle, status: data.status });
      } else {
        setRecentTrade(null);
      }
    } catch {
      setRecentTrade(null);
    }
  }, [session?.user?.id]);

  // ── Effects (NO logic changes) ──────────────────────────────────────────────
  useEffect(() => {
    if (!isFocused) {
      hasRefreshedRef.current = false;
      return;
    }
    loadSubscriptionTimeline();
    loadDrafts();
    loadRecentTrade();
    loadIdVerificationStatus();
    setIsDraftBannerDismissed(false);
    setIsIdCtaDismissed(false);
    setShowAllCtas(false);
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFocused) {
      loadSubscriptionTimeline();
    }
  }, [isFocused, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isFocused) return;
    if (!hasRefreshedRef.current) {
      Promise.all([refreshSession(), refetchSubscription()]).catch(() => {});
      hasRefreshedRef.current = true;
    }
  }, [isFocused, refreshSession, refetchSubscription]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession(),
        refetchSubscription(),
        loadSubscriptionTimeline(),
        loadRecentTrade(),
        loadIdVerificationStatus(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, refetchSubscription, loadSubscriptionTimeline, loadRecentTrade, loadIdVerificationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render guards ──────────────────────────────────────────────────────────
  // Guard skipped during pull-to-refresh (refreshing=true) to prevent blank screen flash.
  // Old content stays visible behind the RefreshControl spinner.
  if ((isLoading || subscriptionLoading) && !refreshing) {
    return (
      <ScreenLayout variant="main" showLogout style={styles.container}>
        <View style={styles.centerContent}>
          <LoadingSpinner />
        </View>
      </ScreenLayout>
    );
  }

  if (!session) {
    return (
      <ScreenLayout variant="main" showLogout style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>No session found. Please log in.</Text>
        </View>
      </ScreenLayout>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const _displayName = session.user.display_name || session.user.email?.split('@')[0] || 'User';

  const subBadgeColor = (() => {
    switch (subscription.status) {
      case 'trial': return '#FF9500';
      case 'active': return '#34C759';
      case 'grace_period':
      case 'grace': return '#E85D75';
      default: return '#8E8E93';
    }
  })();

  const subBadgeLabel = (() => {
    switch (subscription.status) {
      case 'trial': return 'Kids Club+ Trial';
      case 'active': return 'Kids Club+ Active';
      case 'grace_period':
      case 'grace': return 'Grace Period';
      case 'cancelled':
      case 'canceled': return 'Canceled';
      default: return 'Free Plan';
    }
  })();

  const isFreeUser =
    subscription.status === 'free' ||
    subscription.status === 'canceled' ||
    subscription.status === 'cancelled';

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <ScreenLayout variant="main" showLogout style={styles.container}>
      {/* ── Scrollable Content ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5DBB8E" />}
      >
        {/* ── SP Balance Strip ──────────────────────────────────────────── */}
        {subscription.canSpendSP ? (
          <TouchableOpacity
            style={styles.spStrip}
            onPress={() => navigation.navigate('SpWallet')}
            activeOpacity={0.85}
          >
            <View style={styles.spStripLeft}>
              <Coins size={20} color="#FFFFFF" weight="fill" />
              <Text style={styles.spBalance}>{wallet.available} SP</Text>
            </View>
            <Text style={styles.spEarnMore}>Earn More →</Text>
          </TouchableOpacity>
        ) : (
          /* Free users: upgrade nudge strip */
          <TouchableOpacity
            style={[styles.spStrip, styles.spStripFree]}
            onPress={() => navigation.navigate('SubscriptionPlans')}
            activeOpacity={0.85}
          >
            <View style={styles.spStripLeft}>
              <TrendUp size={20} color="#FFFFFF" weight="bold" />
              <Text style={styles.spBalance}>Unlock Swap Points</Text>
            </View>
            <Text style={styles.spEarnMore}>Upgrade →</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Actions Row ────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScroll}
          contentContainerStyle={styles.actionsScrollContent}
        >
          {QUICK_ACTIONS.map(({ key, label, Icon, route }) => (
            <TouchableOpacity
              key={key}
              testID={`action-tile-${key}`}
              style={styles.actionTile}
              onPress={() =>
                key === 'sell'
                  ? setSellSheetVisible(true)
                  : navigation.navigate(route as any)
              }
              activeOpacity={0.75}
            >
              <View style={styles.actionIconWrap}>
                <Icon size={26} color="#5DBB8E" weight="regular" />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Subscription Alerts (always shown when relevant) ──────────── */}
        <TrialReminderBanner />
        <PaymentFailureBanner subscription={subscriptionSummary} loading={subscriptionLoading} />

        {/* ── Action Items Section ──────────────────────────────────────── */}
        {(() => {
          const graceDaysRemaining =
            (subscription.status === 'grace' || subscription.status === 'grace_period') &&
            graceEndDate
              ? Math.ceil((new Date(graceEndDate).getTime() - Date.now()) / 86_400_000)
              : 0;

          // Build ordered list of active CTA items (priority: ID verif > SP > drafts)
          type CtaItem = { key: string; node: React.ReactNode };
          const allCtas: CtaItem[] = [];

          if (
            !isIdCtaDismissed &&
            (idVerifStatus === 'none' || idVerifStatus === 'rejected')
          ) {
            allCtas.push({
              key: 'id_verification',
              node: (
                <IDVerificationCTABanner
                  status={idVerifStatus as 'none' | 'rejected'}
                  onVerify={() => navigation.navigate('IDVerificationUpload')}
                  onDismiss={() => setIsIdCtaDismissed(true)}
                />
              ),
            });
          }

          if (graceDaysRemaining > 0) {
            allCtas.push({
              key: 'grace_period',
              node: (
                <GracePeriodBanner
                  gracePeriodEndsAt={graceEndDate!}
                  daysRemaining={graceDaysRemaining}
                />
              ),
            });
          }

          if (!isDraftBannerDismissed && drafts.length > 0) {
            allCtas.push({
              key: 'drafts',
              node: (
                <ResumeDraftBanner
                  drafts={drafts}
                  onResume={(draftId, isBulk) =>
                    navigation.navigate(isBulk ? 'BulkListingCreate' : 'ItemCreate', { draftId })
                  }
                  onDismiss={() => setIsDraftBannerDismissed(true)}
                />
              ),
            });
          }

          if (allCtas.length === 0) return null;

          const MAX_VISIBLE = 3;
          const visibleCtas = showAllCtas ? allCtas : allCtas.slice(0, MAX_VISIBLE);
          const hiddenCount = allCtas.length - MAX_VISIBLE;

          return (
            <View style={styles.actionItemsSection}>
              <Text style={styles.actionItemsTitle}>Action Items</Text>
              {visibleCtas.map((cta) => (
                <View key={cta.key} style={styles.ctaItemWrap}>
                  {cta.node}
                </View>
              ))}
              {!showAllCtas && hiddenCount > 0 && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => setShowAllCtas(true)}
                  testID="action-items-show-all"
                >
                  <Text style={styles.showAllText}>
                    Show {hiddenCount} more action{hiddenCount > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
              {showAllCtas && allCtas.length > MAX_VISIBLE && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => setShowAllCtas(false)}
                  testID="action-items-show-less"
                >
                  <Text style={styles.showAllText}>Show less</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ── Browse Categories ─────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <CategorySelector showTitle={false} />
        </View>

        {/* ── Recommended for You ──────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recommended for You</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Discover')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <RecommendationsCarousel limit={10} showTitle={false} />
        </View>

        {/* ── Subscription Card ────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('MySubscription' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Subscription</Text>
            <View style={[styles.subBadge, { backgroundColor: subBadgeColor }]}>
              <Text style={styles.subBadgeText}>{subBadgeLabel}</Text>
            </View>
          </View>

          {subscription.canSpendSP && (
            <View style={styles.spUnlockedBadge}>
              <Sparkle size={16} color="#5DBB8E" weight="fill" />
              <Text style={styles.spUnlockedText}>SP Wallet Unlocked</Text>
            </View>
          )}

          {isFreeUser && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => navigation.navigate('SubscriptionPlans')}
            >
              <Text style={styles.upgradeBtnText}>Upgrade to Kids Club+</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>



        {/* ── Latest Trade ─────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Latest Trade</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TradeList' as any)}>
            <Text style={styles.seeAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        {recentTrade ? (
          <View style={styles.card}>
            <View style={styles.tradeRow}>
              <View style={styles.tradeInfo}>
                <Text style={styles.tradeItemTitle} numberOfLines={1}>
                  {recentTrade.title}
                </Text>
                <View
                  style={[
                    styles.tradeStatusBadge,
                    { backgroundColor: txStatusColor(recentTrade.status) + '22' },
                  ]}
                >
                  <Text
                    style={[styles.tradeStatusText, { color: txStatusColor(recentTrade.status) }]}
                  >
                    {txStatusLabel(recentTrade.status)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewTimelineBtn}
                onPress={() =>
                  navigation.navigate('TradeTimeline', { tradeId: recentTrade.id })
                }
              >
                <Text style={styles.viewTimelineBtnText}>View Timeline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyTradeCard}>
            <Text style={styles.emptyTradeText}>No active trades right now</Text>
          </View>
        )}



        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Sell Options Sheet ───────────────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={sellSheetVisible}
        onRequestClose={() => setSellSheetVisible(false)}
        testID="sell-options-sheet"
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSellSheetVisible(false)}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sell</Text>
            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                setSellSheetVisible(false);
                navigation.navigate('ItemCreate' as any, { showPhotoSourcePrompt: true });
              }}
              testID="sell-option-list-one-item"
            >
              <Text style={styles.sheetButtonTitle}>List One Item</Text>
              <Text style={styles.sheetButtonMeta}>Snap a photo or choose from your library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                setSellSheetVisible(false);
                navigation.navigate('BulkListingCreate' as any, { showPhotoSourcePrompt: true });
              }}
              testID="sell-option-bulk-upload"
            >
              <Text style={styles.sheetButtonTitle}>Bulk Upload</Text>
              <Text style={styles.sheetButtonMeta}>List several items at once</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#E85D75',
  },

  // ─── Scroll ─────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // ─── SP Strip ───────────────────────────────────────────────────────────────
  spStrip: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#5DBB8E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  spStripFree: {
    backgroundColor: '#7B8FA1',
  },
  spStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spEarnMore: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },

  // ─── Quick Actions Row ────────────────────────────────────────────────────────
  actionsScroll: {
    marginHorizontal: -20,
    marginBottom: 24,
  },
  actionsScrollContent: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  actionTile: {
    width: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EDF8F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },

  // ─── Section helpers ─────────────────────────────────────────────────────────
  sectionGap: {
    marginBottom: 20,
  },

  // ─── Action Items Section ────────────────────────────────────────────────────
  actionItemsSection: {
    marginBottom: 24,
  },
  actionItemsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  ctaItemWrap: {
    marginBottom: 12,
  },
  showAllBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  showAllText: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
  },

  sectionBlock: {
    marginBottom: 24,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
    marginBottom: 14,
  },

  // ─── Card (shared) ────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // ─── Subscription Card ────────────────────────────────────────────────────
  subBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  subBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spUnlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF8F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  spUnlockedText: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  upgradeBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Sell Options Sheet ───────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDDDD',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  sheetButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sheetButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sheetButtonMeta: {
    fontSize: 13,
    color: '#6B6B6B',
  },

  // ─── Trade Card ─────────────────────────────────────────────────────────────
  viewDetails: {
    fontSize: 14,
    color: '#2979B8',
    fontWeight: '600',
  },
  spBalanceRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  spBalanceItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  spBalanceDivider: {
    width: 1,
    backgroundColor: '#E8E8E8',
  },
  spBalanceEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  spBalanceLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 4,
  },
  spBalanceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2979B8',
  },
  spStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  spStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  spStatLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 3,
  },
  spStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  spCtaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  spCtaBtn: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  spCtaEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  spCtaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ─── Recent Trade Card ────────────────────────────────────────────────────
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tradeInfo: {
    flex: 1,
    gap: 6,
  },
  tradeItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tradeStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tradeStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  viewTimelineBtn: {
    backgroundColor: '#2979B8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  viewTimelineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Recent Trade Empty State ─────────────────────────────────────────────
  emptyTradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  emptyTradeText: {
    fontSize: 14,
    color: '#6B6B6B',
  },

  // ─── View All Trades ──────────────────────────────────────────────────────
  viewAllTradesBtn: {
    backgroundColor: '#2979B8',
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  viewAllTradesBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
